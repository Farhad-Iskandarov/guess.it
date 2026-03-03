"""
Reminder Engine - Background behavioral notification system.

Runs periodic checks for:
1. Pre-kickoff reminders (bookmarked matches, 30 min before)
2. Favorite club match day notifications
3. Favorite club urgency reminders (1 hour before)
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Track running state
_task = None
_running = False
INTERVAL_SECONDS = 300  # 5 minutes


async def _send_notification(db, user_id: str, notif_type: str, message: str, data: dict):
    """Create notification and push via WebSocket. Dedup by type+match+user."""
    from routes.notifications import create_notification
    await create_notification(db, user_id, notif_type, message, data)
    logger.info(f"Reminder sent: type={notif_type} user={user_id} match={data.get('match_id')}")


async def _get_upcoming_matches(db, minutes_ahead: int):
    """Get matches from cache that start within the given time window."""
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(minutes=minutes_ahead)
    # football_matches_cache stores match data with utcDate as string
    matches = await db.football_matches_cache.find(
        {"status": {"$in": ["TIMED", "SCHEDULED", "NOT_STARTED"]}},
        {"_id": 0}
    ).to_list(500)

    result = []
    for m in matches:
        utc_str = m.get("utcDate", "")
        if not utc_str:
            continue
        try:
            kickoff = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
            if kickoff.tzinfo is None:
                kickoff = kickoff.replace(tzinfo=timezone.utc)
            if now < kickoff <= window_end:
                m["_kickoff"] = kickoff
                result.append(m)
        except Exception:
            continue
    return result


async def _get_todays_matches(db):
    """Get matches from cache that are scheduled for today (UTC)."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    matches = await db.football_matches_cache.find(
        {"status": {"$in": ["TIMED", "SCHEDULED", "NOT_STARTED", "LIVE", "IN_PLAY"]}},
        {"_id": 0}
    ).to_list(500)

    result = []
    for m in matches:
        utc_str = m.get("utcDate", "")
        if not utc_str:
            continue
        try:
            kickoff = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
            if kickoff.tzinfo is None:
                kickoff = kickoff.replace(tzinfo=timezone.utc)
            if today_start <= kickoff < today_end:
                m["_kickoff"] = kickoff
                result.append(m)
        except Exception:
            continue
    return result


