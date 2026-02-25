"""
Friends Routes - Real-time friendship system
"""
from fastapi import APIRouter, HTTPException, Request, Depends, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator
from typing import Optional, List
import asyncio
import logging
import re

logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/friends", tags=["Friends"])

# ==================== Models ====================

class SendFriendRequestModel(BaseModel):
    """Send friend request by nickname"""
    nickname: str
    
    @field_validator('nickname')
    @classmethod
    def validate_nickname(cls, v):
        if len(v) < 3 or len(v) > 20:
            raise ValueError('Invalid nickname')
        return v

class FriendRequestResponse(BaseModel):
    """Friend request data"""
    request_id: str
    sender_id: str
    sender_nickname: str
    sender_picture: Optional[str]
    sender_level: int
    sender_points: int
    receiver_id: str
    receiver_nickname: str
    receiver_picture: Optional[str]
    receiver_level: int
    receiver_points: int
    status: str
    created_at: str

class FriendResponse(BaseModel):
    """Friend data"""
    user_id: str
    nickname: str
    picture: Optional[str]
    level: int
    points: int

class FriendsListResponse(BaseModel):
    """Friends list response"""
    friends: List[FriendResponse]
    total: int

class PendingRequestsResponse(BaseModel):
    """Pending requests response"""
    incoming: List[FriendRequestResponse]
    outgoing: List[FriendRequestResponse]
    incoming_count: int
    outgoing_count: int

# ==================== WebSocket Manager for Friend Notifications ====================

class FriendNotificationManager:
    """Manages WebSocket connections for friend request notifications"""
    
    def __init__(self):
        # user_id -> list of websockets
        self.user_connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        async with self._lock:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)
        logger.info(f"Friend WS connected for user {user_id}. Total connections: {len(self.user_connections.get(user_id, []))}")
    
    async def disconnect(self, websocket: WebSocket, user_id: str):
        async with self._lock:
            if user_id in self.user_connections:
                if websocket in self.user_connections[user_id]:
                    self.user_connections[user_id].remove(websocket)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
        logger.info(f"Friend WS disconnected for user {user_id}")
    
    async def notify_user(self, user_id: str, data: dict):
        """Send notification to specific user"""
        async with self._lock:
            connections = list(self.user_connections.get(user_id, []))
        
        disconnected = []
        for connection in connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.warning(f"Failed to send to user {user_id}: {e}")
                disconnected.append(connection)
        
        for conn in disconnected:
            await self.disconnect(conn, user_id)
    
    async def get_connection_count(self, user_id: str) -> int:
        async with self._lock:
            return len(self.user_connections.get(user_id, []))


# Global manager instance
friend_manager = FriendNotificationManager()

# ==================== Helper Functions ====================

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

async def get_current_user(request: Request, db: AsyncIOMotorDatabase) -> dict:
    """Get current authenticated user from session"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate session
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    """Get user by ID"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user

async def get_user_by_nickname(db: AsyncIOMotorDatabase, nickname: str) -> dict:
    """Get user by nickname (case-insensitive)"""
    user = await db.users.find_one(
        {"nickname": {"$regex": f"^{re.escape(nickname)}$", "$options": "i"}},
        {"_id": 0}
    )
    return user

def format_friend_request(request: dict, sender: dict, receiver: dict) -> dict:
    """Format friend request for response"""
    return {
        "request_id": request.get("request_id"),
        "sender_id": request.get("sender_id"),
        "sender_nickname": sender.get("nickname") if sender else "Unknown",
        "sender_picture": sender.get("picture") if sender else None,
        "sender_level": sender.get("level", 0) if sender else 0,
        "sender_points": sender.get("points", 0) if sender else 0,
        "receiver_id": request.get("receiver_id"),
        "receiver_nickname": receiver.get("nickname") if receiver else "Unknown",
        "receiver_picture": receiver.get("picture") if receiver else None,
        "receiver_level": receiver.get("level", 0) if receiver else 0,
        "receiver_points": receiver.get("points", 0) if receiver else 0,
        "status": request.get("status"),
        "created_at": request.get("created_at")
    }

