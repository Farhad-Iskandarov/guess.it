from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import logging

from models.prediction import (
    PredictionCreate, PredictionUpdate, PredictionInDB,
    PredictionResponse, UserPredictionsResponse
)
from routes.auth import validate_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predictions", tags=["Predictions"])

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
