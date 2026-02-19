from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
import logging

from routes.auth import validate_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/favorites", tags=["Favorites"])


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db


async def get_current_user(request: Request, db: AsyncIOMotorDatabase):
    session_id = request.cookies.get("session_id")
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


@router.get("/clubs")
async def get_favorite_clubs(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user's favorite clubs."""
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
    """Add a club to favorites. Prevents duplicates."""
    user = await get_current_user(request, db)
    user_id = user["user_id"]

    # Check for duplicate
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
    """Remove a club from favorites."""
    user = await get_current_user(request, db)
    result = await db.favorites.delete_one(
        {"user_id": user["user_id"], "team_id": team_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"message": "Club removed from favorites"}
