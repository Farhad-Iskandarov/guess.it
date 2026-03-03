"""
Weekly Competition API Routes.
All endpoints are cached in Redis and use indexed queries only.
"""
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from services.weekly_engine import (
    get_current_season_id,
    get_season_boundaries,
    ensure_current_season,
    get_user_season_rank,
    get_weekly_leaderboard_cached,
    get_user_summary_for_season,
)
from services.redis_pubsub import cache_get, cache_set
from routes.auth import validate_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/weekly", tags=["Weekly Competition"])


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db


async def get_current_user_optional(request: Request, db: AsyncIOMotorDatabase):
    """Get current user if authenticated, None otherwise."""
    try:
        session = await validate_session(request, db)
        if session:
            user = await db.users.find_one(
                {"user_id": session["user_id"]}, {"_id": 0}
            )
            return user
    except Exception:
        pass
    return None


@router.get("/status")
async def weekly_status(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get current weekly competition status.
    Cached in Redis (10s TTL) — safe for 10K concurrent requests.
    Authenticated users get their personal rank included.
    """
    now = datetime.now(timezone.utc)
    season_id = get_current_season_id(now)

    # Try user auth (optional — unauthenticated users get generic status)
    user = await get_current_user_optional(request, db)
    user_id = user["user_id"] if user else None

    # Base status is cached globally (10s)
    cache_key = f"weekly:status:{season_id}"
    cached = await cache_get(cache_key)
    base = None
    if cached:
        try:
            base = json.loads(cached)
        except Exception:
            pass

    if not base:
        season = await ensure_current_season(db)
        start, end = get_season_boundaries(now)
        ends_in = max(0, int((end - now).total_seconds()))

        # Count participants (cached with the base response)
        total_participants = await db.weekly_user_points.count_documents({
            "season_id": season_id, "weekly_points": {"$gt": 0}
        })

        base = {
            "current_season_id": season_id,
            "season_status": season.get("status", "active"),
            "starts_at": start.isoformat(),
            "ends_at": end.isoformat(),
            "ends_in_seconds": ends_in,
            "total_participants": total_participants,
            "total_predictions": season.get("total_predictions", 0),
        }
        await cache_set(cache_key, json.dumps(base, default=str), ttl_seconds=10)

    # Recalculate ends_in_seconds with fresh timestamp
    try:
        end_dt = datetime.fromisoformat(base["ends_at"])
        base["ends_in_seconds"] = max(0, int((end_dt - now).total_seconds()))
    except Exception:
        pass

    # Add user-specific data if authenticated
    if user_id:
        rank, pts, preds, correct = await get_user_season_rank(db, user_id, season_id)
        base["user_current_rank"] = rank
        base["user_weekly_points"] = pts
        base["user_predictions_count"] = preds
    else:
        base["user_current_rank"] = None
        base["user_weekly_points"] = 0
        base["user_predictions_count"] = 0

    return base


@router.get("/leaderboard")
async def weekly_leaderboard(
    limit: int = 50,
    season_id: str = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get weekly leaderboard for current or specific season.
    Fully cached in Redis (15s TTL).
    Uses indexed sort on (season_id, weekly_points DESC) → O(log n).
    """
    if season_id is None:
        season_id = get_current_season_id()
    limit = min(limit, 100)

    return await get_weekly_leaderboard_cached(db, season_id, limit)


@router.get("/summary/{season_id}")
async def weekly_summary(
    season_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get summary for a completed season.
    All data is precomputed during archival — zero heavy queries.
    Includes user-specific rank, percentile, and rank change vs previous week.
    """
    user = await get_current_user_optional(request, db)
    user_id = user["user_id"] if user else None

    # Check cache
    cache_key = f"weekly:summary:{season_id}:{user_id or 'anon'}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    if user_id:
        result = await get_user_summary_for_season(db, user_id, season_id)
    else:
        # Anonymous: just return archive data
        archive = await db.weekly_results_archive.find_one(
            {"season_id": season_id}, {"_id": 0}
        )
        if not archive:
            raise HTTPException(status_code=404, detail="Season not found or not yet finalized")
        result = {
            "season_id": season_id,
            "season_start": archive.get("season_start", ""),
            "season_end": archive.get("season_end", ""),
            "total_participants": archive.get("total_participants", 0),
            "total_predictions": archive.get("total_predictions", 0),
            "winner": archive.get("winner"),
            "top_10": archive.get("top_100", [])[:10],
            "user_final_rank": None,
            "user_total_points": 0,
            "user_percentile": None,
            "user_rank_change": None,
        }

    if not result:
        raise HTTPException(status_code=404, detail="Season not found or not yet finalized")

    await cache_set(cache_key, json.dumps(result, default=str), ttl_seconds=60)
    return result


@router.get("/history")
async def weekly_history(
    limit: int = 10,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get list of past completed seasons.
    Returns season_id, dates, winner info, participant count.
    """
    cache_key = f"weekly:history:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    seasons = await db.weekly_seasons.find(
        {"status": "completed"},
        {"_id": 0, "season_id": 1, "start_date": 1, "end_date": 1,
         "total_participants": 1, "total_predictions": 1, "finalized_at": 1},
    ).sort("end_date", -1).limit(limit).to_list(limit)

    # Attach winner info from archives
    season_ids = [s["season_id"] for s in seasons]
    archives = await db.weekly_results_archive.find(
        {"season_id": {"$in": season_ids}},
        {"_id": 0, "season_id": 1, "winner": 1},
    ).to_list(len(season_ids))
    winner_map = {a["season_id"]: a.get("winner") for a in archives}

    for s in seasons:
        s["winner"] = winner_map.get(s["season_id"])

    result = {"seasons": seasons}
    await cache_set(cache_key, json.dumps(result, default=str), ttl_seconds=60)
    return result
