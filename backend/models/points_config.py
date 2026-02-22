from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid

class PointsConfig(BaseModel):
    """Points configuration settings"""
    model_config = ConfigDict(extra="ignore")
    
    config_id: str = Field(default_factory=lambda: f"pconfig_{uuid.uuid4().hex[:12]}")
    
    # Basic prediction points
    correct_prediction: int = Field(default=10, ge=0, le=1000)
    wrong_penalty: int = Field(default=5, ge=0, le=100)  # Stored as positive, applied as negative
    penalty_min_level: int = Field(default=5, ge=0, le=10)  # Level at which penalties apply
    
    # Exact score bonus
    exact_score_bonus: int = Field(default=50, ge=0, le=500)
    
    # Level thresholds (points needed for each level 0-10)
    level_thresholds: list[int] = Field(
        default=[0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
    )
    
    # Metadata
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: str = ""


class PointsConfigUpdate(BaseModel):
    """Update points configuration"""
    correct_prediction: int = Field(default=10, ge=0, le=1000)
    wrong_penalty: int = Field(default=5, ge=0, le=100)
    penalty_min_level: int = Field(default=5, ge=0, le=10)
    exact_score_bonus: int = Field(default=50, ge=0, le=500)
    level_thresholds: list[int] = Field(
        default=[0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
    )


# Default configuration values
DEFAULT_POINTS_CONFIG = {
    "config_id": "default_points",
    "correct_prediction": 10,
    "wrong_penalty": 5,
    "penalty_min_level": 5,
    "exact_score_bonus": 50,
    "level_thresholds": [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
}
