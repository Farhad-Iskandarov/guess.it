"""
Weekly Season Models — Pydantic schemas for the weekly competition system.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class WeeklySeasonDoc(BaseModel):
    """A single weekly competition season."""
    season_id: str = Field(..., description="ISO week key, e.g. 2026-W10")
    start_date: str
    end_date: str
    status: str = Field(default="active", description="active | completed")
    total_predictions: int = 0
    total_participants: int = 0
    finalized_at: Optional[str] = None
    created_at: str = ""


class WeeklyUserPointsDoc(BaseModel):
    """Per-user, per-season points tracking."""
    season_id: str
    user_id: str
    weekly_points: int = 0
    predictions_count: int = 0
    correct_predictions: int = 0
    updated_at: str = ""


class WeeklyResultArchiveDoc(BaseModel):
    """Archived snapshot of a completed season's top rankings."""
    season_id: str
    top_100: list = Field(default_factory=list)
    total_participants: int = 0
    total_predictions: int = 0
    winner: Optional[dict] = None
    generated_at: str = ""


class WeeklyStatusResponse(BaseModel):
    """Response for GET /weekly/status."""
    current_season_id: str
    season_status: str
    starts_at: str
    ends_at: str
    ends_in_seconds: int
    total_participants: int = 0
    total_predictions: int = 0
    user_current_rank: Optional[int] = None
    user_weekly_points: int = 0
    user_predictions_count: int = 0


class WeeklySummaryResponse(BaseModel):
    """Response for GET /weekly/summary/{season_id}."""
    season_id: str
    season_start: str
    season_end: str
    total_participants: int
    total_predictions: int
    winner: Optional[dict] = None
    top_10: list = Field(default_factory=list)
    user_final_rank: Optional[int] = None
    user_total_points: int = 0
    user_percentile: Optional[float] = None
    user_rank_change: Optional[int] = None
