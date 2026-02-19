"""
Football-Data.org API Service
Handles fetching, caching, and transforming match data.
Free tier: 10 requests/min.
"""
import httpx
import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Football-Data.org API config
BASE_URL = "https://api.football-data.org/v4"

# Free tier competitions
FREE_COMPETITIONS = {
    "PL": {"id": 2021, "name": "Premier League", "code": "PL"},
    "BL1": {"id": 2002, "name": "Bundesliga", "code": "BL1"},
    "SA": {"id": 2019, "name": "Serie A", "code": "SA"},
    "PD": {"id": 2014, "name": "La Liga", "code": "PD"},
    "FL1": {"id": 2015, "name": "Ligue 1", "code": "FL1"},
    "CL": {"id": 2001, "name": "Champions League", "code": "CL"},
    "EC": {"id": 2018, "name": "European Championship", "code": "EC"},
    "WC": {"id": 2000, "name": "FIFA World Cup", "code": "WC"},
}

# Status mapping from Football-Data.org to our app
STATUS_MAP = {
    "SCHEDULED": "NOT_STARTED",
    "TIMED": "NOT_STARTED",
    "IN_PLAY": "LIVE",
    "PAUSED": "LIVE",  # Half-time counts as live
    "FINISHED": "FINISHED",
    "SUSPENDED": "LIVE",
    "POSTPONED": "NOT_STARTED",
    "CANCELLED": "FINISHED",
    "AWARDED": "FINISHED",
}

# Prediction lock window (minutes before match start)
PREDICTION_LOCK_MINUTES = 10


class MatchCache:
    """Simple in-memory cache with TTL"""

    def __init__(self):
        self._cache: dict = {}
        self._timestamps: dict[str, datetime] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str, max_age_seconds: int = 60) -> Optional[dict]:
        async with self._lock:
            if key in self._cache and key in self._timestamps:
                age = (datetime.now(timezone.utc) - self._timestamps[key]).total_seconds()
                if age < max_age_seconds:
                    return self._cache[key]
            return None

    async def set(self, key: str, value: dict):
        async with self._lock:
            self._cache[key] = value
            self._timestamps[key] = datetime.now(timezone.utc)

    async def clear(self):
        async with self._lock:
            self._cache.clear()
            self._timestamps.clear()


# Global cache instance
cache = MatchCache()

# Rate limiter: track request timestamps
_request_times: list[datetime] = []
_rate_lock = asyncio.Lock()


