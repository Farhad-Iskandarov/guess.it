"""
Weekly Competition Engine — Season management, rotation, archival, ranking.
All operations are non-blocking, index-based, and safe for 10K concurrent users.

Key design:
- Each week is a separate "season" (season_id = ISO week like "2026-W10")
- No mass update_many for reset — new season = clean slate
- Points tracked in weekly_user_points collection per (season_id, user_id)
- Rankings via compound index (season_id, weekly_points DESC) → O(log n)
- Archival runs as background task, stores precomputed top 100
"""
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from services.redis_pubsub import cache_get, cache_set, cache_delete, publish

logger = logging.getLogger(__name__)

CHANNEL_WEEKLY = "ws:weekly"


def get_current_season_id(dt: datetime = None) -> str:
    """Get ISO week-based season ID for the given datetime."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def get_season_boundaries(dt: datetime = None):
    """Get Monday 00:00 UTC start and next Monday 00:00 UTC end for the week."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    monday = dt - timedelta(days=dt.weekday())
    start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)
    return start, end


async def ensure_current_season(db: AsyncIOMotorDatabase) -> dict:
    """
    Ensure the current weekly season document exists.
    Creates it if missing. Returns the season document.
    This is idempotent — safe to call from any worker.
    """
    now = datetime.now(timezone.utc)
    season_id = get_current_season_id(now)
    start, end = get_season_boundaries(now)

    # Try to find existing season
    season = await db.weekly_seasons.find_one(
        {"season_id": season_id}, {"_id": 0}
    )
    if season:
        return season

    # Create new season (upsert to prevent race conditions)
    await db.weekly_seasons.update_one(
        {"season_id": season_id},
        {
            "$setOnInsert": {
                "season_id": season_id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "status": "active",
                "total_predictions": 0,
                "total_participants": 0,
                "finalized_at": None,
                "created_at": now.isoformat(),
            }
        },
        upsert=True,
    )
    logger.info(f"Created new weekly season: {season_id} ({start.date()} to {end.date()})")

    season = await db.weekly_seasons.find_one(
        {"season_id": season_id}, {"_id": 0}
    )
    return season


async def increment_user_weekly_points(
    db: AsyncIOMotorDatabase,
    user_id: str,
    points_delta: int,
    predictions_delta: int = 0,
    correct_delta: int = 0,
):
    """
    Atomically increment a user's weekly points for the current season.
    Uses upsert on (season_id, user_id) — no read-then-write.
    Also increments season-level counters atomically.
    """
    now = datetime.now(timezone.utc)
    season_id = get_current_season_id(now)

    # Atomic upsert into weekly_user_points
    await db.weekly_user_points.update_one(
        {"season_id": season_id, "user_id": user_id},
        {
            "$inc": {
                "weekly_points": points_delta,
                "predictions_count": predictions_delta,
                "correct_predictions": correct_delta,
            },
            "$setOnInsert": {
                "season_id": season_id,
                "user_id": user_id,
            },
            "$set": {
                "updated_at": now.isoformat(),
            },
        },
        upsert=True,
    )

    # Increment season-level prediction count (non-blocking)
    if predictions_delta > 0:
        await db.weekly_seasons.update_one(
            {"season_id": season_id},
            {"$inc": {"total_predictions": predictions_delta}},
        )

    # Invalidate cached leaderboard
    await cache_delete(f"leaderboard:weekly:season:{season_id}")

    # Publish event for real-time updates
    if points_delta != 0:
        await publish(CHANNEL_WEEKLY, {
            "type": "weekly_points_update",
            "user_id": user_id,
            "season_id": season_id,
            "points_delta": points_delta,
        })


async def get_user_season_rank(
    db: AsyncIOMotorDatabase,
    user_id: str,
    season_id: str = None,
) -> tuple:
    """
    Get user's rank and points for a season.
    Uses indexed count query: count users with higher weekly_points → O(log n).
    Returns (rank, points, predictions_count, correct_predictions).
    """
    if season_id is None:
        season_id = get_current_season_id()

    user_entry = await db.weekly_user_points.find_one(
        {"season_id": season_id, "user_id": user_id},
        {"_id": 0},
    )

    if not user_entry or user_entry.get("weekly_points", 0) == 0:
        return None, 0, 0, 0

    pts = user_entry["weekly_points"]

    # Rank = 1 + count of users with strictly more points (uses index)
    higher_count = await db.weekly_user_points.count_documents({
        "season_id": season_id,
        "weekly_points": {"$gt": pts},
    })

    return (
        higher_count + 1,
        pts,
        user_entry.get("predictions_count", 0),
        user_entry.get("correct_predictions", 0),
    )


