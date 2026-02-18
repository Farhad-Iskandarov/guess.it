from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid

class PredictionCreate(BaseModel):
    """Create a new prediction"""
    match_id: int
    prediction: Literal["home", "draw", "away"]

class PredictionUpdate(BaseModel):
    """Update an existing prediction"""
    prediction: Literal["home", "draw", "away"]

class PredictionInDB(BaseModel):
    """Prediction stored in database"""
    model_config = ConfigDict(extra="ignore")
    
    prediction_id: str = Field(default_factory=lambda: f"pred_{uuid.uuid4().hex[:12]}")
    user_id: str
    match_id: int
    prediction: Literal["home", "draw", "away"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PredictionResponse(BaseModel):
    """Response for a single prediction"""
    model_config = ConfigDict(extra="ignore")
    
    prediction_id: str
    user_id: str
    match_id: int
    prediction: Literal["home", "draw", "away"]
    created_at: datetime
    updated_at: datetime
    is_new: bool = True  # True if just created, False if updated

class UserPredictionsResponse(BaseModel):
    """Response for all user predictions"""
    predictions: list[PredictionResponse]
    total: int
