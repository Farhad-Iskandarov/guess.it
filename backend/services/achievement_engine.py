"""
Smart Achievement Engine — Progress-based, real-time, scalable to 10K users.

Design:
- 24 achievements defined with criteria + thresholds
- Progress computed from stored user stats (O(1) per achievement)
- No heavy recalculations — all stats are pre-incremented counters
- Sorted by completion % for "closest to completion" display
- Cached in Redis (30s per user)
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Achievement categories
CAT_PREDICTIONS = "predictions"
CAT_ACCURACY = "accuracy"
CAT_STREAKS = "streaks"
CAT_SOCIAL = "social"
CAT_LEVEL = "level"
CAT_WEEKLY = "weekly"
CAT_FAVORITES = "favorites"

# Icons map (frontend will use these keys)
ICON_MAP = {
    # Predictions - Strategy/Thinking (Blue/Purple)
    "crosshair": "Crosshair",
    "brain": "Brain",
    "target": "Target",
    # Accuracy - Precision/Success (Green)
    "badge_check": "BadgeCheck",
    "medal": "Medal",
    "gem": "Gem",
    "percent": "Percent",
    "gauge": "Gauge",
    "shield_check": "ShieldCheck",
    # Streaks - Fire/Momentum (Orange/Red)
    "flame": "Flame",
    "zap": "Zap",
    # Level - Champion (Gold)
    "star": "Star",
    "trophy": "Trophy",
    "crown": "Crown",
    "sparkles": "Sparkles",
    # Social / Favorites
    "heart": "Heart",
    "heart_handshake": "HeartHandshake",
    "shield_heart": "ShieldHalf",
    "users_round": "UsersRound",
    "user_plus": "UserPlus",
    "network": "Network",
    # Weekly - Competition
    "award": "Award",
    "swords": "Swords",
}

# Color presets per category
CATEGORY_COLORS = {
    CAT_PREDICTIONS: "bg-blue-500/15 text-blue-400",
    CAT_ACCURACY: "bg-emerald-500/15 text-emerald-400",
    CAT_STREAKS: "bg-orange-500/15 text-orange-400",
    CAT_FAVORITES: "bg-pink-500/15 text-pink-400",
    CAT_SOCIAL: "bg-teal-500/15 text-teal-400",
    CAT_LEVEL: "bg-yellow-500/15 text-yellow-400",
    CAT_WEEKLY: "bg-amber-500/15 text-amber-400",
}

# ========================== Achievement Definitions ==========================
# Each achievement: id, title, description, icon, category, threshold, stat_key, color
ACHIEVEMENTS = [
    # --- Predictions (Blue/Purple — Strategy/Thinking) ---
    {"id": "first_prediction", "title": "First Step", "description": "Make your first prediction", "icon": "crosshair", "category": CAT_PREDICTIONS, "threshold": 1, "stat_key": "total_predictions", "difficulty": 1},
    {"id": "pred_10", "title": "Getting Started", "description": "Make 10 predictions", "icon": "crosshair", "category": CAT_PREDICTIONS, "threshold": 10, "stat_key": "total_predictions", "difficulty": 1},
    {"id": "pred_25", "title": "Regular", "description": "Make 25 predictions", "icon": "brain", "category": CAT_PREDICTIONS, "threshold": 25, "stat_key": "total_predictions", "difficulty": 2},
    {"id": "pred_50", "title": "Veteran", "description": "Make 50 predictions", "icon": "brain", "category": CAT_PREDICTIONS, "threshold": 50, "stat_key": "total_predictions", "difficulty": 2},
    {"id": "pred_100", "title": "Centurion", "description": "Make 100 predictions", "icon": "target", "category": CAT_PREDICTIONS, "threshold": 100, "stat_key": "total_predictions", "difficulty": 3},
    {"id": "pred_250", "title": "Prediction Machine", "description": "Make 250 predictions", "icon": "target", "category": CAT_PREDICTIONS, "threshold": 250, "stat_key": "total_predictions", "difficulty": 3},

    # --- Accuracy (Green — Precision/Success) ---
    {"id": "correct_5", "title": "On Fire", "description": "Get 5 correct predictions", "icon": "badge_check", "category": CAT_ACCURACY, "threshold": 5, "stat_key": "correct_predictions", "difficulty": 1},
    {"id": "correct_10", "title": "Sharp Eye", "description": "Get 10 correct predictions", "icon": "badge_check", "category": CAT_ACCURACY, "threshold": 10, "stat_key": "correct_predictions", "difficulty": 1},
    {"id": "correct_25", "title": "Oracle", "description": "Get 25 correct predictions", "icon": "medal", "category": CAT_ACCURACY, "threshold": 25, "stat_key": "correct_predictions", "difficulty": 2},
    {"id": "correct_50", "title": "Clairvoyant", "description": "Get 50 correct predictions", "icon": "medal", "category": CAT_ACCURACY, "threshold": 50, "stat_key": "correct_predictions", "difficulty": 3},
    {"id": "correct_100", "title": "Legendary Seer", "description": "Get 100 correct predictions", "icon": "gem", "category": CAT_ACCURACY, "threshold": 100, "stat_key": "correct_predictions", "difficulty": 3},

    # --- Accuracy % (Green — Precision/Success) ---
    {"id": "accuracy_50", "title": "Coin Flipper", "description": "Achieve 50% accuracy (min 10 predictions)", "icon": "percent", "category": CAT_ACCURACY, "threshold": 50, "stat_key": "accuracy_pct", "difficulty": 1, "min_predictions": 10},
    {"id": "accuracy_70", "title": "Analyst", "description": "Achieve 70% accuracy (min 20 predictions)", "icon": "gauge", "category": CAT_ACCURACY, "threshold": 70, "stat_key": "accuracy_pct", "difficulty": 2, "min_predictions": 20},
    {"id": "accuracy_80", "title": "Perfectionist", "description": "Achieve 80% accuracy (min 20 predictions)", "icon": "shield_check", "category": CAT_ACCURACY, "threshold": 80, "stat_key": "accuracy_pct", "difficulty": 3, "min_predictions": 20},

    # --- Level (Gold — Champion) ---
    {"id": "level_3", "title": "Rising Star", "description": "Reach Level 3", "icon": "star", "category": CAT_LEVEL, "threshold": 3, "stat_key": "level", "difficulty": 1},
    {"id": "level_5", "title": "Champion", "description": "Reach Level 5", "icon": "trophy", "category": CAT_LEVEL, "threshold": 5, "stat_key": "level", "difficulty": 2},
    {"id": "level_7", "title": "Elite", "description": "Reach Level 7", "icon": "crown", "category": CAT_LEVEL, "threshold": 7, "stat_key": "level", "difficulty": 2},
    {"id": "level_10", "title": "Legend", "description": "Reach Level 10", "icon": "sparkles", "category": CAT_LEVEL, "threshold": 10, "stat_key": "level", "difficulty": 3},

    # --- Favorites (Pink/Gold — Loyalty) ---
    {"id": "fav_1", "title": "Fan", "description": "Add 1 favorite team", "icon": "heart", "category": CAT_FAVORITES, "threshold": 1, "stat_key": "favorites_count", "difficulty": 1},
    {"id": "fav_3", "title": "Supporter", "description": "Add 3 favorite teams", "icon": "heart_handshake", "category": CAT_FAVORITES, "threshold": 3, "stat_key": "favorites_count", "difficulty": 1},
    {"id": "fav_5", "title": "True Fan", "description": "Add 5 favorite teams", "icon": "shield_heart", "category": CAT_FAVORITES, "threshold": 5, "stat_key": "favorites_count", "difficulty": 2},

    # --- Social (Teal — Community) ---
    {"id": "friend_1", "title": "Social", "description": "Add your first friend", "icon": "user_plus", "category": CAT_SOCIAL, "threshold": 1, "stat_key": "friends_count", "difficulty": 1},
    {"id": "friend_5", "title": "Popular", "description": "Have 5 friends", "icon": "users_round", "category": CAT_SOCIAL, "threshold": 5, "stat_key": "friends_count", "difficulty": 2},
    {"id": "friend_10", "title": "Influencer", "description": "Have 10 friends", "icon": "network", "category": CAT_SOCIAL, "threshold": 10, "stat_key": "friends_count", "difficulty": 3},

    # --- Weekly Competition (Amber/Gold — Competition) ---
    {"id": "weekly_participate", "title": "Competitor", "description": "Participate in a weekly competition", "icon": "swords", "category": CAT_WEEKLY, "threshold": 1, "stat_key": "weekly_participations", "difficulty": 1},
]

TOTAL_ACHIEVEMENTS = len(ACHIEVEMENTS)


async def compute_user_stats(db, user_id: str, user: dict, summary: dict = None) -> dict:
    """
    Compute all stat values needed for achievement progress.
    Uses pre-stored counters where available, falls back to DB counts.
    O(1) reads when counters exist, lightweight count queries otherwise.
    """
    # Use summary if provided (from bundle), else count from DB
    if summary:
        total_preds = summary.get("correct", 0) + summary.get("wrong", 0) + summary.get("pending", 0)
        correct_preds = summary.get("correct", 0)
        total_settled = summary.get("correct", 0) + summary.get("wrong", 0)
    else:
        # Count from predictions collection (lightweight indexed count)
        total_preds = await db.predictions.count_documents({"user_id": user_id})
        correct_preds = await db.predictions.count_documents({
            "user_id": user_id, "result": "correct"
        })
        wrong_preds = await db.predictions.count_documents({
            "user_id": user_id, "result": "wrong"
        })
        total_settled = correct_preds + wrong_preds

    # Accuracy
    accuracy = 0
    if total_settled >= 10:
        accuracy = round((correct_preds / total_settled) * 100) if total_settled > 0 else 0

    # Favorites count
    fav_count = await db.favorites.count_documents({"user_id": user_id})

    # Friends count
    friends_count = await db.friendships.count_documents({
        "$or": [{"user_a": user_id}, {"user_b": user_id}]
    })

    # Weekly participations
    weekly_parts = await db.weekly_user_points.count_documents({
        "user_id": user_id, "weekly_points": {"$gt": 0}
    })

    return {
        "total_predictions": total_preds,
        "correct_predictions": correct_preds,
        "accuracy_pct": accuracy,
        "level": user.get("level", 0),
        "points": user.get("points", 0),
        "favorites_count": fav_count,
        "friends_count": friends_count,
        "weekly_participations": weekly_parts,
        "total_settled": total_settled,
    }


def compute_achievement_progress(achievement: dict, stats: dict) -> dict:
    """
    Compute a single achievement's progress. O(1).
    Returns achievement dict with current, threshold, percentage, completed.
    """
    stat_key = achievement["stat_key"]
    threshold = achievement["threshold"]
    current = stats.get(stat_key, 0)

    # Special handling for accuracy achievements (need min predictions)
    min_preds = achievement.get("min_predictions", 0)
    if stat_key == "accuracy_pct" and stats.get("total_settled", 0) < min_preds:
        # Not enough predictions to qualify — show prediction progress instead
        current_preds = stats.get("total_settled", 0)
        return {
            **achievement,
            "current": current_preds,
            "threshold": min_preds,
            "percentage": min(100, round((current_preds / max(min_preds, 1)) * 100)),
            "completed": False,
            "status": "locked",
            "color": CATEGORY_COLORS.get(achievement["category"], "bg-muted text-muted-foreground"),
        }

    percentage = min(100, round((current / max(threshold, 1)) * 100))
    completed = current >= threshold

    status = "completed" if completed else ("in_progress" if current > 0 else "locked")

    return {
        **achievement,
        "current": min(current, threshold),
        "threshold": threshold,
        "percentage": percentage,
        "completed": completed,
        "status": status,
        "color": CATEGORY_COLORS.get(achievement["category"], "bg-muted text-muted-foreground"),
    }


def get_smart_display_achievements(all_progress: list, max_display: int = 6) -> list:
    """
    Get the top N "closest to completion" uncompleted achievements.
    Sorted by percentage DESC, excluding 0% unless needed to fill slots.

    Psychological goal: always show achievements that feel "almost done".
    """
    uncompleted = [a for a in all_progress if not a["completed"]]
    with_progress = [a for a in uncompleted if a["percentage"] > 0]
    without_progress = [a for a in uncompleted if a["percentage"] == 0]

    # Sort by percentage descending (closest to done first)
    with_progress.sort(key=lambda a: (-a["percentage"], a["difficulty"]))
    without_progress.sort(key=lambda a: a["difficulty"])

    # Fill display slots
    display = with_progress[:max_display]
    if len(display) < max_display:
        display.extend(without_progress[:max_display - len(display)])

    return display


async def get_all_achievements_progress(db, user_id: str, user: dict, summary: dict = None) -> dict:
    """
    Compute all achievement progress for a user.
    Returns display list (top 6 closest) + full list for modal + counts.
    """
    stats = await compute_user_stats(db, user_id, user, summary)

    all_progress = [compute_achievement_progress(a, stats) for a in ACHIEVEMENTS]
    display = get_smart_display_achievements(all_progress)
    completed_count = sum(1 for a in all_progress if a["completed"])

    return {
        "display": display,
        "all": all_progress,
        "completed_count": completed_count,
        "total_count": TOTAL_ACHIEVEMENTS,
        "stats": stats,
    }


async def check_and_notify_achievements(db, user_id: str, user: dict = None):
    """
    Check if user has newly completed achievements and send notifications.
    Lightweight: compares current progress against stored completed list.
    Called after stat-changing actions (prediction, favorite, friend accept, level up).
    """
    try:
        if not user:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return

        stats = await compute_user_stats(db, user_id, user)
        all_progress = [compute_achievement_progress(a, stats) for a in ACHIEVEMENTS]

        # Get previously completed achievement IDs from user doc
        prev_completed = set(user.get("completed_achievements", []))
        now_completed = {a["id"] for a in all_progress if a["completed"]}

        # Find newly completed achievements
        newly_completed = now_completed - prev_completed
        if not newly_completed:
            return

        # Store updated completed list atomically
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"completed_achievements": list(now_completed)}}
        )

        # Create notifications for each newly completed achievement
        from routes.notifications import create_notification
        for ach_id in newly_completed:
            ach = next((a for a in all_progress if a["id"] == ach_id), None)
            if not ach:
                continue
            await create_notification(
                db,
                user_id,
                "achievement_unlocked",
                f'Achievement Unlocked: "{ach["title"]}" — {ach["description"]}',
                {
                    "achievement_id": ach_id,
                    "achievement_title": ach["title"],
                    "achievement_description": ach["description"],
                    "achievement_icon": ach.get("icon", "award"),
                    "achievement_category": ach.get("category", ""),
                }
            )
            logger.info(f"Achievement unlocked for {user_id}: {ach['title']}")

    except Exception as e:
        logger.warning(f"Achievement check failed for {user_id}: {e}")
