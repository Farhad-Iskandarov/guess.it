from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
import logging

from models.prediction import (
    PredictionCreate, PredictionUpdate, PredictionInDB,
    PredictionResponse, UserPredictionsResponse,
    ExactScoreCreate, ExactScoreInDB, ExactScoreResponse
)
from routes.auth import validate_session
from routes.notifications import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predictions", tags=["Predictions"])

# Default values - these are overridden by DB config when available
DEFAULT_LEVEL_THRESHOLDS = [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
DEFAULT_POINTS_CORRECT = 10
DEFAULT_POINTS_WRONG_PENALTY = 5
DEFAULT_PENALTY_MIN_LEVEL = 5
DEFAULT_EXACT_SCORE_BONUS = 50

async def get_points_config(db):
    """Get current points configuration from database or defaults"""
    config = await db.points_config.find_one({"config_id": "default_points"}, {"_id": 0})
    if config:
        return {
            "level_thresholds": config.get("level_thresholds", DEFAULT_LEVEL_THRESHOLDS),
            "correct_prediction": config.get("correct_prediction", DEFAULT_POINTS_CORRECT),
            "wrong_penalty": config.get("wrong_penalty", DEFAULT_POINTS_WRONG_PENALTY),
            "penalty_min_level": config.get("penalty_min_level", DEFAULT_PENALTY_MIN_LEVEL),
            "exact_score_bonus": config.get("exact_score_bonus", DEFAULT_EXACT_SCORE_BONUS),
        }
    return {
        "level_thresholds": DEFAULT_LEVEL_THRESHOLDS,
        "correct_prediction": DEFAULT_POINTS_CORRECT,
        "wrong_penalty": DEFAULT_POINTS_WRONG_PENALTY,
        "penalty_min_level": DEFAULT_PENALTY_MIN_LEVEL,
        "exact_score_bonus": DEFAULT_EXACT_SCORE_BONUS,
    }

def calculate_level(points, level_thresholds=None):
    """Calculate level from total points"""
    if level_thresholds is None:
        level_thresholds = DEFAULT_LEVEL_THRESHOLDS
    level = 0
    for i, threshold in enumerate(level_thresholds):
        if points >= threshold:
            level = i
        else:
            break
    return level

# Dependency to get database
def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

async def get_current_user(request: Request, db: AsyncIOMotorDatabase):
    """Get current authenticated user from session"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = await validate_session(db, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    return user

@router.post("", response_model=PredictionResponse)
async def create_or_update_prediction(
    prediction_data: PredictionCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Create or update a prediction for a match.
    If prediction exists for this user+match, update it.
    Otherwise, create a new prediction.
    """
    # Get current user
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    # Check if prediction already exists
    existing = await db.predictions.find_one({
        "user_id": user_id,
        "match_id": prediction_data.match_id
    }, {"_id": 0})
    
    now = datetime.now(timezone.utc)
    
    if existing:
        # Update existing prediction
        await db.predictions.update_one(
            {"prediction_id": existing["prediction_id"]},
            {
                "$set": {
                    "prediction": prediction_data.prediction,
                    "updated_at": now.isoformat()
                }
            }
        )
        
        # Parse created_at
        created_at = existing.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        return PredictionResponse(
            prediction_id=existing["prediction_id"],
            user_id=user_id,
            match_id=prediction_data.match_id,
            prediction=prediction_data.prediction,
            created_at=created_at,
            updated_at=now,
            is_new=False
        )
    else:
        # Create new prediction
        prediction = PredictionInDB(
            user_id=user_id,
            match_id=prediction_data.match_id,
            prediction=prediction_data.prediction
        )
        
        pred_dict = prediction.model_dump()
        pred_dict['created_at'] = pred_dict['created_at'].isoformat()
        pred_dict['updated_at'] = pred_dict['updated_at'].isoformat()
        
        await db.predictions.insert_one(pred_dict)
        
        return PredictionResponse(
            prediction_id=prediction.prediction_id,
            user_id=user_id,
            match_id=prediction_data.match_id,
            prediction=prediction_data.prediction,
            created_at=prediction.created_at,
            updated_at=prediction.updated_at,
            is_new=True
        )

@router.get("/me", response_model=UserPredictionsResponse)
async def get_my_predictions(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all predictions for the current user"""
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    predictions = await db.predictions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Convert timestamps
    result = []
    for pred in predictions:
        created_at = pred.get("created_at")
        updated_at = pred.get("updated_at")
        
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        
        result.append(PredictionResponse(
            prediction_id=pred["prediction_id"],
            user_id=pred["user_id"],
            match_id=pred["match_id"],
            prediction=pred["prediction"],
            created_at=created_at,
            updated_at=updated_at,
            is_new=False
        ))
    
    return UserPredictionsResponse(
        predictions=result,
        total=len(result)
    )

@router.get("/match/{match_id}", response_model=PredictionResponse)
async def get_prediction_for_match(
    match_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user's prediction for a specific match"""
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    prediction = await db.predictions.find_one({
        "user_id": user_id,
        "match_id": match_id
    }, {"_id": 0})
    
    if not prediction:
        raise HTTPException(status_code=404, detail="No prediction found for this match")
    
    created_at = prediction.get("created_at")
    updated_at = prediction.get("updated_at")
    
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)
    
    return PredictionResponse(
        prediction_id=prediction["prediction_id"],
        user_id=prediction["user_id"],
        match_id=prediction["match_id"],
        prediction=prediction["prediction"],
        created_at=created_at,
        updated_at=updated_at,
        is_new=False
    )

@router.delete("/match/{match_id}")
async def delete_prediction(
    match_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Delete a prediction for a specific match"""
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    result = await db.predictions.delete_one({
        "user_id": user_id,
        "match_id": match_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No prediction found for this match")
    
    return {"message": "Prediction deleted successfully"}


@router.get("/me/detailed")
async def get_my_predictions_detailed(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all predictions for the current user, enriched with match data from Football API.
    Also processes points for finished matches (server-side, once per match)."""
    from services.football_api import get_matches, _api_get, _transform_match

    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    # Get dynamic points config
    points_config = await get_points_config(db)
    POINTS_CORRECT = points_config["correct_prediction"]
    POINTS_WRONG_PENALTY = -points_config["wrong_penalty"]
    PENALTY_MIN_LEVEL = points_config["penalty_min_level"]
    LEVEL_THRESHOLDS = points_config["level_thresholds"]

    # Get user predictions
    predictions = await db.predictions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)

    # Also fetch exact score predictions for this user
    exact_score_preds = await db.exact_score_predictions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    exact_score_map = {ep["match_id"]: ep for ep in exact_score_preds}

    if not predictions and not exact_score_preds:
        user_points = user.get("points", 0)
        user_level = user.get("level", 0)
        return {
            "predictions": [], "total": 0,
            "summary": {"correct": 0, "wrong": 0, "pending": 0, "points": user_points},
            "user_points": user_points, "user_level": user_level
        }

    # Fetch matches with standard date range (today + 7 days, same as homepage)
    now = datetime.now(timezone.utc)
    date_from = now.strftime("%Y-%m-%d")
    date_to = (now + timedelta(days=7)).strftime("%Y-%m-%d")

    try:
        all_matches = await get_matches(db, date_from=date_from, date_to=date_to)
    except Exception:
        all_matches = []

    match_map = {m["id"]: m for m in all_matches}

    # For any predicted matches not found in the bulk fetch, fetch individually by ID
    all_predicted_match_ids = set(p["match_id"] for p in predictions) | set(exact_score_map.keys())
    missing_ids = [mid for mid in all_predicted_match_ids if mid not in match_map]
    for mid in missing_ids:
        try:
            data = await _api_get(f"/matches/{mid}")
            if data and "id" in data:
                match_map[mid] = _transform_match(data)
        except Exception:
            pass

    results = []
    correct = 0
    wrong = 0
    pending = 0
    points_delta = 0  # Points to add/subtract this run

    for pred in predictions:
        match_id = pred["match_id"]
        match_data = match_map.get(match_id)

        created_at = pred.get("created_at", "")
        updated_at = pred.get("updated_at", "")

        entry = {
            "prediction_id": pred["prediction_id"],
            "match_id": match_id,
            "prediction": pred["prediction"],
            "prediction_type": "winner",
            "created_at": created_at,
            "updated_at": updated_at,
            "match": None,
            "result": "pending",
            "points_awarded": pred.get("points_awarded", False),
            "points_value": pred.get("points_value", 0),
            "exact_score": None,
        }

        if match_data:
            entry["match"] = {
                "homeTeam": match_data["homeTeam"],
                "awayTeam": match_data["awayTeam"],
                "competition": match_data["competition"],
                "competitionEmblem": match_data.get("competitionEmblem"),
                "dateTime": match_data["dateTime"],
                "utcDate": match_data.get("utcDate"),
                "status": match_data["status"],
                "statusDetail": match_data.get("statusDetail"),
                "matchMinute": match_data.get("matchMinute"),
                "score": match_data["score"],
                "votes": match_data["votes"],
                "totalVotes": match_data["totalVotes"],
            }

            # Determine if prediction was correct for finished matches
            status = match_data["status"]
            home_score = match_data["score"].get("home")
            away_score = match_data["score"].get("away")

            if status == "FINISHED" and home_score is not None and away_score is not None:
                actual_result = "draw"
                if home_score > away_score:
                    actual_result = "home"
                elif away_score > home_score:
                    actual_result = "away"

                is_correct = pred["prediction"] == actual_result

                if is_correct:
                    entry["result"] = "correct"
                    correct += 1
                else:
                    entry["result"] = "wrong"
                    wrong += 1

                # Process points if not yet awarded for this prediction
                if not pred.get("points_awarded", False):
                    current_user_points = user.get("points", 0) + points_delta
                    current_level = calculate_level(current_user_points, LEVEL_THRESHOLDS)

                    if is_correct:
                        pts = POINTS_CORRECT
                    else:
                        # Deduct only if level >= penalty threshold
                        if current_level >= PENALTY_MIN_LEVEL:
                            pts = POINTS_WRONG_PENALTY
                        else:
                            pts = 0

                    # Mark as awarded in DB
                    await db.predictions.update_one(
                        {"prediction_id": pred["prediction_id"]},
                        {"$set": {
                            "points_awarded": True,
                            "points_value": pts,
                            "points_awarded_at": now.isoformat(),
                            "notification_sent": True
                        }}
                    )
                    points_delta += pts
                    entry["points_awarded"] = True
                    entry["points_value"] = pts
                    
                    # Send notification for prediction result
                    home_team = match_data["homeTeam"].get("name", "Home")
                    away_team = match_data["awayTeam"].get("name", "Away")
                    score_str = f"{home_score}-{away_score}"
                    
                    if is_correct:
                        notif_message = f"✅ Correct! {home_team} vs {away_team} finished {score_str}. You earned +{pts} points!"
                        notif_type = "prediction_correct"
                    else:
                        if pts < 0:
                            notif_message = f"❌ Wrong prediction. {home_team} vs {away_team} finished {score_str}. You lost {abs(pts)} points."
                        else:
                            notif_message = f"❌ Wrong prediction. {home_team} vs {away_team} finished {score_str}. No points deducted (level < {PENALTY_MIN_LEVEL})."
                        notif_type = "prediction_wrong"
                    
                    # Send notification (don't await to avoid blocking)
                    try:
                        await create_notification(
                            db, 
                            user_id, 
                            notif_type, 
                            notif_message,
                            {
                                "match_id": pred["match_id"],
                                "prediction": pred["prediction"],
                                "actual_result": actual_result,
                                "points": pts,
                                "home_team": home_team,
                                "away_team": away_team,
                                "score": score_str
                            }
                        )
                    except Exception as e:
                        logger.warning(f"Failed to send prediction notification: {e}")
            else:
                pending += 1
        else:
            pending += 1

        results.append(entry)

    # Attach exact score data to entries that have it
    results_by_match = {r["match_id"]: r for r in results}
    
    for match_id, es_pred in exact_score_map.items():
        es_data = {
            "exact_score_id": es_pred.get("exact_score_id"),
            "home_score": es_pred["home_score"],
            "away_score": es_pred["away_score"],
            "exact_score_points_awarded": es_pred.get("points_awarded", False),
            "exact_score_points_value": es_pred.get("points_value", 0),
        }
        
        if match_id in results_by_match:
            # Attach exact score info to existing entry
            results_by_match[match_id]["exact_score"] = es_data
            results_by_match[match_id]["prediction_type"] = "both"
        else:
            # Create a new entry for exact-score-only prediction
            match_data = match_map.get(match_id)
            
            es_created_at = es_pred.get("created_at", "")
            
            es_entry = {
                "prediction_id": es_pred.get("exact_score_id", ""),
                "match_id": match_id,
                "prediction": None,
                "prediction_type": "exact_score",
                "created_at": es_created_at,
                "updated_at": es_created_at,
                "match": None,
                "result": "pending",
                "points_awarded": es_pred.get("points_awarded", False),
                "points_value": es_pred.get("points_value", 0),
                "exact_score": es_data,
            }
            
            if match_data:
                es_entry["match"] = {
                    "homeTeam": match_data["homeTeam"],
                    "awayTeam": match_data["awayTeam"],
                    "competition": match_data["competition"],
                    "competitionEmblem": match_data.get("competitionEmblem"),
                    "dateTime": match_data["dateTime"],
                    "utcDate": match_data.get("utcDate"),
                    "status": match_data["status"],
                    "statusDetail": match_data.get("statusDetail"),
                    "matchMinute": match_data.get("matchMinute"),
                    "score": match_data["score"],
                    "votes": match_data["votes"],
                    "totalVotes": match_data["totalVotes"],
                }
                
                status = match_data["status"]
                home_sc = match_data["score"].get("home")
                away_sc = match_data["score"].get("away")
                
                if status == "FINISHED" and home_sc is not None and away_sc is not None:
                    is_exact = (es_pred["home_score"] == home_sc and es_pred["away_score"] == away_sc)
                    if is_exact:
                        es_entry["result"] = "correct"
                        correct += 1
                    else:
                        es_entry["result"] = "wrong"
                        wrong += 1
                    
                    # Process exact score points if not yet awarded
                    if not es_pred.get("points_awarded", False):
                        if is_exact:
                            es_bonus = points_config["exact_score_bonus"]
                            await db.exact_score_predictions.update_one(
                                {"exact_score_id": es_pred["exact_score_id"]},
                                {"$set": {
                                    "points_awarded": True,
                                    "points_value": es_bonus,
                                    "points_awarded_at": now.isoformat(),
                                    "is_correct": True,
                                }}
                            )
                            points_delta += es_bonus
                            es_entry["points_awarded"] = True
                            es_entry["points_value"] = es_bonus
                            es_entry["exact_score"]["exact_score_points_awarded"] = True
                            es_entry["exact_score"]["exact_score_points_value"] = es_bonus
                        else:
                            await db.exact_score_predictions.update_one(
                                {"exact_score_id": es_pred["exact_score_id"]},
                                {"$set": {
                                    "points_awarded": True,
                                    "points_value": 0,
                                    "points_awarded_at": now.isoformat(),
                                    "is_correct": False,
                                }}
                            )
                            es_entry["exact_score"]["exact_score_points_awarded"] = True
                            es_entry["exact_score"]["exact_score_points_value"] = 0
                else:
                    pending += 1
            else:
                pending += 1
            
            results.append(es_entry)

    # Update user points and level if there were changes
    if points_delta != 0:
        new_points = max(0, user.get("points", 0) + points_delta)
        new_level = calculate_level(new_points, LEVEL_THRESHOLDS)
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "points": new_points,
                "level": new_level,
                "updated_at": now.isoformat()
            }}
        )
        user_points = new_points
        user_level = new_level
    else:
        user_points = user.get("points", 0)
        user_level = user.get("level", 0)

    return {
        "predictions": results,
        "total": len(results),
        "summary": {"correct": correct, "wrong": wrong, "pending": pending, "points": user_points},
        "user_points": user_points,
        "user_level": user_level,
    }