async def _check_rate_limit():
    """Ensure we don't exceed 10 requests per minute"""
    async with _rate_lock:
        now = datetime.now(timezone.utc)
        # Remove entries older than 60 seconds
        _request_times[:] = [t for t in _request_times if (now - t).total_seconds() < 60]
        if len(_request_times) >= 9:  # Leave 1 buffer
            oldest = _request_times[0]
            wait_time = 60 - (now - oldest).total_seconds()
            if wait_time > 0:
                logger.warning(f"Rate limit approaching, waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
        _request_times.append(now)


def _get_headers() -> dict:
    api_key = os.environ.get("FOOTBALL_API_KEY", "")
    return {"X-Auth-Token": api_key}


async def _api_get(endpoint: str, params: dict = None) -> dict:
    """Make a GET request to Football-Data.org with rate limiting"""
    await _check_rate_limit()

    url = f"{BASE_URL}{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=_get_headers(), params=params)

            if response.status_code == 429:
                logger.warning("Rate limited by Football-Data.org, waiting 60s")
                await asyncio.sleep(60)
                response = await client.get(url, headers=_get_headers(), params=params)

            if response.status_code != 200:
                logger.error(f"Football API error: {response.status_code} - {response.text[:200]}")
                return {}

            return response.json()
    except httpx.RequestError as e:
        logger.error(f"Football API request error: {e}")
        return {}


def _format_datetime(utc_date_str: str) -> str:
    """Format UTC date string to readable format"""
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


def _get_match_status_detail(api_status: str) -> str:
    """Get more specific status text for display"""
    if api_status == "PAUSED":
        return "HT"  # Half-time
    if api_status == "IN_PLAY":
        return "LIVE"
    if api_status == "FINISHED":
        return "FT"
    if api_status in ("SCHEDULED", "TIMED"):
        return "NS"  # Not started
    return api_status


def _estimate_match_minute(utc_date_str: str, api_status: str) -> Optional[str]:
    """
    Estimate current match minute from kick-off time.
    Returns string like "67'" or "45+2'" or "HT" or None.
    """
    if api_status not in ("IN_PLAY", "PAUSED"):
        return None

    if api_status == "PAUSED":
        return "HT"

    try:
        kick_off = datetime.fromisoformat(utc_date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        elapsed = (now - kick_off).total_seconds() / 60

        if elapsed < 0:
            return "0'"

        # Cap at reasonable match duration (120 min = extra time max)
        if elapsed > 150:
            return "90+'"

        if elapsed <= 45:
            return f"{int(elapsed)}'"
        elif elapsed <= 48:
            extra = int(elapsed - 45)
            return f"45+{extra}'"
        elif elapsed <= 63:
            # Half-time break (~15 min)
            return "HT"
        else:
            # Second half: subtract ~18 min for half-time
            second_half_min = int(elapsed - 18)
            if second_half_min > 90:
                extra = min(second_half_min - 90, 15)
                return f"90+{extra}'"
            return f"{second_half_min}'"
    except Exception:
        return None


def _is_prediction_locked(utc_date_str: str, api_status: str) -> bool:
    """Check if predictions should be locked for this match"""
    # Always locked for live/finished
    if api_status in ("IN_PLAY", "PAUSED", "FINISHED", "SUSPENDED", "AWARDED"):
        return True

    try:
        match_time = datetime.fromisoformat(utc_date_str.replace("Z", "+00:00"))
        lock_time = match_time - timedelta(minutes=PREDICTION_LOCK_MINUTES)
        return datetime.now(timezone.utc) >= lock_time
    except Exception:
        return False


def _transform_match(match_data: dict, vote_counts: dict = None) -> dict:
    """Transform Football-Data.org match to our app format"""
    match_id = match_data.get("id", 0)
    api_status = match_data.get("status", "TIMED")
    utc_date = match_data.get("utcDate", "")
    score = match_data.get("score", {})
    full_time = score.get("fullTime", {})
    half_time = score.get("halfTime", {})
    home_team = match_data.get("homeTeam", {})
    away_team = match_data.get("awayTeam", {})
    competition = match_data.get("competition", {})

    # Get vote counts from our DB or default
    votes = vote_counts.get(match_id, {}) if vote_counts else {}
    home_votes = votes.get("home", 0)
    draw_votes = votes.get("draw", 0)
    away_votes = votes.get("away", 0)
    total = home_votes + draw_votes + away_votes

    home_pct = round((home_votes / total * 100) if total > 0 else 0)
    draw_pct = round((draw_votes / total * 100) if total > 0 else 0)
    away_pct = 100 - home_pct - draw_pct if total > 0 else 0

    most_picked = "Home"
    if draw_votes >= home_votes and draw_votes >= away_votes:
        most_picked = "Draw"
    elif away_votes >= home_votes:
        most_picked = "Away"

    # Determine scores
    home_score = full_time.get("home")
    away_score = full_time.get("away")
    # For live matches, use fullTime score (it's updated during the match)
    if home_score is None and api_status in ("IN_PLAY", "PAUSED"):
        home_score = full_time.get("home", 0)
        away_score = full_time.get("away", 0)

    return {
        "id": match_id,
        "homeTeam": {
            "id": home_team.get("id"),
            "name": home_team.get("name", "Unknown"),
            "shortName": home_team.get("tla", home_team.get("shortName", "UNK")),
            "flag": None,
            "logo": None,
            "crest": home_team.get("crest"),
        },
        "awayTeam": {
            "id": away_team.get("id"),
            "name": away_team.get("name", "Unknown"),
            "shortName": away_team.get("tla", away_team.get("shortName", "UNK")),
            "flag": None,
            "logo": None,
            "crest": away_team.get("crest"),
        },
        "competition": competition.get("name", "Unknown"),
        "competitionCode": competition.get("code", ""),
        "competitionEmblem": competition.get("emblem"),
        "sport": "Football",
        "dateTime": _format_datetime(utc_date),
        "utcDate": utc_date,
        "status": STATUS_MAP.get(api_status, "NOT_STARTED"),
        "statusDetail": _get_match_status_detail(api_status),
        "matchMinute": _estimate_match_minute(utc_date, api_status),
        "score": {
            "home": home_score,
            "away": away_score,
            "halfTime": {
                "home": half_time.get("home"),
                "away": half_time.get("away"),
            },
        },
        "predictionLocked": _is_prediction_locked(utc_date, api_status),
        "lockReason": (
            "Match is live" if api_status in ("IN_PLAY", "PAUSED", "SUSPENDED") else
            "Match has ended" if api_status in ("FINISHED", "AWARDED") else
            "Prediction closed" if _is_prediction_locked(utc_date, api_status) else
            None
        ),
        "votes": {
            "home": {"count": home_votes, "percentage": home_pct},
            "draw": {"count": draw_votes, "percentage": draw_pct},
            "away": {"count": away_votes, "percentage": away_pct},
        },
        "totalVotes": total,
        "mostPicked": most_picked,
        "featured": False,  # Will be set by the caller
    }


async def get_matches(
    db,
    date_from: str = None,
    date_to: str = None,
    competition: str = None,
    status: str = None,
) -> list[dict]:
    """
    Fetch matches from Football-Data.org with caching.
    Returns transformed match data enriched with vote counts.
    """
    # Build cache key
    cache_key = f"matches:{date_from}:{date_to}:{competition}:{status}"

    # Determine cache TTL based on request type
    if status in ("LIVE", "IN_PLAY"):
        cache_ttl = 30  # 30 seconds for live
    else:
        cache_ttl = 120  # 2 minutes for others

    # Check cache
    cached = await cache.get(cache_key, cache_ttl)
    if cached is not None:
        return cached

    # Build API params
    params = {}
    if date_from:
        params["dateFrom"] = date_from
    if date_to:
        params["dateTo"] = date_to
    if status:
        params["status"] = status

    # Fetch matches
    if competition and competition in FREE_COMPETITIONS:
        comp_code = competition
        data = await _api_get(f"/competitions/{comp_code}/matches", params)
    else:
        # Fetch from all competitions for today/date range
        data = await _api_get("/matches", params)

    raw_matches = data.get("matches", [])

    if not raw_matches:
        # Return cached data even if expired rather than empty
        expired = await cache.get(cache_key, 3600)
        if expired:
            return expired
        return []

    # Get vote counts from our predictions DB
    match_ids = [m["id"] for m in raw_matches]
    vote_counts = await _get_vote_counts(db, match_ids)

    # Transform matches
    matches = [_transform_match(m, vote_counts) for m in raw_matches]

    # Mark top 2 by total votes as featured
    sorted_by_votes = sorted(matches, key=lambda m: m["totalVotes"], reverse=True)
    for i, m in enumerate(sorted_by_votes[:2]):
        m["featured"] = True

    # If no votes at all, mark first 2 as featured
    if all(m["totalVotes"] == 0 for m in matches) and len(matches) >= 2:
        matches[0]["featured"] = True
        if len(matches) > 1:
            matches[1]["featured"] = True

    # Cache result
    await cache.set(cache_key, matches)

    return matches


async def get_live_matches(db) -> list[dict]:
    """Fetch currently live matches"""
    return await get_matches(db, status="LIVE")


async def get_today_matches(db) -> list[dict]:
    """Fetch today's matches across all free competitions"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await get_matches(db, date_from=today, date_to=today)


async def get_upcoming_matches(db, days: int = 7) -> list[dict]:
    """Fetch upcoming matches for the next N days"""
    today = datetime.now(timezone.utc)
    date_from = today.strftime("%Y-%m-%d")
    date_to = (today + timedelta(days=days)).strftime("%Y-%m-%d")
    return await get_matches(db, date_from=date_from, date_to=date_to)


async def get_competition_matches(db, competition_code: str) -> list[dict]:
    """Fetch matches for a specific competition"""
    today = datetime.now(timezone.utc)
    date_from = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    date_to = (today + timedelta(days=14)).strftime("%Y-%m-%d")
    return await get_matches(
        db, date_from=date_from, date_to=date_to, competition=competition_code
    )


async def _get_vote_counts(db, match_ids: list[int]) -> dict:
    """Get aggregated vote counts for matches from our predictions DB"""
    if not match_ids:
        return {}

    pipeline = [
        {"$match": {"match_id": {"$in": match_ids}}},
        {
            "$group": {
                "_id": {"match_id": "$match_id", "prediction": "$prediction"},
                "count": {"$sum": 1},
            }
        },
    ]

    results = await db.predictions.aggregate(pipeline).to_list(1000)

    vote_counts = {}
    for r in results:
        mid = r["_id"]["match_id"]
        pred = r["_id"]["prediction"]
        if mid not in vote_counts:
            vote_counts[mid] = {"home": 0, "draw": 0, "away": 0}
        vote_counts[mid][pred] = r["count"]

    return vote_counts


def get_available_competitions() -> list[dict]:
    """Return list of competitions available on free tier"""
    return [
        {"code": v["code"], "name": v["name"], "id": v["id"]}
        for v in FREE_COMPETITIONS.values()
    ]