async def check_pre_kickoff_reminders(db):
    """
    PART 1: Pre-kickoff reminder for bookmarked matches.
    If user bookmarked a match AND hasn't predicted AND 30 min remain → notify.
    """
    matches = await _get_upcoming_matches(db, minutes_ahead=35)
    if not matches:
        return

    now = datetime.now(timezone.utc)

    for match in matches:
        match_id = match.get("id")
        kickoff = match["_kickoff"]
        remaining_min = (kickoff - now).total_seconds() / 60

        # Only trigger within 30-minute window
        if remaining_min > 30:
            continue

        home = match.get("homeTeam", {}).get("name", "Home")
        away = match.get("awayTeam", {}).get("name", "Away")

        # Find users who bookmarked this match
        bookmarks = await db.favorite_matches.find(
            {"match_id": match_id},
            {"_id": 0, "user_id": 1}
        ).to_list(1000)

        if not bookmarks:
            continue

        user_ids = [b["user_id"] for b in bookmarks]

        # Batch: find users who already predicted
        predicted = await db.predictions.find(
            {"match_id": match_id, "user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1}
        ).to_list(1000)
        predicted_ids = {p["user_id"] for p in predicted}

        # Batch: find users already reminded for this match
        already_notified = await db.notifications.find(
            {
                "type": "pre_kickoff_reminder",
                "data.match_id": match_id,
                "user_id": {"$in": user_ids}
            },
            {"_id": 0, "user_id": 1}
        ).to_list(1000)
        notified_ids = {n["user_id"] for n in already_notified}

        # Filter: bookmarked AND not predicted AND not yet reminded
        to_notify = [uid for uid in user_ids if uid not in predicted_ids and uid not in notified_ids]

        mins = int(remaining_min)
        for uid in to_notify:
            await _send_notification(db, uid, "pre_kickoff_reminder",
                f"Last chance to predict! {home} vs {away} starts in {mins} minutes",
                {
                    "match_id": match_id,
                    "home_team": home,
                    "away_team": away,
                    "kickoff": match.get("utcDate", ""),
                    "competition": match.get("competition", {}).get("name", ""),
                }
            )


async def check_favorite_club_matchday(db):
    """
    PART 2A: Favorite club match day notification.
    If user's favorite club plays today → send morning notification (once per day per match).
    """
    matches = await _get_todays_matches(db)
    if not matches:
        return

    # Build map: team_id → list of matches
    team_matches = {}
    for m in matches:
        for side in ("homeTeam", "awayTeam"):
            tid = m.get(side, {}).get("id")
            if tid:
                team_matches.setdefault(tid, []).append(m)

    if not team_matches:
        return

    # Get all favorite clubs that match today's teams
    team_ids = list(team_matches.keys())
    favorites = await db.favorites.find(
        {"team_id": {"$in": team_ids}},
        {"_id": 0, "user_id": 1, "team_id": 1, "team_name": 1}
    ).to_list(5000)

    if not favorites:
        return

    # Group by user
    user_favs = {}
    for fav in favorites:
        user_favs.setdefault(fav["user_id"], []).append(fav)

    for user_id, fav_list in user_favs.items():
        for fav in fav_list:
            club_matches = team_matches.get(fav["team_id"], [])
            for match in club_matches:
                match_id = match.get("id")
                home = match.get("homeTeam", {}).get("name", "Home")
                away = match.get("awayTeam", {}).get("name", "Away")
                club_name = fav.get("team_name", "your favorite club")

                # Check if already notified today for this match
                already = await db.notifications.count_documents({
                    "type": "favorite_club_matchday",
                    "user_id": user_id,
                    "data.match_id": match_id
                })
                if already > 0:
                    continue

                opponent = away if match.get("homeTeam", {}).get("id") == fav["team_id"] else home
                await _send_notification(db, user_id, "favorite_club_matchday",
                    f"Your favorite club {club_name} plays against {opponent} today!",
                    {
                        "match_id": match_id,
                        "home_team": home,
                        "away_team": away,
                        "club_name": club_name,
                        "kickoff": match.get("utcDate", ""),
                        "competition": match.get("competition", {}).get("name", ""),
                    }
                )


async def check_favorite_club_urgency(db):
    """
    PART 2B: Favorite club urgency reminder (1 hour before kickoff).
    If user's favorite club match is in ≤60 min AND user hasn't predicted → notify.
    """
    matches = await _get_upcoming_matches(db, minutes_ahead=65)
    if not matches:
        return

    now = datetime.now(timezone.utc)

    # Build team → match map for matches within 60 min
    team_matches = {}
    for m in matches:
        remaining_min = (m["_kickoff"] - now).total_seconds() / 60
        if remaining_min > 60:
            continue
        for side in ("homeTeam", "awayTeam"):
            tid = m.get(side, {}).get("id")
            if tid:
                team_matches.setdefault(tid, []).append(m)

    if not team_matches:
        return

    team_ids = list(team_matches.keys())
    favorites = await db.favorites.find(
        {"team_id": {"$in": team_ids}},
        {"_id": 0, "user_id": 1, "team_id": 1, "team_name": 1}
    ).to_list(5000)

    if not favorites:
        return

    user_favs = {}
    for fav in favorites:
        user_favs.setdefault(fav["user_id"], []).append(fav)

    for user_id, fav_list in user_favs.items():
        for fav in fav_list:
            club_matches = team_matches.get(fav["team_id"], [])
            for match in club_matches:
                match_id = match.get("id")
                home = match.get("homeTeam", {}).get("name", "Home")
                away = match.get("awayTeam", {}).get("name", "Away")
                club_name = fav.get("team_name", "your favorite club")
                remaining_min = int((match["_kickoff"] - now).total_seconds() / 60)

                # Check if user already predicted
                predicted = await db.predictions.count_documents({
                    "match_id": match_id, "user_id": user_id
                })
                if predicted > 0:
                    continue

                # Check if already notified
                already = await db.notifications.count_documents({
                    "type": "favorite_club_urgency",
                    "user_id": user_id,
                    "data.match_id": match_id
                })
                if already > 0:
                    continue

                await _send_notification(db, user_id, "favorite_club_urgency",
                    f"{remaining_min} min left to predict {club_name}'s match! {home} vs {away}",
                    {
                        "match_id": match_id,
                        "home_team": home,
                        "away_team": away,
                        "club_name": club_name,
                        "kickoff": match.get("utcDate", ""),
                        "competition": match.get("competition", {}).get("name", ""),
                    }
                )


async def check_weekly_leaderboard_reset(db):
    """
    Weekly leaderboard reset: Every Monday 00:00 UTC.
    Archives previous week's data, then resets all weekly_points to 0.
    Uses a lock document to prevent double-resets.
    """
    now = datetime.now(timezone.utc)
    # Only run on Monday within the first 10 minutes
    if now.weekday() != 0 or now.hour != 0 or now.minute >= 10:
        return

    # Check if already reset this week
    monday = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_key = monday.strftime("%Y-W%W")

    already = await db.weekly_reset_log.find_one({"week_key": week_key})
    if already:
        return

    logger.info(f"Starting weekly leaderboard reset for {week_key}")

    # Archive top 50 users from the ending week
    top_users = await db.users.find(
        {"weekly_points": {"$gt": 0}},
        {"_id": 0, "user_id": 1, "nickname": 1, "weekly_points": 1, "level": 1,
         "correct_predictions": 1, "picture": 1}
    ).sort([("weekly_points", -1), ("correct_predictions", -1)]).limit(50).to_list(50)

    if top_users:
        prev_week_start = monday - timedelta(days=7)
        await db.weekly_leaderboard_archive.insert_one({
            "week_key": week_key,
            "week_start": prev_week_start.isoformat(),
            "week_end": monday.isoformat(),
            "top_users": top_users,
            "archived_at": now.isoformat(),
        })

    # Reset all users' weekly_points to 0
    result = await db.users.update_many(
        {"weekly_points": {"$gt": 0}},
        {"$set": {"weekly_points": 0}}
    )
    logger.info(f"Weekly reset: {result.modified_count} users reset to 0 weekly_points")

    # Mark reset as done
    await db.weekly_reset_log.insert_one({
        "week_key": week_key,
        "reset_at": now.isoformat(),
        "users_reset": result.modified_count,
    })


async def _reminder_loop(db):
    """Main loop that runs all reminder checks every INTERVAL_SECONDS."""
    global _running
    _running = True
    logger.info(f"Reminder engine started (interval={INTERVAL_SECONDS}s)")

    while _running:
        try:
            logger.debug("Reminder engine: running checks...")
            await asyncio.gather(
                check_pre_kickoff_reminders(db),
                check_favorite_club_matchday(db),
                check_favorite_club_urgency(db),
                check_weekly_leaderboard_reset(db),
                return_exceptions=True,
            )
            logger.debug("Reminder engine: checks complete")
        except Exception as e:
            logger.error(f"Reminder engine error: {e}")

        await asyncio.sleep(INTERVAL_SECONDS)


def start_reminder_engine(db):
    """Start the background reminder engine."""
    global _task
    if _task is not None:
        return
    _task = asyncio.ensure_future(_reminder_loop(db))
    logger.info("Reminder engine task scheduled")


def stop_reminder_engine():
    """Stop the background reminder engine."""
    global _task, _running
    _running = False
    if _task:
        _task.cancel()
        _task = None
    logger.info("Reminder engine stopped")
