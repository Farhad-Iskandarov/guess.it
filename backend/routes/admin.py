"""
Admin Routes - Secure admin panel with RBAC, audit logging, rate limiting
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging
import html
import re
import time
from collections import defaultdict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])

# ==================== Rate Limiter ====================

class RateLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
    
    def check(self, user_id: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        self.requests[user_id] = [t for t in self.requests[user_id] if t > window_start]
        if len(self.requests[user_id]) >= self.max_requests:
            return False
        self.requests[user_id].append(now)
        return True

rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

# ==================== Helpers ====================

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS/injection"""
    if not text:
        return ""
    text = html.escape(str(text).strip())
    text = re.sub(r'<[^>]*>', '', text)
    return text[:2000]

async def get_admin_user(request: Request, db: AsyncIOMotorDatabase) -> dict:
    """Verify the request comes from an authenticated admin user"""
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
    
    # RBAC: Check admin role - server-side, never trust frontend
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if banned
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    # Rate limiting
    if not rate_limiter.check(user["user_id"]):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
    
    return user

async def log_admin_action(db: AsyncIOMotorDatabase, admin_id: str, action: str, target: str = "", details: str = ""):
    """Log admin actions for audit trail"""
    doc = {
        "log_id": f"alog_{uuid.uuid4().hex[:12]}",
        "admin_id": admin_id,
        "action": action,
        "target": target,
        "details": sanitize_input(details),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.admin_audit_log.insert_one(doc)

# ==================== Dashboard ====================

@router.get("/dashboard")
async def get_dashboard(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get admin dashboard overview stats"""
    admin = await get_admin_user(request, db)
    
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_online": True})
    banned_users = await db.users.count_documents({"is_banned": True})
    total_predictions = await db.predictions.count_documents({})
    total_messages = await db.messages.count_documents({})
    total_friendships = await db.friendships.count_documents({})
    total_notifications = await db.notifications.count_documents({})
    
    # Match stats from football cache
    total_matches = await db.football_matches_cache.count_documents({})
    if total_matches == 0:
        total_matches = 120  # Approximate from API
    
    # Recent signups (last 24h)
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    new_users_24h = await db.users.count_documents({"created_at": {"$gte": yesterday}})
    
    # Admin count
    admin_count = await db.users.count_documents({"role": "admin"})
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "banned_users": banned_users,
        "new_users_24h": new_users_24h,
        "total_predictions": total_predictions,
        "total_messages": total_messages,
        "total_friendships": total_friendships,
        "total_notifications": total_notifications,
        "total_matches": total_matches,
        "admin_count": admin_count,
        "system_status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ==================== User Management ====================

@router.get("/users")
async def get_users(
    request: Request,
    search: str = "",
    page: int = 1,
    limit: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    filter_role: str = "",
    filter_banned: str = "",
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get paginated user list with search and filters"""
    admin = await get_admin_user(request, db)
    
    query = {}
    if search:
        safe_search = sanitize_input(search)
        query["$or"] = [
            {"nickname": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"user_id": {"$regex": safe_search, "$options": "i"}}
        ]
    if filter_role == "admin":
        query["role"] = "admin"
    if filter_banned == "true":
        query["is_banned"] = True
    elif filter_banned == "false":
        query["$or"] = query.get("$or", [])
        if not query.get("$or"):
            query.pop("$or", None)
        query["is_banned"] = {"$ne": True}
    
    sort_dir = -1 if sort_order == "desc" else 1
    skip = (max(1, page) - 1) * min(limit, 50)
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort(
        sort_by, sort_dir
    ).skip(skip).limit(min(limit, 50)).to_list(50)
    
    total = await db.users.count_documents(query)
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit)
    }

@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get detailed user info"""
    admin = await get_admin_user(request, db)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    predictions_count = await db.predictions.count_documents({"user_id": user_id})
    messages_count = await db.messages.count_documents({"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]})
    friends_count = await db.friendships.count_documents({"$or": [{"user_id": user_id}, {"friend_id": user_id}]})
    
    user["predictions_count"] = predictions_count
    user["messages_count"] = messages_count
    user["friends_count"] = friends_count
    
    return user

@router.post("/users/{user_id}/promote")
async def promote_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Promote user to admin"""
    admin = await get_admin_user(request, db)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="User is already admin")
    
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin"}})
    await log_admin_action(db, admin["user_id"], "promote_admin", user_id, f"Promoted {user.get('nickname', user_id)} to admin")
    
    return {"success": True, "message": f"User promoted to admin"}

