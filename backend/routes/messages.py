"""
Messages Routes - Real-time messaging between friends
With delivery/read status, rate limiting, security hardening, and match sharing
"""
from fastapi import APIRouter, HTTPException, Request, Depends, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator
from typing import Optional, List
import asyncio
import logging
import uuid
import re
import html
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/messages", tags=["Messages"])

# ==================== Security: Input Sanitization ====================

def sanitize_text(text: str) -> str:
    """Sanitize user text input - strip HTML tags, escape special chars"""
    if not text:
        return text
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Escape HTML entities
    text = html.escape(text, quote=True)
    # Remove null bytes
    text = text.replace('\x00', '')
    # Limit consecutive newlines
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    return text.strip()

# ==================== Rate Limiting ====================

class RateLimiter:
    """Simple in-memory rate limiter per user"""
    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def check(self, user_id: str) -> bool:
        now = time.time()
        async with self._lock:
            if user_id not in self.requests:
                self.requests[user_id] = []
            # Clean old entries
            self.requests[user_id] = [t for t in self.requests[user_id] if now - t < self.window]
            if len(self.requests[user_id]) >= self.max_requests:
                return False
            self.requests[user_id].append(now)
            return True

message_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)

# ==================== Models ====================

class SendMessageRequest(BaseModel):
    receiver_id: str
    message: str
    message_type: str = "text"
    match_data: Optional[dict] = None

    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        v = v.strip()
        if not v or len(v) > 2000:
            raise ValueError('Message must be 1-2000 characters')
        return sanitize_text(v)

    @field_validator('message_type')
    @classmethod
    def validate_type(cls, v):
        if v not in ('text', 'match_share'):
            raise ValueError('Invalid message type')
        return v

    @field_validator('match_data')
    @classmethod
    def validate_match_data(cls, v, info):
        if info.data.get('message_type') == 'match_share':
            if not v or not isinstance(v, dict):
                raise ValueError('match_data required for match_share')
            # Sanitize all string fields in match_data
            allowed_keys = {'match_id', 'homeTeam', 'awayTeam', 'score', 'status', 'dateTime', 'competition', 'matchMinute'}
            sanitized = {}
            for k, val in v.items():
                if k in allowed_keys:
                    if isinstance(val, str):
                        sanitized[k] = sanitize_text(val)
                    elif isinstance(val, dict):
                        sanitized[k] = {sk: sanitize_text(sv) if isinstance(sv, str) else sv for sk, sv in val.items()}
                    else:
                        sanitized[k] = val
            return sanitized
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
    """Manages WebSocket for all real-time notifications"""
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


async def send_system_message(db, sender_id: str, receiver_id: str, message: str, 
                              message_type: str = "text", metadata: dict = None):
    """
    Send a system/automated message between users.
    Used for match invitations, notifications, etc.
    """
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    # Get sender info
    sender = await db.users.find_one({"user_id": sender_id}, {"_id": 0, "nickname": 1, "picture": 1})
    
    msg_doc = {
        "message_id": msg_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "message": message,
        "message_type": message_type,
        "match_data": metadata,
        "created_at": now,
        "delivered": False,
        "delivered_at": None,
        "read": False,
        "read_at": None,
        "is_system": True
    }
    await db.messages.insert_one(msg_doc)
    
    # Send via chat WS
    await chat_manager.send_to_user(receiver_id, {
        "type": "new_message",
        "message": {
            "message_id": msg_id,
            "sender_id": sender_id,
            "sender_nickname": sender.get("nickname") if sender else "System",
            "sender_picture": sender.get("picture") if sender else None,
            "message": message,
            "message_type": message_type,
            "match_data": metadata,
            "created_at": now,
            "delivered": True,
            "read": False
        }
    })
    
    # Also send via notification WS
    await notification_manager.notify(receiver_id, {
        "type": "new_message_notification",
        "sender_id": sender_id,
        "sender_nickname": sender.get("nickname") if sender else "System",
        "preview": message[:50]
    })
    
    return msg_id


# ==================== Routes ====================

@router.post("/send")
async def send_message_route(
    data: SendMessageRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    user = await get_current_user(request, db)
    sender_id = user["user_id"]
    receiver_id = data.receiver_id

    if sender_id == receiver_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Rate limiting
    if not await message_rate_limiter.check(sender_id):
        raise HTTPException(status_code=429, detail="Too many messages. Please wait a moment.")

    if not await are_friends(db, sender_id, receiver_id):
        raise HTTPException(status_code=403, detail="You can only message friends")

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    # Check if receiver is online (for delivery status)
    receiver_online = chat_manager.is_online(receiver_id) or notification_manager.is_online(receiver_id)

    msg_doc = {
        "message_id": msg_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "message": data.message,
        "message_type": data.message_type,
        "match_data": data.match_data if data.message_type == "match_share" else None,
        "created_at": now,
        "delivered": receiver_online,
        "delivered_at": now if receiver_online else None,
        "read": False,
        "read_at": None
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
            "message_type": data.message_type,
            "match_data": data.match_data if data.message_type == "match_share" else None,
            "created_at": now,
            "delivered": True,
            "read": False
        }
    })

    # If receiver is online, send delivery confirmation back to sender
    if receiver_online:
        await chat_manager.send_to_user(sender_id, {
            "type": "message_delivered",
            "message_id": msg_id,
            "delivered_at": now
        })

    # Also send via notification WS
    preview = data.message[:50] if data.message_type == "text" else "Shared a match"
    await notification_manager.notify(receiver_id, {
        "type": "new_message_notification",
        "sender_id": sender_id,
        "sender_nickname": user.get("nickname"),
        "preview": preview
    })

    return {
        "success": True,
        "message_id": msg_id,
        "created_at": now,
        "delivered": receiver_online
    }

