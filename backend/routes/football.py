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
        """Send data to all connected clients"""
        async with self._lock:
            connections = list(self.active_connections)

        disconnected = []
        for connection in connections:
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            await self.disconnect(conn)


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
    """
    # Default: yesterday + next 7 days if no dates provided
    if not date_from and not date_to:
        today = datetime.now(timezone.utc)
        date_from = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        date_to = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    
    comp = request.query_params.get('competition', competition)
    matches = await get_matches(db, date_from, date_to, comp, status)
    
    return {"matches": matches, "total": len(matches)}


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
    """Get global leaderboard - top users by points"""
    users = await db.users.find(
        {},
        {"_id": 0, "user_id": 1, "nickname": 1, "email": 1, "picture": 1, 
         "points": 1, "level": 1, "predictions_count": 1, "correct_predictions": 1}
    ).sort("points", -1).limit(limit).to_list(limit)
    
    return {"users": users}


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
    Search matches by team name.
    - Case-insensitive
    - Only LIVE and NOT_STARTED matches
    - Max 10 results
    """
    query = q.strip().lower()

    # Use cached upcoming matches (7-day window)
    today = datetime.now(timezone.utc)
    date_from = today.strftime("%Y-%m-%d")
    date_to = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    all_matches = await get_matches(db, date_from=date_from, date_to=date_to)

    # Filter by team name and status
    results = []
    for match in all_matches:
        if match["status"] == "FINISHED":
            continue

        home_name = match["homeTeam"]["name"].lower()
        away_name = match["awayTeam"]["name"].lower()
        home_short = (match["homeTeam"].get("shortName") or "").lower()
        away_short = (match["awayTeam"].get("shortName") or "").lower()

        if query in home_name or query in away_name or query in home_short or query in away_short:
            results.append(match)

        if len(results) >= 10:
            break

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

    # Enrich with votes
    vote_counts = await _get_vote_counts(db, [match_id])
    match = _enrich_with_votes(match, vote_counts)

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