def format_friend(user: dict) -> dict:
    """Format user as friend"""
    return {
        "user_id": user.get("user_id"),
        "nickname": user.get("nickname"),
        "picture": user.get("picture"),
        "level": user.get("level", 0),
        "points": user.get("points", 0)
    }

# ==================== Routes ====================

@router.post("/request")
async def send_friend_request(
    data: SendFriendRequestModel,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Send a friend request to another user by nickname"""
    user = await get_current_user(request, db)
    
    # Find target user
    target_user = await get_user_by_nickname(db, data.nickname)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot send to self
    if target_user["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if already friends
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user_a": user["user_id"], "user_b": target_user["user_id"]},
            {"user_a": target_user["user_id"], "user_b": user["user_id"]}
        ]
    })
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Already friends with this user")
    
    # Check for existing pending request (in either direction)
    existing_request = await db.friend_requests.find_one({
        "$or": [
            {"sender_id": user["user_id"], "receiver_id": target_user["user_id"], "status": "pending"},
            {"sender_id": target_user["user_id"], "receiver_id": user["user_id"], "status": "pending"}
        ]
    })
    if existing_request:
        if existing_request["sender_id"] == user["user_id"]:
            raise HTTPException(status_code=400, detail="Friend request already sent")
        else:
            raise HTTPException(status_code=400, detail="This user has already sent you a request. Check your pending requests.")
    
    # Create friend request
    import uuid
    request_id = f"freq_{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).isoformat()
    
    friend_request = {
        "request_id": request_id,
        "sender_id": user["user_id"],
        "receiver_id": target_user["user_id"],
        "status": "pending",
        "created_at": created_at
    }
    
    await db.friend_requests.insert_one(friend_request)
    
    # Format response
    formatted = format_friend_request(friend_request, user, target_user)
    
    # Send real-time notification to receiver
    await friend_manager.notify_user(target_user["user_id"], {
        "type": "friend_request_received",
        "request": formatted
    })
    
    # Create persistent notification
    from routes.notifications import create_notification
    await create_notification(
        db, target_user["user_id"], "friend_request",
        f"{user.get('nickname')} sent you a friend request",
        {"sender_id": user["user_id"], "sender_nickname": user.get("nickname"), "request_id": request_id}
    )
    
    logger.info(f"Friend request sent from {user['user_id']} to {target_user['user_id']}")
    
    return {
        "success": True,
        "message": f"Friend request sent to {target_user['nickname']}",
        "request": formatted
    }

@router.get("/requests/pending", response_model=PendingRequestsResponse)
async def get_pending_requests(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all pending friend requests (incoming and outgoing)"""
    user = await get_current_user(request, db)
    
    # Get incoming requests
    incoming_cursor = db.friend_requests.find(
        {"receiver_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1)
    incoming_requests = await incoming_cursor.to_list(100)
    
    # Get outgoing requests
    outgoing_cursor = db.friend_requests.find(
        {"sender_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1)
    outgoing_requests = await outgoing_cursor.to_list(100)
    
    # Fetch user data for all requests
    incoming_formatted = []
    for req in incoming_requests:
        sender = await get_user_by_id(db, req["sender_id"])
        incoming_formatted.append(format_friend_request(req, sender, user))
    
    outgoing_formatted = []
    for req in outgoing_requests:
        receiver = await get_user_by_id(db, req["receiver_id"])
        outgoing_formatted.append(format_friend_request(req, user, receiver))
    
    return PendingRequestsResponse(
        incoming=incoming_formatted,
        outgoing=outgoing_formatted,
        incoming_count=len(incoming_formatted),
        outgoing_count=len(outgoing_formatted)
    )

@router.get("/requests/count")
async def get_pending_count(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get count of pending incoming friend requests (for badge)"""
    user = await get_current_user(request, db)
    
    count = await db.friend_requests.count_documents({
        "receiver_id": user["user_id"],
        "status": "pending"
    })
    
    return {"count": count}

@router.post("/request/{request_id}/accept")
async def accept_friend_request(
    request_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Accept a friend request"""
    user = await get_current_user(request, db)
    
    # Find the request
    friend_request = await db.friend_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Must be the receiver
    if friend_request["receiver_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to accept this request")
    
    # Must be pending
    if friend_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {friend_request['status']}")
    
    # Update request status
    await db.friend_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create friendship (bidirectional stored once)
    import uuid
    friendship_id = f"friend_{uuid.uuid4().hex[:12]}"
    
    await db.friendships.insert_one({
        "friendship_id": friendship_id,
        "user_a": friend_request["sender_id"],
        "user_b": friend_request["receiver_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get sender data
    sender = await get_user_by_id(db, friend_request["sender_id"])
    
    # Notify sender that request was accepted
    await friend_manager.notify_user(friend_request["sender_id"], {
        "type": "friend_request_accepted",
        "friend": format_friend(user)
    })
    
    # Notify current user (receiver) to update their friends list
    await friend_manager.notify_user(user["user_id"], {
        "type": "friend_added",
        "friend": format_friend(sender) if sender else None
    })
    
    # Create persistent notification for the sender
    from routes.notifications import create_notification
    await create_notification(
        db, friend_request["sender_id"], "friend_accepted",
        f"{user.get('nickname')} accepted your friend request",
        {"friend_id": user["user_id"], "friend_nickname": user.get("nickname")}
    )
    
    logger.info(f"Friend request {request_id} accepted. {user['user_id']} and {friend_request['sender_id']} are now friends")
    
    return {
        "success": True,
        "message": f"You are now friends with {sender['nickname'] if sender else 'user'}",
        "friend": format_friend(sender) if sender else None
    }

@router.post("/request/{request_id}/decline")
async def decline_friend_request(
    request_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Decline a friend request"""
    user = await get_current_user(request, db)
    
    # Find the request
    friend_request = await db.friend_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Must be the receiver
    if friend_request["receiver_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to decline this request")
    
    # Must be pending
    if friend_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {friend_request['status']}")
    
    # Update request status
    await db.friend_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify receiver (self) to update pending count
    await friend_manager.notify_user(user["user_id"], {
        "type": "friend_request_declined",
        "request_id": request_id
    })
    
    logger.info(f"Friend request {request_id} declined by {user['user_id']}")
    
    return {
        "success": True,
        "message": "Friend request declined"
    }

@router.post("/request/{request_id}/cancel")
async def cancel_friend_request(
    request_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Cancel a sent friend request"""
    user = await get_current_user(request, db)
    
    # Find the request
    friend_request = await db.friend_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Must be the sender
    if friend_request["sender_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this request")
    
    # Must be pending
    if friend_request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {friend_request['status']}")
    
    # Delete the request
    await db.friend_requests.delete_one({"request_id": request_id})
    
    # Notify receiver to update their pending count
    await friend_manager.notify_user(friend_request["receiver_id"], {
        "type": "friend_request_cancelled",
        "request_id": request_id
    })
    
    logger.info(f"Friend request {request_id} cancelled by {user['user_id']}")
    
    return {
        "success": True,
        "message": "Friend request cancelled"
    }

@router.get("/list", response_model=FriendsListResponse)
async def get_friends_list(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get list of friends"""
    user = await get_current_user(request, db)
    
    # Find all friendships where user is involved
    friendships_cursor = db.friendships.find({
        "$or": [
            {"user_a": user["user_id"]},
            {"user_b": user["user_id"]}
        ]
    }, {"_id": 0})
    friendships = await friendships_cursor.to_list(1000)
    
    # Get friend user IDs
    friend_ids = []
    for f in friendships:
        if f["user_a"] == user["user_id"]:
            friend_ids.append(f["user_b"])
        else:
            friend_ids.append(f["user_a"])
    
    # Fetch friend data
    friends = []
    for friend_id in friend_ids:
        friend_user = await get_user_by_id(db, friend_id)
        if friend_user:
            friends.append(format_friend(friend_user))
    
    # Sort by nickname
    friends.sort(key=lambda x: (x.get("nickname") or "").lower())
    
    return FriendsListResponse(friends=friends, total=len(friends))

@router.delete("/{friend_user_id}")
async def remove_friend(
    friend_user_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Remove a friend"""
    user = await get_current_user(request, db)
    
    # Find and delete the friendship
    result = await db.friendships.delete_one({
        "$or": [
            {"user_a": user["user_id"], "user_b": friend_user_id},
            {"user_a": friend_user_id, "user_b": user["user_id"]}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    # Notify both users
    await friend_manager.notify_user(user["user_id"], {
        "type": "friend_removed",
        "friend_id": friend_user_id
    })
    await friend_manager.notify_user(friend_user_id, {
        "type": "friend_removed",
        "friend_id": user["user_id"]
    })
    
    logger.info(f"Friendship removed between {user['user_id']} and {friend_user_id}")
    
    return {
        "success": True,
        "message": "Friend removed"
    }

@router.get("/search")
async def search_users(
    q: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Search users by nickname (for adding friends)"""
    user = await get_current_user(request, db)
    
    if len(q) < 2:
        return {"users": [], "total": 0}
    
    # Search by nickname (case-insensitive partial match)
    users_cursor = db.users.find(
        {
            "nickname": {"$regex": f".*{re.escape(q)}.*", "$options": "i"},
            "user_id": {"$ne": user["user_id"]},  # Exclude self
            "nickname_set": True  # Only users with nicknames
        },
        {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1, "level": 1, "points": 1}
    ).limit(10)
    
    users = await users_cursor.to_list(10)
    
    # Check friendship status for each user
    results = []
    for u in users:
        # Check if already friends
        is_friend = await db.friendships.find_one({
            "$or": [
                {"user_a": user["user_id"], "user_b": u["user_id"]},
                {"user_a": u["user_id"], "user_b": user["user_id"]}
            ]
        })
        
        # Check for pending request
        pending_request = await db.friend_requests.find_one({
            "$or": [
                {"sender_id": user["user_id"], "receiver_id": u["user_id"], "status": "pending"},
                {"sender_id": u["user_id"], "receiver_id": user["user_id"], "status": "pending"}
            ]
        })
        
        status = "none"
        if is_friend:
            status = "friend"
        elif pending_request:
            if pending_request["sender_id"] == user["user_id"]:
                status = "request_sent"
            else:
                status = "request_received"
        
        results.append({
            "user_id": u["user_id"],
            "nickname": u["nickname"],
            "picture": u.get("picture"),
            "level": u.get("level", 0),
            "points": u.get("points", 0),
            "status": status
        })
    
    return {"users": results, "total": len(results)}


@router.get("/profile/{friend_user_id}")
async def get_friend_profile(
    friend_user_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get a friend's profile (guest view) - only accessible if friends"""
    user = await get_current_user(request, db)

    # Must be friends
    friendship = await db.friendships.find_one({
        "$or": [
            {"user_a": user["user_id"], "user_b": friend_user_id},
            {"user_a": friend_user_id, "user_b": user["user_id"]}
        ]
    })
    if not friendship:
        raise HTTPException(status_code=403, detail="You can only view profiles of your friends")

    friend = await get_user_by_id(db, friend_user_id)
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")

    # Check online visibility preference
    show_online = friend.get("online_visibility", True)

    # Get prediction stats
    total_predictions = await db.predictions.count_documents({"user_id": friend_user_id})
    correct_predictions = await db.predictions.count_documents({"user_id": friend_user_id, "result": "correct"})

    # Determine online status from WS managers
    from routes.messages import chat_manager, notification_manager
    is_online = chat_manager.is_online(friend_user_id) or notification_manager.is_online(friend_user_id)

    return {
        "user_id": friend["user_id"],
        "nickname": friend.get("nickname"),
        "picture": friend.get("picture"),
        "level": friend.get("level", 0),
        "points": friend.get("points", 0),
        "is_online": is_online if show_online else None,
        "last_seen": friend.get("last_seen") if show_online else None,
        "total_predictions": total_predictions,
        "correct_predictions": correct_predictions,
        "created_at": friend.get("created_at"),
        "is_friend": True
    }


# ==================== Match Invitations ====================

class MatchInvitationModel(BaseModel):
    """Send match prediction invitation"""
    friend_user_id: str
    match_id: int
    home_team: str = ""
    away_team: str = ""
    match_date: str = ""
    match_card: dict = None


@router.post("/invite/match")
async def invite_friend_to_match(
    data: MatchInvitationModel,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Invite a friend to predict on a specific match.
    Creates both a notification and a chat message.
    Prevents duplicate invitations for the same match.
    """
    user = await get_current_user(request, db)
    
    # Verify they are friends
    friendship = await db.friendships.find_one({
        "$or": [
            {"user_a": user["user_id"], "user_b": data.friend_user_id},
            {"user_a": data.friend_user_id, "user_b": user["user_id"]}
        ]
    })
    if not friendship:
        raise HTTPException(status_code=403, detail="You can only invite friends")
    
    # Check for existing invitation for this match from this user
    existing = await db.match_invitations.find_one({
        "sender_id": user["user_id"],
        "receiver_id": data.friend_user_id,
        "match_id": data.match_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already invited this friend to this match")
    
    # Create invitation record
    import uuid
    invitation_id = f"minv_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    invitation = {
        "invitation_id": invitation_id,
        "sender_id": user["user_id"],
        "receiver_id": data.friend_user_id,
        "match_id": data.match_id,
        "home_team": data.home_team,
        "away_team": data.away_team,
        "match_date": data.match_date,
        "status": "pending",
        "created_at": now
    }
    
    await db.match_invitations.insert_one(invitation)
    
    # Get friend info
    friend = await get_user_by_id(db, data.friend_user_id)
    friend_nickname = friend.get("nickname", "Friend") if friend else "Friend"
    
    # Create notification
    from routes.notifications import create_notification
    notif_message = f"🎯 {user.get('nickname')} invited you to predict on {data.home_team} vs {data.away_team}!"
    
    await create_notification(
        db,
        data.friend_user_id,
        "match_invitation",
        notif_message,
        {
            "invitation_id": invitation_id,
            "sender_id": user["user_id"],
            "sender_nickname": user.get("nickname"),
            "match_id": data.match_id,
            "home_team": data.home_team,
            "away_team": data.away_team,
            "match_date": data.match_date
        }
    )
    
    # Create chat message - send actual match card
    try:
        from routes.messages import send_system_message
        chat_message = f"I invited you to predict on {data.home_team} vs {data.away_team}! Make your guess!"
        if data.match_card:
            match_card_data = data.match_card
        else:
            match_card_data = {
                "match_id": data.match_id,
                "homeTeam": {"name": data.home_team},
                "awayTeam": {"name": data.away_team},
                "competition": "",
                "dateTime": data.match_date,
                "status": "SCHEDULED",
                "score": {}
            }
        await send_system_message(
            db,
            sender_id=user["user_id"],
            receiver_id=data.friend_user_id,
            message=chat_message,
            message_type="match_share",
            metadata=match_card_data
        )
    except Exception as e:
        logger.warning(f"Failed to send chat message for match invitation: {e}")
    
    # Send real-time notification
    await friend_manager.notify_user(data.friend_user_id, {
        "type": "match_invitation",
        "invitation": {
            "invitation_id": invitation_id,
            "sender_nickname": user.get("nickname"),
            "sender_picture": user.get("picture"),
            "match_id": data.match_id,
            "home_team": data.home_team,
            "away_team": data.away_team,
            "match_date": data.match_date
        }
    })
    
    logger.info(f"Match invitation sent from {user['user_id']} to {data.friend_user_id} for match {data.match_id}")
    
    return {
        "success": True,
        "message": f"Invitation sent to {friend_nickname}",
        "invitation_id": invitation_id
    }


@router.get("/invitations/received")
async def get_received_invitations(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get match invitations received by current user"""
    user = await get_current_user(request, db)
    
    invitations = await db.match_invitations.find(
        {"receiver_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with sender info
    result = []
    for inv in invitations:
        sender = await get_user_by_id(db, inv["sender_id"])
        result.append({
            **inv,
            "sender_nickname": sender.get("nickname") if sender else "Unknown",
            "sender_picture": sender.get("picture") if sender else None
        })
    
    return {"invitations": result, "total": len(result)}


@router.post("/invitations/{invitation_id}/dismiss")
async def dismiss_invitation(
    invitation_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Dismiss a match invitation"""
    user = await get_current_user(request, db)
    
    result = await db.match_invitations.update_one(
        {"invitation_id": invitation_id, "receiver_id": user["user_id"]},
        {"$set": {"status": "dismissed", "dismissed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    return {"success": True, "message": "Invitation dismissed"}
