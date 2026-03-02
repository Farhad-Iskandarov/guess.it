"""
Multi-provider Football API Service
Supports:
  - football-data.org (v4)
  - API-Football / api-sports.io (v3)
Auto-detects provider from the active config's base_url.
"""
import httpx
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional
from pymongo import UpdateOne

logger = logging.getLogger(__name__)

# ==================== Provider Constants ====================

PROVIDER_FDO = "football-data"  # football-data.org
PROVIDER_AFS = "api-sports"     # api-sports.io

# Competition codes used by frontend (shared across providers)
COMPETITION_CODES = ["PL", "BL1", "SA", "PD", "FL1", "CL", "EC", "WC"]

COMPETITION_NAMES = {
    "PL": "Premier League", "BL1": "Bundesliga", "SA": "Serie A",
    "PD": "La Liga", "FL1": "Ligue 1", "CL": "Champions League",
    "EC": "European Championship", "WC": "FIFA World Cup",
}

# API-Football league IDs (for api-sports.io provider)
AFS_LEAGUE_IDS = {
    "PL": 39, "BL1": 78, "SA": 135, "PD": 140,
    "FL1": 61, "CL": 2, "EC": 4, "WC": 1,
}
AFS_ID_TO_CODE = {v: k for k, v in AFS_LEAGUE_IDS.items()}

# football-data.org status → app status
FDO_STATUS_MAP = {
    "SCHEDULED": "NOT_STARTED", "TIMED": "NOT_STARTED",
    "IN_PLAY": "LIVE", "PAUSED": "LIVE", "LIVE": "LIVE",
    "EXTRA_TIME": "LIVE", "PENALTY_SHOOTOUT": "LIVE", "SUSPENDED": "LIVE",
    "FINISHED": "FINISHED", "AWARDED": "FINISHED",
    "POSTPONED": "NOT_STARTED", "CANCELLED": "FINISHED",
}

# API-Football status → app status
AFS_STATUS_MAP = {
    "TBD": "NOT_STARTED", "NS": "NOT_STARTED", "PST": "NOT_STARTED",
    "1H": "LIVE", "HT": "LIVE", "2H": "LIVE", "ET": "LIVE",
    "BT": "LIVE", "P": "LIVE", "SUSP": "LIVE", "INT": "LIVE", "LIVE": "LIVE",
    "FT": "FINISHED", "AET": "FINISHED", "PEN": "FINISHED",
    "CANC": "FINISHED", "ABD": "FINISHED", "AWD": "FINISHED", "WO": "FINISHED",
}

PREDICTION_LOCK_MINUTES = 10


# ==================== Cache & Rate Limiting ====================

class MatchCache:
    def __init__(self):
        self._cache: dict = {}
        self._timestamps: dict[str, datetime] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str, max_age_seconds: int = 60):
        async with self._lock:
            if key in self._cache and key in self._timestamps:
                age = (datetime.now(timezone.utc) - self._timestamps[key]).total_seconds()
                if age < max_age_seconds:
                    return self._cache[key]
            return None

    async def set(self, key: str, value):
        async with self._lock:
            self._cache[key] = value
            self._timestamps[key] = datetime.now(timezone.utc)

    async def clear(self):
        async with self._lock:
            self._cache.clear()
            self._timestamps.clear()


cache = MatchCache()
_request_times: list[datetime] = []
_rate_lock = asyncio.Lock()
_suspended_until: Optional[datetime] = None

# ==================== API Health Tracking ====================
_api_health = {
    "last_success": None,
    "last_error": None,
    "last_error_msg": None,
    "total_requests": 0,
    "total_errors": 0,
    "last_status_code": None,
    "last_match_count": 0,
    "remaining_requests": None,
    "request_limit": None,
}

# ==================== DB Reference for Logging ====================
_db_ref = None
_log_buffer: list[dict] = []
_error_buffer: list[dict] = []
_buffer_lock = asyncio.Lock()

def set_db_for_logging(db):
    """Set the database reference for API request/error logging."""
    global _db_ref
    _db_ref = db

async def _flush_log_buffer():
    """Flush buffered logs to MongoDB."""
    global _log_buffer, _error_buffer
    async with _buffer_lock:
        if _db_ref is None:
            return
        if _log_buffer:
            try:
                await _db_ref.api_request_logs.insert_many(_log_buffer)
            except Exception as e:
                logger.warning(f"Failed to flush request logs: {e}")
            _log_buffer = []
        if _error_buffer:
            try:
                await _db_ref.api_error_logs.insert_many(_error_buffer)
            except Exception as e:
                logger.warning(f"Failed to flush error logs: {e}")
            _error_buffer = []

