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
    """Force fetch all matches from API"""
    global _last_fetched_matches
    today = datetime.now(timezone.utc)
    date_from = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    date_to = (today + timedelta(days=7)).strftime("%Y-%m-%d")
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