@router.get("/conversations")
async def get_conversations(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get list of conversations (friends with last message + unread count)"""
    user = await get_current_user(request, db)
    uid = user["user_id"]

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

        last_msg = await db.messages.find_one(
            {"$or": [
                {"sender_id": uid, "receiver_id": fid},
                {"sender_id": fid, "receiver_id": uid}
            ]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )

        unread = await db.messages.count_documents({
            "sender_id": fid, "receiver_id": uid, "read": False
        })

        is_online = chat_manager.is_online(fid) or notification_manager.is_online(fid)
        show_online = friend.get("online_visibility", True)

        last_msg_data = None
        if last_msg:
            last_msg_data = {
                "message": last_msg["message"][:80] if last_msg.get("message_type", "text") == "text" else "Shared a match",
                "created_at": last_msg["created_at"],
                "is_mine": last_msg["sender_id"] == uid,
                "message_type": last_msg.get("message_type", "text")
            }

        conversations.append({
            "user_id": fid,
            "nickname": friend.get("nickname"),
            "picture": friend.get("picture"),
            "level": friend.get("level", 0),
            "points": friend.get("points", 0),
            "is_online": is_online if show_online else None,
            "last_seen": friend.get("last_seen") if show_online else None,
            "last_message": last_msg_data,
            "unread_count": unread
        })

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

    messages.reverse()

    # Check read receipt preferences
    friend = await db.users.find_one({"user_id": friend_id}, {"_id": 0})
    user_read_receipts = user.get("read_receipts_enabled", True)
    friend_read_receipts = friend.get("read_receipts_enabled", True) if friend else True
    user_delivery_status = user.get("delivery_status_enabled", True)
    friend_delivery_status = friend.get("delivery_status_enabled", True) if friend else True

    # Filter status based on privacy settings
    for msg in messages:
        if msg["sender_id"] == uid:
            # For messages I sent: show delivery/read only if recipient allows it
            if not friend_read_receipts:
                msg["read"] = False
                msg["read_at"] = None
            if not friend_delivery_status:
                msg["delivered"] = msg.get("delivered", False)
        else:
            # Messages from friend: mark delivered if seen
            if not msg.get("delivered"):
                msg["delivered"] = True

    return {
        "messages": messages,
        "count": len(messages),
        "privacy": {
            "read_receipts": user_read_receipts and friend_read_receipts,
            "delivery_status": user_delivery_status and friend_delivery_status
        }
    }

@router.post("/read/{friend_id}")
async def mark_messages_read(
    friend_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Mark all messages from friend as read"""
    user = await get_current_user(request, db)
    uid = user["user_id"]
    now = datetime.now(timezone.utc).isoformat()

    result = await db.messages.update_many(
        {"sender_id": friend_id, "receiver_id": uid, "read": False},
        {"$set": {"read": True, "read_at": now}}
    )

    # Also mark undelivered as delivered
    await db.messages.update_many(
        {"sender_id": friend_id, "receiver_id": uid, "delivered": False},
        {"$set": {"delivered": True, "delivered_at": now}}
    )

    # Check if user has read receipts enabled before notifying sender
    user_settings = user.get("read_receipts_enabled", True)
    if user_settings and result.modified_count > 0:
        await chat_manager.send_to_user(friend_id, {
            "type": "messages_read",
            "reader_id": uid,
            "read_at": now
        })

    return {"success": True, "marked_read": result.modified_count}

@router.post("/delivered/{friend_id}")
async def mark_messages_delivered(
    friend_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Mark all undelivered messages from friend as delivered"""
    user = await get_current_user(request, db)
    uid = user["user_id"]
    now = datetime.now(timezone.utc).isoformat()

    result = await db.messages.update_many(
        {"sender_id": friend_id, "receiver_id": uid, "delivered": False},
        {"$set": {"delivered": True, "delivered_at": now}}
    )

    # Notify sender about delivery
    if result.modified_count > 0:
        user_settings = user.get("delivery_status_enabled", True)
        if user_settings:
            await chat_manager.send_to_user(friend_id, {
                "type": "messages_delivered",
                "receiver_id": uid,
                "delivered_at": now
            })

    return {"success": True, "marked_delivered": result.modified_count}

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