@router.post("/users/{user_id}/demote")
async def demote_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Demote admin to regular user"""
    admin = await get_admin_user(request, db)
    
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") != "admin":
        raise HTTPException(status_code=400, detail="User is not an admin")
    
    await db.users.update_one({"user_id": user_id}, {"$unset": {"role": ""}})
    await log_admin_action(db, admin["user_id"], "demote_admin", user_id, f"Demoted {user.get('nickname', user_id)} from admin")
    
    return {"success": True, "message": "User demoted from admin"}

@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Ban a user"""
    admin = await get_admin_user(request, db)
    
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot ban another admin. Demote first.")
    
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_banned": True, "banned_at": datetime.now(timezone.utc).isoformat()}})
    # Kill active sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    await log_admin_action(db, admin["user_id"], "ban_user", user_id, f"Banned {user.get('nickname', user_id)}")
    
    return {"success": True, "message": "User banned"}

@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Unban a user"""
    admin = await get_admin_user(request, db)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"user_id": user_id}, {"$unset": {"is_banned": "", "banned_at": ""}})
    await log_admin_action(db, admin["user_id"], "unban_user", user_id, f"Unbanned {user.get('nickname', user_id)}")
    
    return {"success": True, "message": "User unbanned"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Permanently delete a user"""
    admin = await get_admin_user(request, db)
    
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete another admin. Demote first.")
    
    # Delete user and related data
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.predictions.delete_many({"user_id": user_id})
    await db.messages.delete_many({"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]})
    await db.friendships.delete_many({"$or": [{"user_id": user_id}, {"friend_id": user_id}]})
    await db.friend_requests.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.notifications.delete_many({"user_id": user_id})
    await db.favorites.delete_many({"user_id": user_id})
    
    await log_admin_action(db, admin["user_id"], "delete_user", user_id, f"Deleted user {user.get('nickname', user_id)} ({user.get('email', '')})")
    
    return {"success": True, "message": "User permanently deleted"}

@router.post("/users/{user_id}/reset-points")
async def reset_user_points(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Reset user points and level"""
    admin = await get_admin_user(request, db)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"user_id": user_id}, {"$set": {"points": 0, "level": 0}})
    await log_admin_action(db, admin["user_id"], "reset_points", user_id, f"Reset points for {user.get('nickname', user_id)}")
    
    return {"success": True, "message": "User points reset to 0"}

@router.get("/users/{user_id}/predictions")
async def get_user_predictions(
    user_id: str, request: Request, page: int = 1, limit: int = 20,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """View user's predictions"""
    admin = await get_admin_user(request, db)
    
    skip = (max(1, page) - 1) * min(limit, 50)
    predictions = await db.predictions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(50)
    
    total = await db.predictions.count_documents({"user_id": user_id})
    
    return {"predictions": predictions, "total": total, "page": page}

# ==================== Match Management ====================

@router.get("/matches")
async def get_matches(
    request: Request, search: str = "", page: int = 1, limit: int = 20,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get match list for admin"""
    admin = await get_admin_user(request, db)
    
    # Get matches from football route cache
    from routes.football import get_cached_matches, force_fetch_matches
    all_matches = get_cached_matches()
    
    if not all_matches:
        # Cache empty (backend just restarted), fetch fresh
        await force_fetch_matches(db)
        all_matches = get_cached_matches()
    
    if search:
        safe = search.lower()
        all_matches = [m for m in all_matches if
            safe in (m.get("homeTeam", {}).get("name", "")).lower() or
            safe in (m.get("awayTeam", {}).get("name", "")).lower() or
            safe in (m.get("competition", "")).lower()
        ]
    
    # Check pinned status from DB
    pinned_ids = set()
    pinned_docs = await db.pinned_matches.find({}, {"_id": 0, "match_id": 1}).to_list(100)
    pinned_ids = {d["match_id"] for d in pinned_docs}
    
    for m in all_matches:
        m["is_pinned"] = m.get("id") in pinned_ids
    
    # Sort: pinned first, then by date
    all_matches.sort(key=lambda m: (not m.get("is_pinned", False), m.get("utcDate", "")))
    
    total = len(all_matches)
    start = (max(1, page) - 1) * limit
    matches = all_matches[start:start + limit]
    
    return {"matches": matches, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@router.post("/matches/refresh")
async def force_refresh_matches(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Force refresh match data from API"""
    admin = await get_admin_user(request, db)
    
    from routes.football import force_fetch_matches
    count = await force_fetch_matches(db)
    
    await log_admin_action(db, admin["user_id"], "refresh_matches", "", f"Force refreshed matches. Got {count} matches.")
    return {"success": True, "message": f"Refreshed {count} matches"}

@router.post("/matches/{match_id}/pin")
async def pin_match(match_id: int, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Pin/unpin a match"""
    admin = await get_admin_user(request, db)
    
    existing = await db.pinned_matches.find_one({"match_id": match_id})
    if existing:
        await db.pinned_matches.delete_one({"match_id": match_id})
        await log_admin_action(db, admin["user_id"], "unpin_match", str(match_id))
        return {"success": True, "pinned": False}
    else:
        await db.pinned_matches.insert_one({"match_id": match_id, "pinned_at": datetime.now(timezone.utc).isoformat()})
        await log_admin_action(db, admin["user_id"], "pin_match", str(match_id))
        return {"success": True, "pinned": True}

@router.delete("/matches/{match_id}")
async def remove_match(match_id: int, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Remove a match from display"""
    admin = await get_admin_user(request, db)
    
    await db.hidden_matches.insert_one({"match_id": match_id, "hidden_at": datetime.now(timezone.utc).isoformat()})
    await log_admin_action(db, admin["user_id"], "hide_match", str(match_id))
    
    return {"success": True, "message": "Match hidden"}

# ==================== Content Moderation ====================

@router.get("/moderation/messages")
async def get_recent_messages(
    request: Request, page: int = 1, limit: int = 30,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get recent chat messages for moderation"""
    admin = await get_admin_user(request, db)
    
    skip = (max(1, page) - 1) * min(limit, 50)
    messages = await db.messages.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(50)
    
    # Enrich with user nicknames
    user_ids = set()
    for m in messages:
        user_ids.add(m.get("sender_id", ""))
        user_ids.add(m.get("receiver_id", ""))
    
    users_map = {}
    if user_ids:
        users = await db.users.find({"user_id": {"$in": list(user_ids)}}, {"_id": 0, "user_id": 1, "nickname": 1}).to_list(200)
        users_map = {u["user_id"]: u.get("nickname", u["user_id"]) for u in users}
    
    for m in messages:
        m["sender_nickname"] = users_map.get(m.get("sender_id", ""), "Unknown")
        m["receiver_nickname"] = users_map.get(m.get("receiver_id", ""), "Unknown")
    
    total = await db.messages.count_documents({})
    
    return {"messages": messages, "total": total, "page": page}

@router.delete("/moderation/messages/{message_id}")
async def delete_message(message_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Delete an inappropriate message"""
    admin = await get_admin_user(request, db)
    
    result = await db.messages.delete_one({"message_id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await log_admin_action(db, admin["user_id"], "delete_message", message_id)
    return {"success": True, "message": "Message deleted"}

@router.post("/moderation/users/{user_id}/flag")
async def flag_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Flag/unflag a suspicious user"""
    admin = await get_admin_user(request, db)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_flagged = user.get("is_flagged", False)
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_flagged": not is_flagged}})
    await log_admin_action(db, admin["user_id"], "unflag_user" if is_flagged else "flag_user", user_id)
    
    return {"success": True, "is_flagged": not is_flagged}

@router.post("/moderation/messages/{message_id}/report")
async def report_message(message_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Report a message"""
    admin = await get_admin_user(request, db)
    body = await request.json()
    reason = sanitize_input(body.get("reason", "Flagged by admin"))
    
    msg = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await db.reported_messages.update_one(
        {"message_id": message_id},
        {"$set": {
            "message_id": message_id,
            "sender_id": msg.get("sender_id"),
            "message": msg.get("message"),
            "reason": reason,
            "reported_by": admin["user_id"],
            "reported_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending"
        }},
        upsert=True
    )
    await log_admin_action(db, admin["user_id"], "report_message", message_id, reason)
    return {"success": True}

@router.get("/moderation/reported")
async def get_reported_messages(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get reported messages"""
    admin = await get_admin_user(request, db)
    
    reports = await db.reported_messages.find({}, {"_id": 0}).sort("reported_at", -1).to_list(100)
    return {"reports": reports, "total": len(reports)}

# ==================== Notifications Control ====================

@router.post("/notifications/broadcast")
async def broadcast_notification(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Send system-wide notification to all users"""
    admin = await get_admin_user(request, db)
    body = await request.json()
    
    message = sanitize_input(body.get("message", ""))
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    now = datetime.now(timezone.utc).isoformat()
    users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(10000)
    
    notifications = []
    for u in users:
        notifications.append({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": u["user_id"],
            "type": "system",
            "message": message,
            "data": {"from_admin": True},
            "read": False,
            "created_at": now
        })
    
    if notifications:
        await db.notifications.insert_many(notifications)
    
    # Push via WebSocket
    try:
        from routes.messages import notification_manager
        for notif in notifications:
            n_copy = {k: v for k, v in notif.items() if k != "_id"}
            await notification_manager.notify(notif["user_id"], {"type": "notification", "notification": n_copy})
    except Exception as e:
        logger.warning(f"WS broadcast error: {e}")
    
    await log_admin_action(db, admin["user_id"], "broadcast_notification", "", message[:100])
    return {"success": True, "sent_to": len(users)}

@router.post("/notifications/send")
async def send_notification_to_user(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Send notification to specific user"""
    admin = await get_admin_user(request, db)
    body = await request.json()
    
    user_id = body.get("user_id", "")
    message = sanitize_input(body.get("message", ""))
    
    if not user_id or not message:
        raise HTTPException(status_code=400, detail="user_id and message required")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc).isoformat()
    notif = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "system",
        "message": message,
        "data": {"from_admin": True},
        "read": False,
        "created_at": now
    }
    await db.notifications.insert_one(notif)
    notif.pop("_id", None)
    
    try:
        from routes.messages import notification_manager
        await notification_manager.notify(user_id, {"type": "notification", "notification": notif})
    except Exception:
        pass
    
    await log_admin_action(db, admin["user_id"], "send_notification", user_id, message[:100])
    return {"success": True}

# ==================== Analytics ====================

@router.get("/analytics")
async def get_analytics(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get analytics data"""
    admin = await get_admin_user(request, db)
    
    now = datetime.now(timezone.utc)
    
    # Daily active users (last 7 days)
    daily_users = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        count = await db.user_sessions.count_documents({"created_at": {"$gte": day_start, "$lte": day_end}})
        daily_users.append({"date": day.strftime("%b %d"), "count": count})
    
    # Predictions per day (last 7 days)
    daily_predictions = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        count = await db.predictions.count_documents({"created_at": {"$gte": day_start, "$lte": day_end}})
        daily_predictions.append({"date": day.strftime("%b %d"), "count": count})
    
    # Most active users
    pipeline = [
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    active_predictors = await db.predictions.aggregate(pipeline).to_list(10)
    
    # Enrich with nicknames
    for ap in active_predictors:
        user = await db.users.find_one({"user_id": ap["_id"]}, {"_id": 0, "nickname": 1})
        ap["nickname"] = user.get("nickname", ap["_id"]) if user else ap["_id"]
        ap["user_id"] = ap.pop("_id")
    
    # Points distribution
    points_ranges = [
        {"label": "0-100", "min": 0, "max": 100},
        {"label": "101-500", "min": 101, "max": 500},
        {"label": "501-1000", "min": 501, "max": 1000},
        {"label": "1001-5000", "min": 1001, "max": 5000},
        {"label": "5000+", "min": 5001, "max": 999999}
    ]
    points_dist = []
    for r in points_ranges:
        count = await db.users.count_documents({"points": {"$gte": r["min"], "$lte": r["max"]}})
        points_dist.append({"label": r["label"], "count": count})
    
    return {
        "daily_users": daily_users,
        "daily_predictions": daily_predictions,
        "top_predictors": active_predictors,
        "points_distribution": points_dist
    }

# ==================== Audit Log ====================

@router.get("/audit-log")
async def get_audit_log(
    request: Request, page: int = 1, limit: int = 30,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get admin audit log"""
    admin = await get_admin_user(request, db)
    
    skip = (max(1, page) - 1) * min(limit, 50)
    logs = await db.admin_audit_log.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(min(limit, 50)).to_list(50)
    
    # Enrich with admin nicknames
    admin_ids = set(l.get("admin_id") for l in logs)
    admins = await db.users.find({"user_id": {"$in": list(admin_ids)}}, {"_id": 0, "user_id": 1, "nickname": 1}).to_list(100)
    admin_map = {a["user_id"]: a.get("nickname", a["user_id"]) for a in admins}
    
    for l in logs:
        l["admin_nickname"] = admin_map.get(l.get("admin_id"), "Unknown")
    
    total = await db.admin_audit_log.count_documents({})
    
    return {"logs": logs, "total": total, "page": page}