async def get_weekly_leaderboard_cached(
    db: AsyncIOMotorDatabase,
    season_id: str = None,
    limit: int = 50,
) -> dict:
    """
    Get weekly leaderboard for a season, cached in Redis.
    Falls back to indexed MongoDB query on cache miss.
    """
    import json
    if season_id is None:
        season_id = get_current_season_id()

    cache_key = f"leaderboard:weekly:season:{season_id}:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    # Get season info
    season = await db.weekly_seasons.find_one(
        {"season_id": season_id}, {"_id": 0}
    )

    # Get top users for this season (indexed sort)
    entries = await db.weekly_user_points.find(
        {"season_id": season_id, "weekly_points": {"$gt": 0}},
        {"_id": 0},
    ).sort("weekly_points", -1).limit(limit).to_list(limit)

    # Enrich with user profile data (nickname, picture, level)
    user_ids = [e["user_id"] for e in entries]
    if user_ids:
        users_data = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "nickname": 1, "email": 1, "picture": 1, "level": 1, "points": 1},
        ).to_list(len(user_ids))
        user_map = {u["user_id"]: u for u in users_data}
    else:
        user_map = {}

    users = []
    for entry in entries:
        u = user_map.get(entry["user_id"], {})
        users.append({
            "user_id": entry["user_id"],
            "nickname": u.get("nickname") or u.get("email", "Unknown"),
            "email": u.get("email", ""),
            "picture": u.get("picture"),
            "level": u.get("level", 0),
            "points": u.get("points", 0),
            "weekly_points": entry["weekly_points"],
            "predictions_count": entry.get("predictions_count", 0),
            "correct_predictions": entry.get("correct_predictions", 0),
        })

    # Count total participants
    total_participants = await db.weekly_user_points.count_documents({
        "season_id": season_id, "weekly_points": {"$gt": 0}
    })

    result = {
        "season_id": season_id,
        "users": users,
        "total_participants": total_participants,
        "week_start": season["start_date"] if season else "",
        "week_end": season["end_date"] if season else "",
        "status": season["status"] if season else "active",
    }

    await cache_set(cache_key, json.dumps(result, default=str), ttl_seconds=15)
    return result


async def finalize_season(db: AsyncIOMotorDatabase, season_id: str):
    """
    Finalize a completed season:
    1. Mark season as completed
    2. Archive top 100 with precomputed ranks and percentiles
    3. Update participant count
    
    This runs ONCE per season in the background worker.
    """
    now = datetime.now(timezone.utc)

    # Check if already finalized
    season = await db.weekly_seasons.find_one(
        {"season_id": season_id}, {"_id": 0}
    )
    if not season or season.get("status") == "completed":
        return

    # Count total participants and predictions
    total_participants = await db.weekly_user_points.count_documents({
        "season_id": season_id, "weekly_points": {"$gt": 0}
    })
    total_all = await db.weekly_user_points.count_documents({
        "season_id": season_id
    })

    # Get top 100 for archive
    top_entries = await db.weekly_user_points.find(
        {"season_id": season_id, "weekly_points": {"$gt": 0}},
        {"_id": 0},
    ).sort("weekly_points", -1).limit(100).to_list(100)

    # Enrich with user profiles
    user_ids = [e["user_id"] for e in top_entries]
    if user_ids:
        users_data = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "nickname": 1, "email": 1, "picture": 1, "level": 1},
        ).to_list(len(user_ids))
        user_map = {u["user_id"]: u for u in users_data}
    else:
        user_map = {}

    top_100 = []
    for rank, entry in enumerate(top_entries, 1):
        u = user_map.get(entry["user_id"], {})
        percentile = round(((total_participants - rank) / max(total_participants, 1)) * 100, 1)
        top_100.append({
            "rank": rank,
            "user_id": entry["user_id"],
            "nickname": u.get("nickname") or u.get("email", "Unknown"),
            "picture": u.get("picture"),
            "level": u.get("level", 0),
            "points": entry["weekly_points"],
            "predictions_count": entry.get("predictions_count", 0),
            "correct_predictions": entry.get("correct_predictions", 0),
            "percentile": percentile,
        })

    winner = top_100[0] if top_100 else None

    # Sum total predictions from the season
    pipeline = [
        {"$match": {"season_id": season_id}},
        {"$group": {"_id": None, "total": {"$sum": "$predictions_count"}}},
    ]
    agg = await db.weekly_user_points.aggregate(pipeline).to_list(1)
    total_predictions = agg[0]["total"] if agg else 0

    # Store archive (upsert to prevent duplicates)
    await db.weekly_results_archive.update_one(
        {"season_id": season_id},
        {
            "$set": {
                "season_id": season_id,
                "top_100": top_100,
                "total_participants": total_participants,
                "total_predictions": total_predictions,
                "winner": winner,
                "season_start": season.get("start_date", ""),
                "season_end": season.get("end_date", ""),
                "generated_at": now.isoformat(),
            }
        },
        upsert=True,
    )

    # Mark season as completed
    await db.weekly_seasons.update_one(
        {"season_id": season_id},
        {"$set": {
            "status": "completed",
            "finalized_at": now.isoformat(),
            "total_participants": total_participants,
            "total_predictions": total_predictions,
        }},
    )

    logger.info(
        f"Season {season_id} finalized: {total_participants} participants, "
        f"{total_predictions} predictions, winner: {winner['nickname'] if winner else 'none'}"
    )


