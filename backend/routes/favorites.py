"""
Favorites Routes - Favorite clubs AND favorite matches
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator
from typing import Optional
import re
import html
import logging

from routes.auth import validate_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/favorites", tags=["Favorites"])


def sanitize_text(text: str) -> str:
    if not text:
        return text
    text = re.sub(r'<[^>]+>', '', text)
    text = html.escape(text, quote=True)
    text = text.replace('\x00', '')
    return text.strip()


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db


async def get_current_user(request: Request, db: AsyncIOMotorDatabase):
    session_id = request.cookies.get("session_token")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await validate_session(db, session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


class FavoriteClubRequest(BaseModel):
    team_id: int
    team_name: str
    team_crest: Optional[str] = None


class FavoriteMatchRequest(BaseModel):
    match_id: int
    home_team: str
    away_team: str
    home_crest: Optional[str] = None
    away_crest: Optional[str] = None
    competition: str
    date_time: Optional[str] = None
    status: Optional[str] = None
    score_home: Optional[int] = None
    score_away: Optional[int] = None

    @field_validator('home_team', 'away_team', 'competition')
    @classmethod
    def sanitize_names(cls, v):
        return sanitize_text(v)


# ==================== Favorite Clubs ====================

@router.get("/clubs")
async def get_favorite_clubs(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    user = await get_current_user(request, db)
    favorites = await db.favorites.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    return {"favorites": favorites}


@router.post("/clubs")
async def add_favorite_club(
    body: FavoriteClubRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    user = await get_current_user(request, db)
    user_id = user["user_id"]

    existing = await db.favorites.find_one(
        {"user_id": user_id, "team_id": body.team_id},
        {"_id": 0}
    )
    if existing:
        return {"message": "Already in favorites", "favorite": existing}

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user_id,
        "team_id": body.team_id,
        "team_name": body.team_name,
        "team_crest": body.team_crest,
        "created_at": now,
    }
    await db.favorites.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Club added to favorites", "favorite": doc}


@router.delete("/clubs/{team_id}")
async def remove_favorite_club(
    team_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    user = await get_current_user(request, db)
    result = await db.favorites.delete_one(
        {"user_id": user["user_id"], "team_id": team_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"message": "Club removed from favorites"}


# ==================== Favorite Matches ====================

@router.get("/matches")
async def get_favorite_matches(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user's favorite matches"""
    user = await get_current_user(request, db)
    favorites = await db.favorite_matches.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"favorites": favorites}


@router.post("/matches")
async def add_favorite_match(
    body: FavoriteMatchRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Add a match to favorites"""
    user = await get_current_user(request, db)
    user_id = user["user_id"]

    existing = await db.favorite_matches.find_one(
        {"user_id": user_id, "match_id": body.match_id},
        {"_id": 0}
    )
    if existing:
        return {"message": "Match already in favorites", "favorite": existing}

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user_id,
        "match_id": body.match_id,
        "home_team": body.home_team,
        "away_team": body.away_team,
        "home_crest": body.home_crest,
        "away_crest": body.away_crest,
        "competition": body.competition,
        "date_time": body.date_time,
        "status": body.status,
        "score_home": body.score_home,
        "score_away": body.score_away,
        "created_at": now,
    }
    await db.favorite_matches.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Match added to favorites", "favorite": doc}


@router.delete("/matches/{match_id}")
async def remove_favorite_match(
    match_id: int,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Remove a match from favorites"""
    user = await get_current_user(request, db)
    result = await db.favorite_matches.delete_one(
        {"user_id": user["user_id"], "match_id": match_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite match not found")
    return {"message": "Match removed from favorites"}
