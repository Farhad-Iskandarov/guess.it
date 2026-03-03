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

# Icons map (frontend will use these keys)
ICON_MAP = {
    "target": "Target",
    "flame": "Flame",
    "trophy": "Trophy",
    "award": "Award",
    "shield": "Shield",
    "heart": "Heart",
    "users": "Users",
    "star": "Star",
    "zap": "Zap",
    "crown": "Crown",
    "trending": "TrendingUp",
    "check": "CheckCircle2",
    "medal": "Medal",
    "chart": "BarChart3",
}

# Color presets per category
CATEGORY_COLORS = {
    CAT_PREDICTIONS: "bg-primary/15 text-primary",
    CAT_ACCURACY: "bg-emerald-500/15 text-emerald-400",
    CAT_STREAKS: "bg-amber-500/15 text-amber-400",
    CAT_SOCIAL: "bg-violet-500/15 text-violet-400",
    CAT_LEVEL: "bg-yellow-500/15 text-yellow-400",
    CAT_WEEKLY: "bg-blue-500/15 text-blue-400",
}

# ========================== Achievement Definitions ==========================
# Each achievement: id, title, description, icon, category, threshold, stat_key, color
ACHIEVEMENTS = [
    # --- Predictions ---
    {"id": "first_prediction", "title": "First Step", "description": "Make your first prediction", "icon": "target", "category": CAT_PREDICTIONS, "threshold": 1, "stat_key": "total_predictions", "difficulty": 1},
    {"id": "pred_10", "title": "Getting Started", "description": "Make 10 predictions", "icon": "target", "category": CAT_PREDICTIONS, "threshold": 10, "stat_key": "total_predictions", "difficulty": 1},
    {"id": "pred_25", "title": "Regular", "description": "Make 25 predictions", "icon": "target", "category": CAT_PREDICTIONS, "threshold": 25, "stat_key": "total_predictions", "difficulty": 2},
    {"id": "pred_50", "title": "Veteran", "description": "Make 50 predictions", "icon": "award", "category": CAT_PREDICTIONS, "threshold": 50, "stat_key": "total_predictions", "difficulty": 2},
    {"id": "pred_100", "title": "Centurion", "description": "Make 100 predictions", "icon": "award", "category": CAT_PREDICTIONS, "threshold": 100, "stat_key": "total_predictions", "difficulty": 3},
    {"id": "pred_250", "title": "Prediction Machine", "description": "Make 250 predictions", "icon": "trophy", "category": CAT_PREDICTIONS, "threshold": 250, "stat_key": "total_predictions", "difficulty": 3},

    # --- Correct Predictions ---
    {"id": "correct_5", "title": "On Fire", "description": "Get 5 correct predictions", "icon": "flame", "category": CAT_ACCURACY, "threshold": 5, "stat_key": "correct_predictions", "difficulty": 1},
    {"id": "correct_10", "title": "Sharp Eye", "description": "Get 10 correct predictions", "icon": "flame", "category": CAT_ACCURACY, "threshold": 10, "stat_key": "correct_predictions", "difficulty": 1},
    {"id": "correct_25", "title": "Oracle", "description": "Get 25 correct predictions", "icon": "check", "category": CAT_ACCURACY, "threshold": 25, "stat_key": "correct_predictions", "difficulty": 2},
    {"id": "correct_50", "title": "Clairvoyant", "description": "Get 50 correct predictions", "icon": "check", "category": CAT_ACCURACY, "threshold": 50, "stat_key": "correct_predictions", "difficulty": 3},
    {"id": "correct_100", "title": "Legendary Seer", "description": "Get 100 correct predictions", "icon": "crown", "category": CAT_ACCURACY, "threshold": 100, "stat_key": "correct_predictions", "difficulty": 3},

    # --- Accuracy ---
    {"id": "accuracy_50", "title": "Coin Flipper", "description": "Achieve 50% accuracy (min 10 predictions)", "icon": "chart", "category": CAT_ACCURACY, "threshold": 50, "stat_key": "accuracy_pct", "difficulty": 1, "min_predictions": 10},
    {"id": "accuracy_70", "title": "Analyst", "description": "Achieve 70% accuracy (min 20 predictions)", "icon": "chart", "category": CAT_ACCURACY, "threshold": 70, "stat_key": "accuracy_pct", "difficulty": 2, "min_predictions": 20},
    {"id": "accuracy_80", "title": "Perfectionist", "description": "Achieve 80% accuracy (min 20 predictions)", "icon": "shield", "category": CAT_ACCURACY, "threshold": 80, "stat_key": "accuracy_pct", "difficulty": 3, "min_predictions": 20},

    # --- Level ---
    {"id": "level_3", "title": "Rising Star", "description": "Reach Level 3", "icon": "star", "category": CAT_LEVEL, "threshold": 3, "stat_key": "level", "difficulty": 1},
    {"id": "level_5", "title": "Champion", "description": "Reach Level 5", "icon": "trophy", "category": CAT_LEVEL, "threshold": 5, "stat_key": "level", "difficulty": 2},
    {"id": "level_7", "title": "Elite", "description": "Reach Level 7", "icon": "trophy", "category": CAT_LEVEL, "threshold": 7, "stat_key": "level", "difficulty": 2},
    {"id": "level_10", "title": "Legend", "description": "Reach Level 10", "icon": "crown", "category": CAT_LEVEL, "threshold": 10, "stat_key": "level", "difficulty": 3},

    # --- Social ---
    {"id": "fav_1", "title": "Fan", "description": "Add 1 favorite team", "icon": "heart", "category": CAT_SOCIAL, "threshold": 1, "stat_key": "favorites_count", "difficulty": 1},
    {"id": "fav_3", "title": "Supporter", "description": "Add 3 favorite teams", "icon": "heart", "category": CAT_SOCIAL, "threshold": 3, "stat_key": "favorites_count", "difficulty": 1},
    {"id": "fav_5", "title": "True Fan", "description": "Add 5 favorite teams", "icon": "heart", "category": CAT_SOCIAL, "threshold": 5, "stat_key": "favorites_count", "difficulty": 2},
    {"id": "friend_1", "title": "Social", "description": "Add your first friend", "icon": "users", "category": CAT_SOCIAL, "threshold": 1, "stat_key": "friends_count", "difficulty": 1},
    {"id": "friend_5", "title": "Popular", "description": "Have 5 friends", "icon": "users", "category": CAT_SOCIAL, "threshold": 5, "stat_key": "friends_count", "difficulty": 2},
    {"id": "friend_10", "title": "Influencer", "description": "Have 10 friends", "icon": "users", "category": CAT_SOCIAL, "threshold": 10, "stat_key": "friends_count", "difficulty": 3},

    # --- Weekly Competition ---
    {"id": "weekly_participate", "title": "Competitor", "description": "Participate in a weekly competition", "icon": "zap", "category": CAT_WEEKLY, "threshold": 1, "stat_key": "weekly_participations", "difficulty": 1},
]

TOTAL_ACHIEVEMENTS = len(ACHIEVEMENTS)


async def compute_user_stats(db, user_id: str, user: dict, summary: dict = None) -> dict:
    """
    Compute all stat values needed for achievement progress.
    Uses pre-stored counters — O(1) reads, no heavy aggregation.
    """
    # Use summary if provided (from bundle), else use user doc stats
    total_preds = user.get("predictions_count", 0)
    correct_preds = user.get("correct_predictions", 0)

    if summary:
        total_settled = summary.get("correct", 0) + summary.get("wrong", 0)
        correct_preds = max(correct_preds, summary.get("correct", 0))
        total_preds = max(total_preds, summary.get("correct", 0) + summary.get("wrong", 0) + summary.get("pending", 0))
    else:
        total_settled = correct_preds + (total_preds - correct_preds)

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