async def _log_api_request(entry: dict):
    """Buffer an API request log entry."""
    async with _buffer_lock:
        _log_buffer.append(entry)
        if len(_log_buffer) >= 5:
            if _db_ref is not None:
                try:
                    await _db_ref.api_request_logs.insert_many(_log_buffer)
                except Exception:
                    pass
                _log_buffer.clear()

async def _log_api_error(entry: dict):
    """Buffer an API error log entry."""
    async with _buffer_lock:
        _error_buffer.append(entry)
        if len(_error_buffer) >= 3:
            if _db_ref is not None:
                try:
                    await _db_ref.api_error_logs.insert_many(_error_buffer)
                except Exception:
                    pass
                _error_buffer.clear()


async def _check_rate_limit():
    async with _rate_lock:
        now = datetime.now(timezone.utc)
        _request_times[:] = [t for t in _request_times if (now - t).total_seconds() < 60]
        if len(_request_times) >= 9:
            oldest = _request_times[0]
            wait_time = 60 - (now - oldest).total_seconds()
            if wait_time > 0:
                await asyncio.sleep(wait_time)
        _request_times.append(now)


# ==================== Config Detection ====================

async def _get_active_config(db=None) -> dict:
    """Get the active API config from DB, or build one from env."""
    if db is not None:
        try:
            cfg = await db.admin_api_configs.find_one(
                {"is_active": True, "enabled": True}, {"_id": 0}
            )
            if cfg and cfg.get("api_key"):
                return cfg
        except Exception as e:
            logger.warning(f"Failed to fetch API config from DB: {e}")

    # Fallback to env
    return {
        "api_key": os.environ.get("FOOTBALL_API_KEY", ""),
        "base_url": os.environ.get("FOOTBALL_API_BASE_URL", "https://v3.football.api-sports.io"),
        "name": "Environment Default",
    }


def _normalize_base_url(base_url: str) -> str:
    """Normalize base_url: ensure protocol and correct API path."""
    if not base_url:
        return base_url
    url = base_url.strip().rstrip("/")
    # Add https:// if no protocol
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url
    # football-data.org: always resolve to the correct v4 API endpoint
    if "football-data.org" in url.lower():
        url = "https://api.football-data.org/v4"
    return url


def _detect_provider(base_url: str) -> str:
    """Detect which provider based on base_url."""
    if not base_url:
        return PROVIDER_AFS
    url_lower = base_url.lower()
    if "football-data.org" in url_lower:
        return PROVIDER_FDO
    return PROVIDER_AFS


# ==================== Generic HTTP ====================

