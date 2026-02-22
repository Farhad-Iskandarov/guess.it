"""
Prediction Result Processing Service
Handles notifications and points for finished matches
"""
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def process_exact_score_results(db: AsyncIOMotorDatabase, match_id: int, home_score: int, away_score: int):
    """
    Process exact score predictions for a finished match.
    Awards bonus points and sends notifications.
    """
    from routes.notifications import create_notification
    
    # Get points config
    config = await db.points_config.find_one({"config_id": "default_points"}, {"_id": 0})
    exact_bonus = config.get("exact_score_bonus", 50) if config else 50
    level_thresholds = config.get("level_thresholds", [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]) if config else [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
    
    # Find all exact score predictions for this match that haven't been processed
    predictions = await db.exact_score_predictions.find({
        "match_id": match_id,
        "points_awarded": {"$ne": True}
    }, {"_id": 0}).to_list(1000)
    
    if not predictions:
        return 0
    
    processed = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for pred in predictions:
        user_id = pred["user_id"]
        pred_home = pred["home_score"]
        pred_away = pred["away_score"]
        
        is_exact = (pred_home == home_score and pred_away == away_score)
        
        # Mark as processed
        update_data = {
            "points_awarded": True,
            "points_awarded_at": now,
            "is_correct": is_exact,
        }
        
        if is_exact:
            update_data["points_value"] = exact_bonus
            
            # Award bonus points to user
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "points": 1, "level": 1})
            if user:
                new_points = user.get("points", 0) + exact_bonus
                new_level = calculate_level_from_thresholds(new_points, level_thresholds)
                
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "points": new_points,
                        "level": new_level,
                        "updated_at": now
                    }}
                )
            
            # Send success notification
            try:
                await create_notification(
                    db,
                    user_id,
                    "exact_score_correct",
                    f"🎯 EXACT SCORE! You predicted {pred_home}-{pred_away} correctly! +{exact_bonus} bonus points!",
                    {
                        "match_id": match_id,
                        "predicted_score": f"{pred_home}-{pred_away}",
                        "actual_score": f"{home_score}-{away_score}",
                        "bonus_points": exact_bonus
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to send exact score notification: {e}")
        else:
            update_data["points_value"] = 0
            
            # Send miss notification
            try:
                await create_notification(
                    db,
                    user_id,
                    "exact_score_wrong",
                    f"😔 Exact score miss. You predicted {pred_home}-{pred_away}, actual was {home_score}-{away_score}.",
                    {
                        "match_id": match_id,
                        "predicted_score": f"{pred_home}-{pred_away}",
                        "actual_score": f"{home_score}-{away_score}",
                        "bonus_points": 0
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to send exact score miss notification: {e}")
        
        await db.exact_score_predictions.update_one(
            {"exact_score_id": pred["exact_score_id"]},
            {"$set": update_data}
        )
        processed += 1
    
    logger.info(f"Processed {processed} exact score predictions for match {match_id}")
    return processed


def calculate_level_from_thresholds(points: int, thresholds: list) -> int:
    """Calculate level from points using threshold list"""
    level = 0
    for i, threshold in enumerate(thresholds):
        if points >= threshold:
            level = i
        else:
            break
    return level


async def check_and_process_finished_matches(db: AsyncIOMotorDatabase):
    """
    Background task to check for newly finished matches and process predictions.
    Should be called periodically (e.g., every minute).
    """
    from services.football_api import get_matches
    
    # Get recently finished matches (last 24 hours)
    now = datetime.now(timezone.utc)
    date_from = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    date_to = now.strftime("%Y-%m-%d")
    
    try:
        matches = await get_matches(db, date_from, date_to, status="FINISHED")
    except Exception as e:
        logger.error(f"Failed to fetch finished matches: {e}")
        return
    
    for match in matches:
        match_id = match.get("id")
        score = match.get("score", {})
        home_score = score.get("home")
        away_score = score.get("away")
        
        if match_id and home_score is not None and away_score is not None:
            await process_exact_score_results(db, match_id, home_score, away_score)


from datetime import timedelta