async def check_season_rotation(db: AsyncIOMotorDatabase):
    """
    Background check: if the current week differs from the latest active season,
    finalize the old season and create the new one.
    Called every 5 minutes from reminder worker.
    """
    now = datetime.now(timezone.utc)
    current_season_id = get_current_season_id(now)

    # Find the latest active season
    active = await db.weekly_seasons.find_one(
        {"status": "active"}, {"_id": 0}
    )

    if active and active["season_id"] != current_season_id:
        # Week has changed — finalize old season
        logger.info(f"Season rotation: {active['season_id']} -> {current_season_id}")
        await finalize_season(db, active["season_id"])

    # Ensure current season exists
    await ensure_current_season(db)


async def get_user_summary_for_season(
    db: AsyncIOMotorDatabase,
    user_id: str,
    season_id: str,
) -> dict:
    """
    Get a user's precomputed summary for a completed season.
    Uses the archive for top 100, or computes rank for users outside top 100.
    """
    archive = await db.weekly_results_archive.find_one(
        {"season_id": season_id}, {"_id": 0}
    )

    if not archive:
        return None

    total = archive.get("total_participants", 0)

    # Check if user is in top 100
    user_entry = None
    for entry in archive.get("top_100", []):
        if entry["user_id"] == user_id:
            user_entry = entry
            break

    if user_entry:
        rank = user_entry["rank"]
        points = user_entry["points"]
        percentile = user_entry.get("percentile", 0)
    else:
        # User not in top 100 — compute rank from weekly_user_points
        up = await db.weekly_user_points.find_one(
            {"season_id": season_id, "user_id": user_id},
            {"_id": 0},
        )
        if not up or up.get("weekly_points", 0) == 0:
            rank = None
            points = 0
            percentile = 0
        else:
            points = up["weekly_points"]
            higher = await db.weekly_user_points.count_documents({
                "season_id": season_id,
                "weekly_points": {"$gt": points},
            })
            rank = higher + 1
            percentile = round(((total - rank) / max(total, 1)) * 100, 1)

    # Get previous season for rank comparison
    prev_season_id = _get_previous_season_id(season_id)
    rank_change = None
    if prev_season_id and rank is not None:
        prev_archive = await db.weekly_results_archive.find_one(
            {"season_id": prev_season_id}, {"_id": 0}
        )
        if prev_archive:
            prev_entry = None
            for e in prev_archive.get("top_100", []):
                if e["user_id"] == user_id:
                    prev_entry = e
                    break
            if prev_entry:
                rank_change = prev_entry["rank"] - rank  # positive = improved

    return {
        "season_id": season_id,
        "season_start": archive.get("season_start", ""),
        "season_end": archive.get("season_end", ""),
        "total_participants": total,
        "total_predictions": archive.get("total_predictions", 0),
        "winner": archive.get("winner"),
        "top_10": archive.get("top_100", [])[:10],
        "user_final_rank": rank,
        "user_total_points": points,
        "user_percentile": percentile,
        "user_rank_change": rank_change,
    }


def _get_previous_season_id(season_id: str) -> str:
    """Get the previous week's season_id."""
    try:
        parts = season_id.split("-W")
        year = int(parts[0])
        week = int(parts[1])
        if week == 1:
            # Go to last week of previous year
            from datetime import date
            dec31 = date(year - 1, 12, 31)
            prev_week = dec31.isocalendar()[1]
            return f"{year - 1}-W{prev_week:02d}"
        else:
            return f"{year}-W{week - 1:02d}"
    except Exception:
        return None