async def _http_get(url: str, headers: dict, params: dict = None, source: str = "system") -> dict:
    """Make a GET request with rate limiting, error handling, and detailed logging."""
    global _suspended_until
    import traceback as tb_module
    import uuid as uuid_module

    if _suspended_until and datetime.now(timezone.utc) < _suspended_until:
        return {}

    await _check_rate_limit()

    request_id = f"req_{uuid_module.uuid4().hex[:12]}"
    start_time = datetime.now(timezone.utc)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            elapsed_ms = round((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            _api_health["total_requests"] += 1
            _api_health["last_status_code"] = resp.status_code

            # Track remaining requests from response headers
            remaining = resp.headers.get("X-Requests-Available-Minute") or resp.headers.get("x-requests-available")
            limit = resp.headers.get("X-RequestCounter-Reset") or resp.headers.get("x-ratelimit-requests-remaining")
            if remaining is not None:
                try: _api_health["remaining_requests"] = int(remaining)
                except: pass
            if limit is not None:
                try: _api_health["request_limit"] = int(limit)
                except: pass

            # Build response preview (truncated)
            resp_preview = ""
            try:
                resp_preview = resp.text[:1000]
            except Exception:
                pass

            # Build base log entry
            log_entry = {
                "request_id": request_id,
                "endpoint": url,
                "method": "GET",
                "status_code": resp.status_code,
                "response_time_ms": elapsed_ms,
                "timestamp": start_time.isoformat(),
                "params": {k: str(v) for k, v in (params or {}).items()},
                "response_preview": resp_preview[:500],
                "source": source,
                "headers_sent": {k: v for k, v in headers.items() if k.lower() not in ("x-auth-token", "x-apisports-key", "authorization")},
            }
            await _log_api_request(log_entry)

            if resp.status_code == 429:
                _api_health["last_error"] = datetime.now(timezone.utc).isoformat()
                _api_health["last_error_msg"] = "Rate limit reached (429)"
                _api_health["total_errors"] += 1
                error_entry = {
                    "error_id": f"err_{uuid_module.uuid4().hex[:12]}",
                    "request_id": request_id,
                    "endpoint": url,
                    "status_code": 429,
                    "error_message": "Rate limit reached (429)",
                    "full_error_response": resp_preview[:2000],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "stack_trace": None,
                    "retry_count": 1,
                    "source": source,
                }
                await _log_api_error(error_entry)
                await asyncio.sleep(60)
                resp = await client.get(url, headers=headers, params=params)

            if resp.status_code != 200:
                _api_health["last_error"] = datetime.now(timezone.utc).isoformat()
                _api_health["last_error_msg"] = f"HTTP {resp.status_code}: {resp.text[:200]}"
                _api_health["total_errors"] += 1
                error_entry = {
                    "error_id": f"err_{uuid_module.uuid4().hex[:12]}",
                    "request_id": request_id,
                    "endpoint": url,
                    "status_code": resp.status_code,
                    "error_message": f"HTTP {resp.status_code}",
                    "full_error_response": resp.text[:2000],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "stack_trace": None,
                    "retry_count": 0,
                    "source": source,
                }
                await _log_api_error(error_entry)
                logger.error(f"API error {resp.status_code}: {resp.text[:300]}")
                return {}

            data = resp.json()
            # Check for API-Football style errors
            errors = data.get("errors", {})
            if errors and isinstance(errors, dict) and len(errors) > 0:
                if "suspended" in str(errors).lower():
                    _suspended_until = datetime.now(timezone.utc) + timedelta(minutes=2)
                _api_health["last_error"] = datetime.now(timezone.utc).isoformat()
                _api_health["last_error_msg"] = str(errors)[:200]
                _api_health["total_errors"] += 1
                error_entry = {
                    "error_id": f"err_{uuid_module.uuid4().hex[:12]}",
                    "request_id": request_id,
                    "endpoint": url,
                    "status_code": resp.status_code,
                    "error_message": str(errors)[:200],
                    "full_error_response": str(errors)[:2000],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "stack_trace": None,
                    "retry_count": 0,
                    "source": source,
                }
                await _log_api_error(error_entry)
                logger.warning(f"API errors: {errors}")
                return {}

            _suspended_until = None
            _api_health["last_success"] = datetime.now(timezone.utc).isoformat()
            _api_health["last_error_msg"] = None
            return data
    except httpx.RequestError as e:
        elapsed_ms = round((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        _api_health["last_error"] = datetime.now(timezone.utc).isoformat()
        _api_health["last_error_msg"] = f"Connection error: {str(e)[:150]}"
        _api_health["total_errors"] += 1
        error_entry = {
            "error_id": f"err_{uuid_module.uuid4().hex[:12]}",
            "request_id": request_id,
            "endpoint": url,
            "status_code": 0,
            "error_message": f"Connection error: {str(e)[:200]}",
            "full_error_response": str(e)[:2000],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "stack_trace": tb_module.format_exc()[:3000],
            "retry_count": 0,
            "source": source,
        }
        await _log_api_error(error_entry)
        # Also log the failed request
        log_entry = {
            "request_id": request_id,
            "endpoint": url,
            "method": "GET",
            "status_code": 0,
            "response_time_ms": elapsed_ms,
            "timestamp": start_time.isoformat(),
            "params": {k: str(v) for k, v in (params or {}).items()},
            "response_preview": f"Connection error: {str(e)[:200]}",
            "source": source,
            "headers_sent": {},
        }
        await _log_api_request(log_entry)
        logger.error(f"HTTP request error: {e}")
        return {}


# ==================== Shared Helpers ====================

def _format_datetime(utc_date_str: str) -> str:
    try:
        dt = datetime.fromisoformat(utc_date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        diff = dt.date() - now.date()
        time_str = dt.strftime("%H:%M")
        if diff.days == 0:
            return f"Today, {time_str}"
        elif diff.days == 1:
            return f"Tomorrow, {time_str}"
        elif diff.days == -1:
            return f"Yesterday, {time_str}"
        elif 0 < diff.days <= 6:
            return f"{dt.strftime('%A')}, {time_str}"
        else:
            return f"{dt.strftime('%d %b')}, {time_str}"
    except Exception:
        return utc_date_str


def _is_prediction_locked(utc_date_str: str, app_status: str) -> bool:
    if app_status in ("LIVE", "FINISHED"):
        return True
    try:
        match_time = datetime.fromisoformat(utc_date_str.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) >= match_time - timedelta(minutes=PREDICTION_LOCK_MINUTES)
    except Exception:
        return False


def _enrich_with_votes(match: dict, vote_counts: dict) -> dict:
    """Add vote data to a transformed match dict."""
    mid = match["id"]
    votes = vote_counts.get(mid, {})
    hv = votes.get("home", 0)
    dv = votes.get("draw", 0)
    av = votes.get("away", 0)
    total = hv + dv + av
    hp = round((hv / total * 100) if total > 0 else 0)
    dp = round((dv / total * 100) if total > 0 else 0)
    ap = 100 - hp - dp if total > 0 else 0
    most = "Home"
    if dv >= hv and dv >= av:
        most = "Draw"
    elif av >= hv:
        most = "Away"
    match["votes"] = {
        "home": {"count": hv, "percentage": hp},
        "draw": {"count": dv, "percentage": dp},
        "away": {"count": av, "percentage": ap},
    }
    match["totalVotes"] = total
    match["mostPicked"] = most
    return match


# ==================== football-data.org Provider ====================

async def _fdo_fetch_matches(config: dict, date_from: str, date_to: str, competition: str = None) -> list[dict]:
    """Fetch matches from football-data.org v4."""
    base_url = _normalize_base_url(config.get("base_url", "https://api.football-data.org/v4"))
    api_key = config.get("api_key", "")
    headers = {"X-Auth-Token": api_key}

    # football-data.org dateTo is EXCLUSIVE, so add 1 day to include the end date
    try:
        end_dt = datetime.strptime(date_to, "%Y-%m-%d")
        date_to_api = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    except ValueError:
        date_to_api = date_to

    params = {}
    if date_from:
        params["dateFrom"] = date_from
    if date_to_api:
        params["dateTo"] = date_to_api

    # Use competitions filter for efficiency
    if competition and competition in COMPETITION_CODES:
        params["competitions"] = competition
    else:
        # Only use codes that football-data.org supports on free tier
        params["competitions"] = ",".join(["PL", "BL1", "SA", "PD", "FL1", "CL"])

    cache_key = f"fdo:{date_from}:{date_to}:{competition}"
    cached = await cache.get(cache_key, 180)
    if cached is not None:
        return cached

    data = await _http_get(f"{base_url}/matches", headers, params)
    raw_matches = data.get("matches", [])

    matches = [_fdo_transform(m) for m in raw_matches]
    await cache.set(cache_key, matches)
    return matches


async def _fdo_fetch_live(config: dict) -> list[dict]:
    """Fetch live matches from football-data.org (filter IN_PLAY/PAUSED from today)."""
    base_url = _normalize_base_url(config.get("base_url", "https://api.football-data.org/v4"))
    api_key = config.get("api_key", "")
    headers = {"X-Auth-Token": api_key}

    cache_key = "fdo_live"
    cached = await cache.get(cache_key, 25)
    if cached is not None:
        return cached

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    params = {
        "dateFrom": today,
        "dateTo": tomorrow,
        "competitions": ",".join(["PL", "BL1", "SA", "PD", "FL1", "CL"]),
    }

    data = await _http_get(f"{base_url}/matches", headers, params)
    raw = data.get("matches", [])

    live = [_fdo_transform(m) for m in raw if m.get("status") in ("IN_PLAY", "PAUSED", "LIVE", "EXTRA_TIME", "PENALTY_SHOOTOUT")]
    await cache.set(cache_key, live)
    return live


def _fdo_transform(m: dict) -> dict:
    """Transform a football-data.org match to app format."""
    match_id = m.get("id", 0)
    status_raw = m.get("status", "SCHEDULED")
    utc_date = m.get("utcDate", "")

    home = m.get("homeTeam", {})
    away = m.get("awayTeam", {})
    comp = m.get("competition", {})

    full_time = m.get("score", {}).get("fullTime", {}) or {}
    half_time = m.get("score", {}).get("halfTime", {}) or {}

    home_score = full_time.get("home")
    away_score = full_time.get("away")

    app_status = FDO_STATUS_MAP.get(status_raw, "NOT_STARTED")

    # Status detail for display
    detail_map = {
        "SCHEDULED": "NS", "TIMED": "NS", "IN_PLAY": "LIVE", "PAUSED": "HT",
        "LIVE": "LIVE", "EXTRA_TIME": "ET", "PENALTY_SHOOTOUT": "PEN",
        "FINISHED": "FT", "SUSPENDED": "SUSP", "POSTPONED": "PST",
        "CANCELLED": "CANC", "AWARDED": "FT",
    }
    status_detail = detail_map.get(status_raw, status_raw)

    # Match minute
    match_minute = None
    if status_raw == "PAUSED":
        match_minute = "HT"
    elif status_raw in ("IN_PLAY", "LIVE"):
        minute = m.get("minute")
        if minute:
            match_minute = f"{minute}'"

    locked = _is_prediction_locked(utc_date, app_status)
    lock_reason = None
    if app_status == "LIVE":
        lock_reason = "Match is live"
    elif app_status == "FINISHED":
        lock_reason = "Match has ended"
    elif locked:
        lock_reason = "Prediction closed"

    def short_name(name):
        return (name or "UNK")[:3].upper()

    comp_code = comp.get("code", "")

    return {
        "id": match_id,
        "homeTeam": {
            "id": home.get("id"),
            "name": home.get("name", "Unknown"),
            "shortName": home.get("shortName") or short_name(home.get("name")),
            "flag": None,
            "logo": home.get("crest"),
            "crest": home.get("crest"),
        },
        "awayTeam": {
            "id": away.get("id"),
            "name": away.get("name", "Unknown"),
            "shortName": away.get("shortName") or short_name(away.get("name")),
            "flag": None,
            "logo": away.get("crest"),
            "crest": away.get("crest"),
        },
        "competition": comp.get("name", "Unknown"),
        "competitionCode": comp_code,
        "competitionEmblem": comp.get("emblem"),
        "sport": "Football",
        "dateTime": _format_datetime(utc_date),
        "utcDate": utc_date,
        "status": app_status,
        "statusDetail": status_detail,
        "matchMinute": match_minute,
        "score": {
            "home": home_score,
            "away": away_score,
            "halfTime": {"home": half_time.get("home"), "away": half_time.get("away")},
        },
        "predictionLocked": locked,
        "lockReason": lock_reason,
        "votes": {"home": {"count": 0, "percentage": 0}, "draw": {"count": 0, "percentage": 0}, "away": {"count": 0, "percentage": 0}},
        "totalVotes": 0,
        "mostPicked": "Home",
        "featured": False,
    }


# ==================== API-Football (api-sports.io) Provider ====================

async def _afs_fetch_matches(config: dict, date_from: str, date_to: str, competition: str = None) -> list[dict]:
    """Fetch matches from API-Football v3 using per-day date queries."""
    base_url = config.get("base_url", "https://v3.football.api-sports.io").rstrip("/")
    api_key = config.get("api_key", "")
    headers = {"x-apisports-key": api_key}

    cache_key = f"afs:{date_from}:{date_to}:{competition}"
    cached = await cache.get(cache_key, 180)
    if cached is not None:
        return cached

    try:
        start = datetime.strptime(date_from, "%Y-%m-%d")
        end = datetime.strptime(date_to, "%Y-%m-%d")
    except ValueError:
        return []

    # Clamp to free plan window (yesterday to tomorrow)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    start = max(start, today - timedelta(days=1))
    end = min(end, today + timedelta(days=1))
    if start > end:
        return []

    all_fixtures = []
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        raw_key = f"afs_raw:{date_str}"
        raw = await cache.get(raw_key, 300)
        if raw is None:
            data = await _http_get(f"{base_url}/fixtures", headers, {"date": date_str})
            raw = data.get("response", [])
            await cache.set(raw_key, raw)
        # Filter to tracked leagues
        tracked = [f for f in raw if f.get("league", {}).get("id") in AFS_ID_TO_CODE]
        all_fixtures.extend(tracked)
        current += timedelta(days=1)

    # Filter by competition
    if competition and competition in AFS_LEAGUE_IDS:
        target_id = AFS_LEAGUE_IDS[competition]
        all_fixtures = [f for f in all_fixtures if f.get("league", {}).get("id") == target_id]

    matches = [_afs_transform(f) for f in all_fixtures]
    await cache.set(cache_key, matches)
    return matches


async def _afs_fetch_live(config: dict) -> list[dict]:
    """Fetch live matches from API-Football."""
    base_url = config.get("base_url", "https://v3.football.api-sports.io").rstrip("/")
    api_key = config.get("api_key", "")
    headers = {"x-apisports-key": api_key}

    cache_key = "afs_live"
    cached = await cache.get(cache_key, 25)
    if cached is not None:
        return cached

    data = await _http_get(f"{base_url}/fixtures", headers, {"live": "all"})
    raw = data.get("response", [])
    tracked = [f for f in raw if f.get("league", {}).get("id") in AFS_ID_TO_CODE]

    matches = [_afs_transform(f) for f in tracked]
    await cache.set(cache_key, matches)
    return matches


def _afs_transform(f: dict) -> dict:
    """Transform API-Football fixture to app format."""
    fixture = f.get("fixture", {})
    league = f.get("league", {})
    teams = f.get("teams", {})
    goals = f.get("goals", {})
    score_data = f.get("score", {})

    fixture_id = fixture.get("id", 0)
    fx_status = fixture.get("status", {})
    short = fx_status.get("short", "NS")
    utc_date = fixture.get("date", "")
    elapsed = fx_status.get("elapsed")

    ht = teams.get("home", {})
    at = teams.get("away", {})

    league_id = league.get("id")
    comp_code = AFS_ID_TO_CODE.get(league_id, "")

    app_status = AFS_STATUS_MAP.get(short, "NOT_STARTED")

    detail_map = {
        "NS": "NS", "TBD": "NS", "1H": "LIVE", "HT": "HT", "2H": "LIVE",
        "ET": "ET", "BT": "BT", "P": "PEN", "FT": "FT", "AET": "FT", "PEN": "FT",
        "SUSP": "SUSP", "INT": "INT", "PST": "PST", "CANC": "CANC",
        "ABD": "ABD", "AWD": "AWD", "WO": "WO", "LIVE": "LIVE",
    }

    match_minute = None
    if short == "HT":
        match_minute = "HT"
    elif short in ("1H", "2H", "ET", "LIVE") and elapsed is not None:
        match_minute = f"{elapsed}'"
    elif short == "P":
        match_minute = "PEN"

    halftime = score_data.get("halftime", {}) or {}

    locked = _is_prediction_locked(utc_date, app_status)
    lock_reason = None
    if app_status == "LIVE":
        lock_reason = "Match is live"
    elif app_status == "FINISHED":
        lock_reason = "Match has ended"
    elif locked:
        lock_reason = "Prediction closed"

    def short_name(name):
        return (name or "UNK")[:3].upper()

    return {
        "id": fixture_id,
        "homeTeam": {
            "id": ht.get("id"),
            "name": ht.get("name", "Unknown"),
            "shortName": short_name(ht.get("name")),
            "flag": None,
            "logo": ht.get("logo"),
            "crest": ht.get("logo"),
        },
        "awayTeam": {
            "id": at.get("id"),
            "name": at.get("name", "Unknown"),
            "shortName": short_name(at.get("name")),
            "flag": None,
            "logo": at.get("logo"),
            "crest": at.get("logo"),
        },
        "competition": league.get("name", COMPETITION_NAMES.get(comp_code, "Unknown")),
        "competitionCode": comp_code,
        "competitionEmblem": league.get("logo"),
        "sport": "Football",
        "dateTime": _format_datetime(utc_date),
        "utcDate": utc_date,
        "status": app_status,
        "statusDetail": detail_map.get(short, short),
        "matchMinute": match_minute,
        "score": {
            "home": goals.get("home"),
            "away": goals.get("away"),
            "halfTime": {"home": halftime.get("home"), "away": halftime.get("away")},
        },
        "predictionLocked": locked,
        "lockReason": lock_reason,
        "votes": {"home": {"count": 0, "percentage": 0}, "draw": {"count": 0, "percentage": 0}, "away": {"count": 0, "percentage": 0}},
        "totalVotes": 0,
        "mostPicked": "Home",
        "featured": False,
    }


# ==================== Unified Public API ====================

async def get_matches(
    db,
    date_from: str = None,
    date_to: str = None,
    competition: str = None,
    status: str = None,
) -> list[dict]:
    """Fetch matches from the active provider, enriched with vote counts."""
    config = await _get_active_config(db)
    provider = _detect_provider(config.get("base_url", ""))

    # Unified cache key
    ck = f"unified:{provider}:{date_from}:{date_to}:{competition}:{status}"
    cache_ttl = 30 if status in ("LIVE", "IN_PLAY") else 180
    cached = await cache.get(ck, cache_ttl)
    if cached is not None:
        return cached

    matches = []

    if status == "LIVE":
        if provider == PROVIDER_FDO:
            matches = await _fdo_fetch_live(config)
        else:
            matches = await _afs_fetch_live(config)
    else:
        if not date_from and not date_to:
            today = datetime.now(timezone.utc)
            date_from = (today - timedelta(days=3)).strftime("%Y-%m-%d")
            date_to = (today + timedelta(days=3)).strftime("%Y-%m-%d")

        if provider == PROVIDER_FDO:
            matches = await _fdo_fetch_matches(config, date_from, date_to, competition)
        else:
            matches = await _afs_fetch_matches(config, date_from, date_to, competition)

    if not matches:
        expired = await cache.get(ck, 3600)
        if expired:
            return expired
        return []

    # Enrich with vote counts
    match_ids = [m["id"] for m in matches]
    vote_counts = await _get_vote_counts(db, match_ids)
    matches = [_enrich_with_votes(m, vote_counts) for m in matches]

    # Sort by date
    matches.sort(key=lambda m: m.get("utcDate", ""))

    # Mark featured
    by_votes = sorted(matches, key=lambda m: m["totalVotes"], reverse=True)
    for m in by_votes[:2]:
        m["featured"] = True
    if all(m["totalVotes"] == 0 for m in matches) and len(matches) >= 2:
        matches[0]["featured"] = True
        if len(matches) > 1:
            matches[1]["featured"] = True

    await cache.set(ck, matches)
    _api_health["last_match_count"] = len(matches)

    # Persist matches to MongoDB for profile enrichment (background, non-blocking)
    if matches and db is not None:
        try:
            ops = []
            for m in matches:
                ops.append(
                    UpdateOne(
                        {"id": m["id"]},
                        {"$set": {**{k: v for k, v in m.items() if k != "votes" and k != "totalVotes" and k != "featured" and k != "mostPicked"}, "cached_at": datetime.now(timezone.utc).isoformat()}},
                        upsert=True,
                    )
                )
            if ops:
                await db.football_matches_cache.bulk_write(ops, ordered=False)
        except Exception:
            pass

    return matches


async def get_live_matches(db) -> list[dict]:
    return await get_matches(db, status="LIVE")


async def get_today_matches(db) -> list[dict]:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await get_matches(db, date_from=today, date_to=today)


async def get_upcoming_matches(db, days: int = 7) -> list[dict]:
    today = datetime.now(timezone.utc)
    return await get_matches(
        db,
        date_from=today.strftime("%Y-%m-%d"),
        date_to=(today + timedelta(days=min(days, 3))).strftime("%Y-%m-%d"),
    )


async def get_competition_matches(db, competition_code: str) -> list[dict]:
    today = datetime.now(timezone.utc)
    return await get_matches(
        db,
        date_from=(today - timedelta(days=3)).strftime("%Y-%m-%d"),
        date_to=(today + timedelta(days=3)).strftime("%Y-%m-%d"),
        competition=competition_code,
    )


async def _get_vote_counts(db, match_ids: list) -> dict:
    if not match_ids:
        return {}
    pipeline = [
        {"$match": {"match_id": {"$in": match_ids}}},
        {"$group": {
            "_id": {"match_id": "$match_id", "prediction": "$prediction"},
            "count": {"$sum": 1},
        }},
    ]
    results = await db.predictions.aggregate(pipeline).to_list(1000)
    counts = {}
    for r in results:
        mid = r["_id"]["match_id"]
        pred = r["_id"]["prediction"]
        if mid not in counts:
            counts[mid] = {"home": 0, "draw": 0, "away": 0}
        counts[mid][pred] = r["count"]
    return counts


def get_available_competitions() -> list[dict]:
    return [
        {"code": c, "name": COMPETITION_NAMES.get(c, c), "id": AFS_LEAGUE_IDS.get(c, 0)}
        for c in COMPETITION_CODES
    ]


# ==================== Validation & Management ====================

async def validate_api_key(api_key: str, base_url: str = "") -> dict:
    """Validate an API key against the correct provider."""
    provider = _detect_provider(base_url)

    # Normalize URL before validation
    base_url = _normalize_base_url(base_url)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if provider == PROVIDER_FDO:
                # football-data.org: test with /competitions
                fdo_url = base_url if base_url else "https://api.football-data.org/v4"
                resp = await client.get(
                    f"{fdo_url}/competitions",
                    headers={"X-Auth-Token": api_key},
                )
                if resp.status_code == 403:
                    return {"valid": False, "error": "Invalid API key (403 Forbidden)"}
                if resp.status_code == 429:
                    return {"valid": False, "error": "Rate limited. Try again later."}
                if resp.status_code != 200:
                    return {"valid": False, "error": f"HTTP {resp.status_code}"}
                data = resp.json()
                comps = data.get("competitions", [])
                return {
                    "valid": True,
                    "provider": "football-data.org",
                    "competitions": len(comps),
                    "subscription": {"plan": "free" if len(comps) <= 13 else "paid"},
                    "requests": {},
                }
            else:
                # API-Football: test with /status
                resp = await client.get(
                    "https://v3.football.api-sports.io/status",
                    headers={"x-apisports-key": api_key},
                )
                if resp.status_code != 200:
                    return {"valid": False, "error": f"HTTP {resp.status_code}"}
                data = resp.json()
                errors = data.get("errors", {})
                if errors:
                    return {"valid": False, "error": str(errors)}
                response = data.get("response", {})
                if isinstance(response, list) and response:
                    response = response[0]
                elif isinstance(response, list):
                    response = {}
                return {
                    "valid": True,
                    "provider": "api-sports.io",
                    "subscription": response.get("subscription", {}) if isinstance(response, dict) else {},
                    "requests": response.get("requests", {}) if isinstance(response, dict) else {},
                }
    except Exception as e:
        return {"valid": False, "error": str(e)}


async def clear_cache_and_reset():
    """Clear all cached data and reset suspension flag."""
    global _suspended_until
    _suspended_until = None
    await cache.clear()
    logger.info("Football API cache cleared and suspension reset")


async def get_match_by_id(db, match_id: int) -> Optional[dict]:
    """Fetch a single match by ID from the active provider."""
    cache_key = f"match_id:{match_id}"
    cached = await cache.get(cache_key, 600)
    if cached is not None:
        return cached

    config = await _get_active_config(db)
    provider = _detect_provider(config.get("base_url", ""))

    match = None
    if provider == PROVIDER_FDO:
        base_url = _normalize_base_url(config.get("base_url", "https://api.football-data.org/v4"))
        api_key = config.get("api_key", "")
        data = await _http_get(f"{base_url}/matches/{match_id}", {"X-Auth-Token": api_key})
        if data and "homeTeam" in data:
            match = _fdo_transform(data)
    else:
        base_url = config.get("base_url", "https://v3.football.api-sports.io").rstrip("/")
        api_key = config.get("api_key", "")
        data = await _http_get(f"{base_url}/fixtures", {"x-apisports-key": api_key}, {"id": match_id})
        fixtures = data.get("response", [])
        if fixtures:
            match = _afs_transform(fixtures[0])

    if match:
        await cache.set(cache_key, match)
    return match



def get_api_health() -> dict:
    """Return current API health metrics."""
    # Trigger async flush of any buffered logs
    asyncio.ensure_future(_flush_log_buffer())
    
    is_suspended = _suspended_until and datetime.now(timezone.utc) < _suspended_until
    if _api_health["last_error_msg"] and not _api_health["last_success"]:
        status = "error"
    elif is_suspended:
        status = "suspended"
    elif _api_health["last_error_msg"] and _api_health["last_success"]:
        # Had an error but also had success — check which is more recent
        if _api_health["last_error"] and _api_health["last_success"]:
            status = "error" if _api_health["last_error"] > _api_health["last_success"] else "active"
        else:
            status = "active"
    elif _api_health["last_success"]:
        status = "active"
    else:
        status = "unknown"

    return {
        "status": status,
        "is_suspended": bool(is_suspended),
        "last_success": _api_health["last_success"],
        "last_error": _api_health["last_error"],
        "last_error_msg": _api_health["last_error_msg"],
        "total_requests": _api_health["total_requests"],
        "total_errors": _api_health["total_errors"],
        "last_status_code": _api_health["last_status_code"],
        "last_match_count": _api_health["last_match_count"],
        "remaining_requests": _api_health["remaining_requests"],
        "request_limit": _api_health["request_limit"],
        "cache_entries": len(cache._cache),
    }
