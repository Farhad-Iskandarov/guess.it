"""
Notifications Routes - Real-time notification system
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# ==================== Helpers ====================

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

async def get_current_user(request: Request, db: AsyncIOMotorDatabase) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    from datetime import datetime, timezone
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ==================== Create Notification Helper (used by other modules) ====================

async def create_notification(db, user_id: str, notif_type: str, message: str, data: dict = None):
    """Create a notification and push via WebSocket if available"""
    notif_id = f"notif_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "notification_id": notif_id,
        "user_id": user_id,
        "type": notif_type,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": now
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)

    # Try to push via WS
    try:
        from routes.messages import notification_manager
        await notification_manager.notify(user_id, {
            "type": "notification",
            "notification": doc
        })
    except Exception as e:
        logger.warning(f"Failed to push notification via WS: {e}")

    return doc

# ==================== Routes ====================

@router.get("")
async def get_notifications(
    request: Request,
    limit: int = 30,
    offset: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user notifications"""
    user = await get_current_user(request, db)

    notifications = await db.notifications.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(min(limit, 50)).to_list(50)

    unread = await db.notifications.count_documents({
        "user_id": user["user_id"], "read": False
    })

    return {"notifications": notifications, "unread_count": unread, "total": len(notifications)}

@router.get("/unread-count")
async def get_unread_count(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get unread notification count"""
    user = await get_current_user(request, db)
    count = await db.notifications.count_documents({
        "user_id": user["user_id"], "read": False
    })
    return {"count": count}

@router.post("/read/{notification_id}")
async def mark_notification_read(
    notification_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Mark a notification as read"""
    user = await get_current_user(request, db)
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}

@router.post("/read-all")
async def mark_all_read(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Mark all notifications as read"""
    user = await get_current_user(request, db)
    result = await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"success": True, "marked": result.modified_count}
