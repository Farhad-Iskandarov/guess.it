"""
Football API Routes + WebSocket for live updates
"""
from fastapi import APIRouter, Request, Depends, WebSocket, WebSocketDisconnect, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio
import logging
import json
from datetime import datetime, timezone, timedelta

from services.football_api import (
    get_matches,
    get_live_matches,
    get_today_matches,
    get_upcoming_matches,
    get_competition_matches,
    get_available_competitions,
    get_match_by_id,
    _get_active_config,
    _detect_provider,
    _normalize_base_url,
    _http_get,
    _enrich_with_votes,
    _get_vote_counts,
    PROVIDER_FDO,
    AFS_LEAGUE_IDS,
    COMPETITION_CODES,
    cache,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/football", tags=["Football"])


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db


# ==================== WebSocket Manager ====================

class ConnectionManager:
    """Manages WebSocket connections for live match updates"""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        """Send data to all connected clients using parallel async dispatch."""
        async with self._lock:
            connections = list(self.active_connections)

        if not connections:
            return

        async def _safe_send(conn):
            try:
                await asyncio.wait_for(conn.send_json(data), timeout=5.0)
            except Exception:
                return conn
            return None

        results = await asyncio.gather(
            *(_safe_send(conn) for conn in connections),
            return_exceptions=True,
        )

        # Clean up failed connections
        for result in results:
            if isinstance(result, WebSocket):
                await self.disconnect(result)


manager = ConnectionManager()


# ==================== Background Polling Task ====================

_polling_task = None
_polling_active = False


async def _poll_live_matches(db):
    """Background task to poll for live match updates"""
    global _polling_active
    _polling_active = True

    logger.info("Live match polling started")
    
    # Track processed finished matches to avoid duplicate processing
    processed_finished_matches = set()
    last_finished_check = datetime.now(timezone.utc)

    while _polling_active:
        try:
            if len(manager.active_connections) > 0:
                # Fetch live matches
                live_matches = await get_live_matches(db)

                if live_matches:
                    await manager.broadcast({
                        "type": "live_update",
                        "matches": live_matches,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

                # Also fetch today's matches (less frequently via cache)
                today_matches = await get_today_matches(db)
                if today_matches:
                    await manager.broadcast({
                        "type": "today_update",
                        "matches": today_matches,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    
                    # Check for newly finished matches and process exact score predictions
                    for match in today_matches:
                        if match.get("status") == "FINISHED":
                            match_id = match.get("id")
                            if match_id and match_id not in processed_finished_matches:
                                score = match.get("score", {})
                                home_score = score.get("home")
                                away_score = score.get("away")
                                
                                if home_score is not None and away_score is not None:
                                    try:
                                        from services.prediction_processor import process_exact_score_results
                                        await process_exact_score_results(db, match_id, home_score, away_score)
                                        processed_finished_matches.add(match_id)
                                        logger.info(f"Processed exact scores for finished match {match_id}")
                                    except Exception as e:
                                        logger.error(f"Error processing exact scores for match {match_id}: {e}")

            # Poll every 30 seconds
            await asyncio.sleep(30)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Polling error: {e}")
            await asyncio.sleep(30)

    logger.info("Live match polling stopped")


def start_polling(db):
    """Start the background polling task"""
    global _polling_task
    if _polling_task is None or _polling_task.done():
        _polling_task = asyncio.create_task(_poll_live_matches(db))


def stop_polling():
    """Stop the background polling task"""
    global _polling_active, _polling_task
    _polling_active = False
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()


# ==================== Admin Helpers ====================
_last_fetched_matches = []

def get_cached_matches():
    """Return last fetched matches for admin panel"""
    return list(_last_fetched_matches)

async def force_fetch_matches(db):
    """Force fetch all matches from API (clears cache first)"""
    global _last_fetched_matches
    from services.football_api import clear_cache_and_reset
    await clear_cache_and_reset()
    today = datetime.now(timezone.utc)
    date_from = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    date_to = (today + timedelta(days=3)).strftime("%Y-%m-%d")
    matches = await get_matches(db, date_from, date_to)
    _last_fetched_matches = matches
    return len(matches)



# ==================== REST Endpoints ====================

@router.get("/competitions")
async def list_competitions():
    """Get available competitions (free tier)"""
    return {"competitions": get_available_competitions()}


@router.get("/matches")
async def list_matches(
    request: Request,
    date_from: str = None,
    date_to: str = None,
    competition: str = None,
    status: str = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get matches with optional filters.
    - date_from/date_to: YYYY-MM-DD
    - competition: Competition code (PL, CL, SA, etc.)
    - status: LIVE, FINISHED, etc.

    When no dates specified, fetches two ranges to ensure upcoming matches
    are captured even during international breaks (football-data.org 10-day limit):
      Range 1: past 3 days → +6 days (recent results + this week)
      Range 2: +7 days → +14 days (upcoming after break)
    """
    comp = request.query_params.get('competition', competition)

    if date_from or date_to:
        # Explicit dates — single fetch
        matches = await get_matches(db, date_from, date_to, comp, status)
        return {"matches": matches, "total": len(matches)}

    # Default: fetch two non-overlapping ranges in parallel, merge & deduplicate
    today = datetime.now(timezone.utc)
    near_from = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    near_to   = (today + timedelta(days=6)).strftime("%Y-%m-%d")
    far_from  = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    far_to    = (today + timedelta(days=14)).strftime("%Y-%m-%d")

    near_matches, far_matches = await asyncio.gather(
        get_matches(db, near_from, near_to, comp, status),
        get_matches(db, far_from, far_to, comp, status),
    )

    # Merge & deduplicate by match id
    seen = set()
    merged = []
    for m in near_matches + far_matches:
        if m["id"] not in seen:
            seen.add(m["id"])
            merged.append(m)

    # Sort: live first, then upcoming (soonest first), then finished (most recent first)
    def sort_key(m):
        s = m.get("status", "")
        if s == "LIVE":
            return (0, m.get("utcDate", ""))
        elif s in ("NOT_STARTED", "TIMED", "SCHEDULED"):
            return (1, m.get("utcDate", ""))
        else:
            return (2, m.get("utcDate", ""))
    merged.sort(key=sort_key)

    return {"matches": merged, "total": len(merged)}


@router.get("/banners")
async def get_active_banners(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get active carousel banners for public display"""
    banners = await db.carousel_banners.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(20)
    
    return {"banners": banners}



@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get global leaderboard - top users by points. Cached in Redis for 30s.
    Accuracy is computed from actual prediction results vs finished match scores."""
    from services.redis_pubsub import cache_get, cache_set
    import json as _json

    cache_key = f"leaderboard:global:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return _json.loads(cached)
        except Exception:
            pass

    users = await db.users.find(
        {},
        {"_id": 0, "user_id": 1, "nickname": 1, "email": 1, "picture": 1,
         "points": 1, "level": 1}
    ).sort("points", -1).limit(limit).to_list(limit)

    # ==== Compute predictions_count & correct_predictions for ALL returned users ====
    user_ids = [u["user_id"] for u in users]
    if user_ids:
        # Pull all predictions for these users
        preds = await db.predictions.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "match_id": 1, "prediction": 1}
        ).to_list(50000)

        # Fetch all referenced matches from persistent cache
        match_ids = list({p["match_id"] for p in preds})
        match_map = {}
        if match_ids:
            cached_matches = await db.football_matches_cache.find(
                {"id": {"$in": match_ids}},
                {"_id": 0, "id": 1, "status": 1, "score": 1}
            ).to_list(len(match_ids))
            match_map = {m["id"]: m for m in cached_matches}

        # Aggregate per user
        stats = {uid: {"total": 0, "correct": 0} for uid in user_ids}
        for p in preds:
            m = match_map.get(p["match_id"])
            if not m or m.get("status") not in ("FINISHED", "AFTER_EXTRA_TIME", "PENALTY_SHOOTOUT"):
                continue
            score = m.get("score") or {}
            h, a = score.get("home"), score.get("away")
            if h is None or a is None:
                continue
            actual = "draw" if h == a else ("home" if h > a else "away")
            uid = p["user_id"]
            if uid in stats:
                stats[uid]["total"] += 1
                if p.get("prediction") == actual:
                    stats[uid]["correct"] += 1

        for u in users:
            s = stats.get(u["user_id"], {"total": 0, "correct": 0})
            u["predictions_count"] = s["total"]
            u["correct_predictions"] = s["correct"]

    result = {"users": users}
    await cache_set(cache_key, _json.dumps(result, default=str), ttl_seconds=30)
    return result


@router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(
    limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get weekly leaderboard — delegates to season-based weekly competition engine."""
    from services.weekly_engine import get_weekly_leaderboard_cached, get_current_season_id
    season_id = get_current_season_id()
    return await get_weekly_leaderboard_cached(db, season_id, min(limit, 100))


@router.get("/leaderboard/check-rank")
async def check_global_rank(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Check if user's global leaderboard rank changed (top 100 only)"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        return {"rank": None}

    from routes.auth import validate_session
    session = await validate_session(db, session_token)
    if not session:
        return {"rank": None}

    user_id = session["user_id"]
    user = session  # validate_session returns full user
    if not user:
        return {"rank": None}

    # Count users with more points
    rank = await db.users.count_documents({"points": {"$gt": user.get("points", 0)}}) + 1

    if rank > 100:
        return {"rank": rank, "in_top_100": False}

    # Check for rank change
    prev_key = f"global_rank:{user_id}"
    prev = await db.rank_tracking.find_one({"key": prev_key}, {"_id": 0})
    old_rank = prev.get("rank") if prev else None
    notification_sent = False

    if old_rank and old_rank != rank:
        from routes.notifications import create_notification
        if rank < old_rank:
            msg = f"You are now #{rank} in Global Leaderboard!"
        else:
            msg = f"You dropped to #{rank} in Global Leaderboard"
        try:
            await create_notification(db, user_id, "leaderboard_global", msg,
                                      {"rank": rank, "old_rank": old_rank})
            notification_sent = True
        except Exception:
            pass

    await db.rank_tracking.update_one(
        {"key": prev_key},
        {"$set": {"key": prev_key, "rank": rank, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    return {"rank": rank, "in_top_100": True, "old_rank": old_rank, "notification_sent": notification_sent}


@router.get("/matches/today")
async def today_matches(
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get today's matches"""
    matches = await get_today_matches(db)
    return {"matches": matches, "total": len(matches)}


@router.get("/matches/live")
async def live_matches(
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get live matches"""
    matches = await get_live_matches(db)
    return {"matches": matches, "total": len(matches)}


@router.get("/matches/upcoming")
async def upcoming_matches(
    days: int = Query(default=7, ge=1, le=14),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get upcoming matches for the next N days"""
    matches = await get_upcoming_matches(db, days)
    return {"matches": matches, "total": len(matches)}


@router.get("/matches/competition/{code}")
async def competition_matches(
    code: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get matches for a specific competition"""
    matches = await get_competition_matches(db, code)
    return {"matches": matches, "total": len(matches)}


@router.get("/search")
async def search_matches(
    q: str = Query(min_length=2, max_length=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Search matches by team name or competition name.
    - Case-insensitive, partial match
    - Searches full dataset (past 3 days → future 14 days)
    - Results ranked: LIVE first, then upcoming, then finished
    - Max 20 results
    """
    query = q.strip().lower()

    # Fetch the full dataset (same ranges as the main /matches endpoint)
    today = datetime.now(timezone.utc)
    near_from = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    near_to = (today + timedelta(days=6)).strftime("%Y-%m-%d")
    far_from = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    far_to = (today + timedelta(days=14)).strftime("%Y-%m-%d")

    near_matches, far_matches = await asyncio.gather(
        get_matches(db, near_from, near_to),
        get_matches(db, far_from, far_to),
    )

    # Deduplicate
    seen = set()
    all_matches = []
    for m in near_matches + far_matches:
        if m["id"] not in seen:
            seen.add(m["id"])
            all_matches.append(m)

    # Also check the MongoDB persistent cache for broader coverage
    if len(all_matches) < 5:
        try:
            db_matches = await db.football_matches_cache.find(
                {"$or": [
                    {"homeTeam.name": {"$regex": query, "$options": "i"}},
                    {"awayTeam.name": {"$regex": query, "$options": "i"}},
                    {"homeTeam.shortName": {"$regex": query, "$options": "i"}},
                    {"awayTeam.shortName": {"$regex": query, "$options": "i"}},
                    {"competition": {"$regex": query, "$options": "i"}},
                ]},
                {"_id": 0}
            ).to_list(20)
            for m in db_matches:
                if m.get("id") and m["id"] not in seen:
                    seen.add(m["id"])
                    all_matches.append(m)
        except Exception:
            pass

    # Filter by team name or competition name (case-insensitive partial match)
    results = []
    for match in all_matches:
        home_name = (match.get("homeTeam", {}).get("name") or "").lower()
        away_name = (match.get("awayTeam", {}).get("name") or "").lower()
        home_short = (match.get("homeTeam", {}).get("shortName") or "").lower()
        away_short = (match.get("awayTeam", {}).get("shortName") or "").lower()
        competition = (match.get("competition") or "").lower()

        if (query in home_name or query in away_name or
            query in home_short or query in away_short or
            query in competition):
            results.append(match)

    # Sort: LIVE first, then upcoming (soonest), then finished (most recent)
    def sort_key(m):
        s = m.get("status", "")
        if s == "LIVE":
            return (0, m.get("utcDate", ""))
        elif s in ("NOT_STARTED", "TIMED", "SCHEDULED"):
            return (1, m.get("utcDate", ""))
        else:
            return (2, m.get("utcDate", ""))
    results.sort(key=sort_key)

    # Limit to 20 results
    results = results[:20]

    return {"matches": results, "total": len(results), "query": q}


@router.get("/matches/ended")
async def ended_matches(
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get recently finished matches (within the last 24 hours)"""
    today = datetime.now(timezone.utc)
    yesterday = today - timedelta(hours=24)
    date_from = yesterday.strftime("%Y-%m-%d")
    date_to = today.strftime("%Y-%m-%d")

    all_matches = await get_matches(db, date_from=date_from, date_to=date_to)

    # Filter only finished matches
    finished = [m for m in all_matches if m.get("status") == "FINISHED"]

    # Sort by utcDate descending (most recent first)
    finished.sort(key=lambda m: m.get("utcDate", ""), reverse=True)

    return {"matches": finished, "total": len(finished)}



@router.get("/match/{match_id}")
async def get_single_match(
    match_id: int,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get a single match by ID, enriched with vote counts."""
    match = await get_match_by_id(db, match_id)
    if not match:
        # Try finding it in the cached matches list
        today = datetime.now(timezone.utc)
        date_from = (today - timedelta(days=3)).strftime("%Y-%m-%d")
        date_to = (today + timedelta(days=7)).strftime("%Y-%m-%d")
        all_matches = await get_matches(db, date_from, date_to)
        match = next((m for m in all_matches if m.get("id") == match_id), None)

    if not match:
        return {"match": None}

    # Enrich with votes + dynamic points
    vote_counts = await _get_vote_counts(db, [match_id])
    pts_config = await db.points_config.find_one({"config_id": "default_points"}, {"_id": 0})
    base_pts = pts_config.get("correct_prediction", 50) if pts_config else 50
    match = _enrich_with_votes(match, vote_counts, base_pts)

    return {"match": match}


@router.get("/standings/{competition_code}")
async def get_standings(
    competition_code: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get league standings for a competition."""
    cache_key = f"standings:{competition_code}"
    cached = await cache.get(cache_key, 3600)
    if cached is not None:
        return {"standings": cached, "competition": competition_code}

    config = await _get_active_config(db)
    provider = _detect_provider(config.get("base_url", ""))

    standings = []

    if provider == PROVIDER_FDO:
        base_url = _normalize_base_url(config.get("base_url", "https://api.football-data.org/v4"))
        api_key = config.get("api_key", "")
        data = await _http_get(
            f"{base_url}/competitions/{competition_code}/standings",
            {"X-Auth-Token": api_key}
        )
        if data and "standings" in data:
            for table in data["standings"]:
                if table.get("type") == "TOTAL":
                    for entry in table.get("table", []):
                        standings.append({
                            "position": entry.get("position"),
                            "team": entry.get("team", {}).get("name", ""),
                            "teamCrest": entry.get("team", {}).get("crest", ""),
                            "teamId": entry.get("team", {}).get("id"),
                            "played": entry.get("playedGames", 0),
                            "won": entry.get("won", 0),
                            "draw": entry.get("draw", 0),
                            "lost": entry.get("lost", 0),
                            "goalsFor": entry.get("goalsFor", 0),
                            "goalsAgainst": entry.get("goalsAgainst", 0),
                            "goalDifference": entry.get("goalDifference", 0),
                            "points": entry.get("points", 0),
                        })
                    break
    else:
        league_id = AFS_LEAGUE_IDS.get(competition_code)
        if league_id:
            base_url = config.get("base_url", "https://v3.football.api-sports.io").rstrip("/")
            api_key = config.get("api_key", "")
            current_year = datetime.now(timezone.utc).year
            data = await _http_get(
                f"{base_url}/standings",
                {"x-apisports-key": api_key},
                {"league": league_id, "season": current_year}
            )
            # Try previous year if current returns empty
            responses = data.get("response", [])
            if not responses:
                data = await _http_get(
                    f"{base_url}/standings",
                    {"x-apisports-key": api_key},
                    {"league": league_id, "season": current_year - 1}
                )
                responses = data.get("response", [])

            if responses:
                league_data = responses[0].get("league", {})
                for standing_group in league_data.get("standings", []):
                    for entry in standing_group:
                        team = entry.get("team", {})
                        all_stats = entry.get("all", {})
                        standings.append({
                            "position": entry.get("rank"),
                            "team": team.get("name", ""),
                            "teamCrest": team.get("logo", ""),
                            "teamId": team.get("id"),
                            "played": all_stats.get("played", 0),
                            "won": all_stats.get("win", 0),
                            "draw": all_stats.get("draw", 0),
                            "lost": all_stats.get("lose", 0),
                            "goalsFor": all_stats.get("goals", {}).get("for", 0),
                            "goalsAgainst": all_stats.get("goals", {}).get("against", 0),
                            "goalDifference": entry.get("goalsDiff", 0),
                            "points": entry.get("points", 0),
                        })
                    break

    if standings:
        await cache.set(cache_key, standings)

    return {"standings": standings, "competition": competition_code}
