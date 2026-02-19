"""
Messages Routes - Real-time messaging between friends
"""
from fastapi import APIRouter, HTTPException, Request, Depends, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator
from typing import Optional, List
import asyncio
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/messages", tags=["Messages"])

# ==================== Models ====================

class SendMessageRequest(BaseModel):
    receiver_id: str
    message: str

    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        v = v.strip()
        if not v or len(v) > 2000:
            raise ValueError('Message must be 1-2000 characters')
        return v

# ==================== WebSocket Manager ====================

class ChatWSManager:
    def __init__(self):
        self.user_connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        async with self._lock:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(ws)
        logger.info(f"Chat WS connected: {user_id}")

    async def disconnect(self, ws: WebSocket, user_id: str):
        async with self._lock:
            if user_id in self.user_connections:
                if ws in self.user_connections[user_id]:
                    self.user_connections[user_id].remove(ws)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
        logger.info(f"Chat WS disconnected: {user_id}")

    async def send_to_user(self, user_id: str, data: dict):
        async with self._lock:
            connections = list(self.user_connections.get(user_id, []))
        dead = []
        for conn in connections:
            try:
                await conn.send_json(data)
            except Exception:
                dead.append(conn)
        for c in dead:
            await self.disconnect(c, user_id)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

chat_manager = ChatWSManager()

# ==================== Notification Manager (shared) ====================

class UnifiedNotificationManager:
    """Manages WebSocket for all real-time notifications (messages, friend requests, etc.)"""
    def __init__(self):
        self.user_connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        async with self._lock:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(ws)

    async def disconnect(self, ws: WebSocket, user_id: str):
        async with self._lock:
            if user_id in self.user_connections:
                if ws in self.user_connections[user_id]:
                    self.user_connections[user_id].remove(ws)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]

    async def notify(self, user_id: str, data: dict):
        async with self._lock:
            connections = list(self.user_connections.get(user_id, []))
        dead = []
        for conn in connections:
            try:
                await conn.send_json(data)
            except Exception:
                dead.append(conn)
        for c in dead:
            await self.disconnect(c, user_id)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

notification_manager = UnifiedNotificationManager()

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

async def are_friends(db, user_a: str, user_b: str) -> bool:
    f = await db.friendships.find_one({
        "$or": [
            {"user_a": user_a, "user_b": user_b},
            {"user_a": user_b, "user_b": user_a}
        ]
    })
    return f is not None

# ==================== Routes ====================

@router.post("/send")
async def send_message(
    data: SendMessageRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    user = await get_current_user(request, db)
    sender_id = user["user_id"]
    receiver_id = data.receiver_id

    if sender_id == receiver_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    if not await are_friends(db, sender_id, receiver_id):
        raise HTTPException(status_code=403, detail="You can only message friends")

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    msg_doc = {
        "message_id": msg_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "message": data.message,
        "created_at": now,
        "read": False
    }
    await db.messages.insert_one(msg_doc)
    msg_doc.pop("_id", None)

    # Real-time: send to receiver via chat WS
    await chat_manager.send_to_user(receiver_id, {
        "type": "new_message",
        "message": {
            "message_id": msg_id,
            "sender_id": sender_id,
            "sender_nickname": user.get("nickname"),
            "sender_picture": user.get("picture"),
            "message": data.message,
            "created_at": now,
            "read": False
        }
    })

    # Also send via notification WS
    await notification_manager.notify(receiver_id, {
        "type": "new_message_notification",
        "sender_id": sender_id,
        "sender_nickname": user.get("nickname"),
        "preview": data.message[:50]
    })

    return {
        "success": True,
        "message_id": msg_id,
        "created_at": now
    }

@router.get("/conversations")
async def get_conversations(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get list of conversations (friends with last message + unread count)"""
    user = await get_current_user(request, db)
    uid = user["user_id"]

    # Get friends
    friendships = await db.friendships.find({
        "$or": [{"user_a": uid}, {"user_b": uid}]
    }, {"_id": 0}).to_list(1000)

    friend_ids = []
    for f in friendships:
        friend_ids.append(f["user_b"] if f["user_a"] == uid else f["user_a"])

    conversations = []
    for fid in friend_ids:
        friend = await db.users.find_one({"user_id": fid}, {"_id": 0})
        if not friend:
            continue

        # Last message between users
        last_msg = await db.messages.find_one(
            {"$or": [
                {"sender_id": uid, "receiver_id": fid},
                {"sender_id": fid, "receiver_id": uid}
            ]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )

        # Unread count
        unread = await db.messages.count_documents({
            "sender_id": fid, "receiver_id": uid, "read": False
        })

        # Online status
        is_online = chat_manager.is_online(fid) or notification_manager.is_online(fid)
        show_online = friend.get("online_visibility", True)

        conversations.append({
            "user_id": fid,
            "nickname": friend.get("nickname"),
            "picture": friend.get("picture"),
            "level": friend.get("level", 0),
            "points": friend.get("points", 0),
            "is_online": is_online if show_online else None,
            "last_seen": friend.get("last_seen") if show_online else None,
            "last_message": {
                "message": last_msg["message"][:80] if last_msg else None,
                "created_at": last_msg["created_at"] if last_msg else None,
                "is_mine": last_msg["sender_id"] == uid if last_msg else False
            } if last_msg else None,
            "unread_count": unread
        })

    # Sort: unread first, then by last message time
    conversations.sort(key=lambda c: (
        -(c["unread_count"] or 0),
        -(datetime.fromisoformat(c["last_message"]["created_at"]).timestamp() if c.get("last_message") and c["last_message"].get("created_at") else 0)
    ))

    total_unread = sum(c["unread_count"] for c in conversations)

    return {"conversations": conversations, "total_unread": total_unread}

@router.get("/history/{friend_id}")
async def get_chat_history(
    friend_id: str,
    request: Request,
    limit: int = 50,
    before: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get chat history with a friend (paginated)"""
    user = await get_current_user(request, db)
    uid = user["user_id"]

    if not await are_friends(db, uid, friend_id):
        raise HTTPException(status_code=403, detail="Not friends")

    query = {
        "$or": [
            {"sender_id": uid, "receiver_id": friend_id},
            {"sender_id": friend_id, "receiver_id": uid}
        ]
    }
    if before:
        query["created_at"] = {"$lt": before}

    messages = await db.messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(min(limit, 100)).to_list(100)

    messages.reverse()  # Oldest first
    return {"messages": messages, "count": len(messages)}

@router.post("/read/{friend_id}")
async def mark_messages_read(
    friend_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Mark all messages from friend as read"""
    user = await get_current_user(request, db)
    uid = user["user_id"]

    result = await db.messages.update_many(
        {"sender_id": friend_id, "receiver_id": uid, "read": False},
        {"$set": {"read": True}}
    )

    # Notify sender that messages were read
    await chat_manager.send_to_user(friend_id, {
        "type": "messages_read",
        "reader_id": uid
    })

    return {"success": True, "marked_read": result.modified_count}

@router.get("/unread-count")
async def get_total_unread(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get total unread message count"""
    user = await get_current_user(request, db)
    count = await db.messages.count_documents({
        "receiver_id": user["user_id"], "read": False
    })
    return {"count": count}