# ==================== Exact Score Predictions ====================

@router.post("/exact-score", response_model=ExactScoreResponse)
async def create_exact_score_prediction(
    prediction_data: ExactScoreCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Create an exact score prediction for a match.
    Only one per match per user. Use PUT to update before match starts.
    """
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    # Check if exact score prediction already exists for this match
    existing = await db.exact_score_predictions.find_one({
        "user_id": user_id,
        "match_id": prediction_data.match_id
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Exact score prediction already exists for this match. Use edit to change it."
        )
    
    # Create new exact score prediction
    exact_pred = ExactScoreInDB(
        user_id=user_id,
        match_id=prediction_data.match_id,
        home_score=prediction_data.home_score,
        away_score=prediction_data.away_score
    )
    
    pred_dict = exact_pred.model_dump()
    pred_dict['created_at'] = pred_dict['created_at'].isoformat()
    
    await db.exact_score_predictions.insert_one(pred_dict)
    
    logger.info(f"User {user_id} created exact score prediction for match {prediction_data.match_id}: {prediction_data.home_score}-{prediction_data.away_score}")
    
    return ExactScoreResponse(
        exact_score_id=exact_pred.exact_score_id,
        user_id=user_id,
        match_id=prediction_data.match_id,
        home_score=prediction_data.home_score,
        away_score=prediction_data.away_score,
        points_awarded=False,
        points_value=0,
        created_at=exact_pred.created_at
    )


@router.put("/exact-score/match/{match_id}", response_model=ExactScoreResponse)
async def update_exact_score_prediction(
    match_id: int,
    prediction_data: ExactScoreCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Update an exact score prediction for a match.
    Only allowed if the match hasn't started and points haven't been awarded.
    """
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    existing = await db.exact_score_predictions.find_one({
        "user_id": user_id,
        "match_id": match_id
    }, {"_id": 0})
    
    if not existing:
        raise HTTPException(status_code=404, detail="No exact score prediction found for this match")
    
    if existing.get("points_awarded"):
        raise HTTPException(status_code=400, detail="Cannot edit - match already processed")
    
    now = datetime.now(timezone.utc)
    
    await db.exact_score_predictions.update_one(
        {"user_id": user_id, "match_id": match_id},
        {"$set": {
            "home_score": prediction_data.home_score,
            "away_score": prediction_data.away_score,
            "updated_at": now.isoformat()
        }}
    )
    
    created_at = existing.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    logger.info(f"User {user_id} updated exact score for match {match_id}: {prediction_data.home_score}-{prediction_data.away_score}")
    
    return ExactScoreResponse(
        exact_score_id=existing["exact_score_id"],
        user_id=user_id,
        match_id=match_id,
        home_score=prediction_data.home_score,
        away_score=prediction_data.away_score,
        points_awarded=False,
        points_value=0,
        created_at=created_at
    )


@router.get("/exact-score/match/{match_id}", response_model=ExactScoreResponse)
async def get_exact_score_for_match(
    match_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user's exact score prediction for a specific match"""
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    prediction = await db.exact_score_predictions.find_one({
        "user_id": user_id,
        "match_id": match_id
    }, {"_id": 0})
    
    if not prediction:
        raise HTTPException(status_code=404, detail="No exact score prediction found for this match")
    
    created_at = prediction.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return ExactScoreResponse(
        exact_score_id=prediction["exact_score_id"],
        user_id=prediction["user_id"],
        match_id=prediction["match_id"],
        home_score=prediction["home_score"],
        away_score=prediction["away_score"],
        points_awarded=prediction.get("points_awarded", False),
        points_value=prediction.get("points_value", 0),
        created_at=created_at
    )


@router.get("/exact-score/me")
async def get_my_exact_score_predictions(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all exact score predictions for the current user"""
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    predictions = await db.exact_score_predictions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    
    result = []
    for pred in predictions:
        created_at = pred.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append({
            "exact_score_id": pred["exact_score_id"],
            "user_id": pred["user_id"],
            "match_id": pred["match_id"],
            "home_score": pred["home_score"],
            "away_score": pred["away_score"],
            "points_awarded": pred.get("points_awarded", False),
            "points_value": pred.get("points_value", 0),
            "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at
        })
    
    return {
        "exact_score_predictions": result,
        "total": len(result)
    }


@router.delete("/exact-score/match/{match_id}")
async def delete_exact_score_prediction(
    match_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Delete exact score prediction for a match (only if not yet awarded points)"""
    user = await get_current_user(request, db)
    
    existing = await db.exact_score_predictions.find_one({
        "user_id": user["user_id"],
        "match_id": match_id
    }, {"_id": 0})
    
    if not existing:
        raise HTTPException(status_code=404, detail="No exact score prediction found")
    
    if existing.get("points_awarded"):
        raise HTTPException(status_code=400, detail="Cannot delete - match already processed")
    
    await db.exact_score_predictions.delete_one({
        "user_id": user["user_id"],
        "match_id": match_id
    })
    
    return {"message": "Exact score prediction deleted"}



# ==================== Smart Advice & Friends Activity ====================

@router.get("/smart-advice/{match_id}")
async def get_smart_advice(
    match_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get smart advice from a top-performing user.
    Finds users with 10+ recent correct predictions and returns a random one's prediction.
    """
    import random
    
    user = await get_current_user(request, db)
    
    # Find users with 10+ correct predictions in the last 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # Aggregate to find top performers
    pipeline = [
        {
            "$match": {
                "points_awarded": True,
                "points_value": {"$gt": 0},  # Correct predictions
                "points_awarded_at": {"$gte": thirty_days_ago}
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "correct_count": {"$sum": 1}
            }
        },
        {
            "$match": {
                "correct_count": {"$gte": 10}
            }
        }
    ]
    
    top_performers = await db.predictions.aggregate(pipeline).to_list(100)
    
    if not top_performers:
        return {
            "advice": None,
            "message": "No top performers available yet. Be the first to build a streak!"
        }
    
    # Shuffle and try to find one who predicted this match
    random.shuffle(top_performers)
    
    for performer in top_performers:
        performer_id = performer["_id"]
        
        # Skip self
        if performer_id == user["user_id"]:
            continue
        
        # Check if this user predicted this match
        prediction = await db.predictions.find_one({
            "user_id": performer_id,
            "match_id": match_id
        }, {"_id": 0})
        
        if prediction:
            # Get user info
            performer_user = await db.users.find_one({"user_id": performer_id}, {"_id": 0, "nickname": 1})
            nickname = performer_user.get("nickname", "Expert") if performer_user else "Expert"
            
            correct_count = performer["correct_count"]
            pred_text = {
                "home": "Home will win",
                "draw": "it will be a Draw",
                "away": "Away will win"
            }.get(prediction["prediction"], "the outcome")
            
            return {
                "advice": f"🎯 {nickname} who guessed last {correct_count} matches correctly thinks {pred_text}.",
                "performer": {
                    "nickname": nickname,
                    "correct_count": correct_count,
                    "prediction": prediction["prediction"]
                }
            }
    
    # No top performer predicted this match yet
    return {
        "advice": "No top performers have predicted this match yet. Trust your instincts!",
        "message": "Be among the first to predict"
    }


@router.get("/match/{match_id}/friends-activity")
async def get_friends_activity(
    match_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get predictions made by friends on a specific match.
    Only shows friends' predictions, respecting privacy settings.
    """
    user = await get_current_user(request, db)
    user_id = user["user_id"]
    
    # Get user's friends
    friendships = await db.friendships.find({
        "$or": [
            {"user_a": user_id},
            {"user_b": user_id}
        ]
    }, {"_id": 0}).to_list(1000)
    
    friend_ids = []
    for f in friendships:
        if f["user_a"] == user_id:
            friend_ids.append(f["user_b"])
        else:
            friend_ids.append(f["user_a"])
    
    if not friend_ids:
        return {"friends": [], "total": 0}
    
    # Get friends' predictions for this match
    predictions = await db.predictions.find({
        "user_id": {"$in": friend_ids},
        "match_id": match_id
    }, {"_id": 0}).to_list(100)
    
    if not predictions:
        return {"friends": [], "total": 0}
    
    # Enrich with user info (checking privacy settings)
    result = []
    for pred in predictions:
        friend_user = await db.users.find_one(
            {"user_id": pred["user_id"]},
            {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1, "profile_private": 1, "show_predictions_to_friends": 1}
        )
        
        if not friend_user:
            continue
        
        # Check if friend allows showing predictions (default: True)
        if not friend_user.get("show_predictions_to_friends", True):
            continue
        
        result.append({
            "user_id": friend_user["user_id"],
            "nickname": friend_user.get("nickname", "Friend"),
            "picture": friend_user.get("picture"),
            "prediction": pred["prediction"],
            "predicted_at": pred.get("created_at")
        })
    
    return {"friends": result, "total": len(result)}
