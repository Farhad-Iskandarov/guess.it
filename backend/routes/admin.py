"""
Admin Routes - Secure admin panel with RBAC, audit logging, rate limiting
Includes: User Management, Match Management, System/API Config, Prediction Monitoring,
Favorite Users, Notifications, Analytics, Audit Logs
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from typing import Optional
from passlib.context import CryptContext
import uuid
import logging
import html
import re
import time
from collections import defaultdict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    if not text:
        return ""
    text = html.escape(str(text).strip())
    text = re.sub(r'<[^>]*>', '', text)
    return text[:2000]

async def get_admin_user(request: Request, db: AsyncIOMotorDatabase) -> dict:
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

    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Account suspended")

    if not rate_limiter.check(user["user_id"]):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

    return user

async def log_admin_action(db: AsyncIOMotorDatabase, admin_id: str, action: str, target: str = "", details: str = ""):
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
    admin = await get_admin_user(request, db)

    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_online": True})
    banned_users = await db.users.count_documents({"is_banned": True})
    total_predictions = await db.predictions.count_documents({})
    total_messages = await db.messages.count_documents({})
    total_friendships = await db.friendships.count_documents({})
    total_notifications = await db.notifications.count_documents({})

    total_matches = await db.football_matches_cache.count_documents({})
    if total_matches == 0:
        total_matches = 120

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    new_users_24h = await db.users.count_documents({"created_at": {"$gte": yesterday}})

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
    sort_by: str = "points",
    sort_order: str = "desc",
    filter_role: str = "",
    filter_status: str = "",
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get paginated user list with search, filters, sorted by points by default"""
    admin = await get_admin_user(request, db)

    query = {}
    if search:
        safe_search = re.escape(search.strip()[:100])
        query["$or"] = [
            {"nickname": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"user_id": {"$regex": safe_search, "$options": "i"}}
        ]
    if filter_role == "admin":
        query["role"] = "admin"

    # Advanced status filters
    if filter_status == "online":
        query["is_online"] = True
    elif filter_status == "offline":
        query["is_online"] = {"$ne": True}
        query["is_banned"] = {"$ne": True}
    elif filter_status == "banned":
        query["is_banned"] = True

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
    """Get comprehensive user info - admin has full visibility"""
    admin = await get_admin_user(request, db)

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Full stats
    predictions_count = await db.predictions.count_documents({"user_id": user_id})
    correct_predictions = await db.predictions.count_documents({"user_id": user_id, "points_awarded": True, "points_value": {"$gt": 0}})
    wrong_predictions = await db.predictions.count_documents({"user_id": user_id, "points_awarded": True, "points_value": {"$lte": 0}})
    messages_sent = await db.messages.count_documents({"sender_id": user_id})
    messages_received = await db.messages.count_documents({"receiver_id": user_id})
    friends_count = await db.friendships.count_documents({"$or": [{"user_a": user_id}, {"user_b": user_id}]})
    notifications_count = await db.notifications.count_documents({"user_id": user_id})
    pending_requests_in = await db.friend_requests.count_documents({"receiver_id": user_id, "status": "pending"})
    pending_requests_out = await db.friend_requests.count_documents({"sender_id": user_id, "status": "pending"})

    # Friends list
    friendships = await db.friendships.find(
        {"$or": [{"user_a": user_id}, {"user_b": user_id}]}, {"_id": 0}
    ).to_list(100)
    friend_ids = []
    for f in friendships:
        friend_ids.append(f["user_b"] if f["user_a"] == user_id else f["user_a"])
    friends = []
    if friend_ids:
        friends_data = await db.users.find(
            {"user_id": {"$in": friend_ids}},
            {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1, "points": 1, "level": 1, "is_online": 1}
        ).to_list(100)
        friends = friends_data

    # Recent notifications
    recent_notifs = await db.notifications.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)

    # Session info
    active_sessions = await db.user_sessions.count_documents({"user_id": user_id})

    user["predictions_count"] = predictions_count
    user["correct_predictions"] = correct_predictions
    user["wrong_predictions"] = wrong_predictions
    user["messages_sent"] = messages_sent
    user["messages_received"] = messages_received
    user["friends_count"] = friends_count
    user["friends"] = friends
    user["notifications_count"] = notifications_count
    user["recent_notifications"] = recent_notifs
    user["pending_requests_in"] = pending_requests_in
    user["pending_requests_out"] = pending_requests_out
    user["active_sessions"] = active_sessions

    return user

@router.get("/users/{user_id}/predictions")
async def get_user_predictions(
    user_id: str, request: Request, page: int = 1, limit: int = 20,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    admin = await get_admin_user(request, db)

    skip = (max(1, page) - 1) * min(limit, 50)
    predictions = await db.predictions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(50)

    total = await db.predictions.count_documents({"user_id": user_id})

    return {"predictions": predictions, "total": total, "page": page}

# ==================== User Messages Review (Replaces Moderation) ====================

@router.get("/users/{user_id}/conversations")
async def get_user_conversations(
    user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Admin: view all conversations of a user (read-only)"""
    admin = await get_admin_user(request, db)

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "nickname": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find all unique conversation partners
    pipeline = [
        {"$match": {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]}},
        {"$project": {
            "partner_id": {
                "$cond": [{"$eq": ["$sender_id", user_id]}, "$receiver_id", "$sender_id"]
            },
            "created_at": 1,
            "message": 1,
            "message_type": 1,
            "_id": 0
        }},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$partner_id",
            "last_message": {"$first": "$message"},
            "last_message_type": {"$first": "$message_type"},
            "last_message_at": {"$first": "$created_at"},
            "message_count": {"$sum": 1}
        }},
        {"$sort": {"last_message_at": -1}}
    ]
    conversations_raw = await db.messages.aggregate(pipeline).to_list(100)

    # Enrich with partner info
    conversations = []
    for conv in conversations_raw:
        partner = await db.users.find_one(
            {"user_id": conv["_id"]},
            {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1, "is_online": 1}
        )
        conversations.append({
            "partner_id": conv["_id"],
            "partner_nickname": partner.get("nickname", "Unknown") if partner else "Deleted User",
            "partner_picture": partner.get("picture") if partner else None,
            "partner_online": partner.get("is_online", False) if partner else False,
            "last_message": (conv["last_message"] or "")[:80],
            "last_message_type": conv.get("last_message_type", "text"),
            "last_message_at": conv["last_message_at"],
            "message_count": conv["message_count"]
        })

    await log_admin_action(db, admin["user_id"], "view_user_conversations", user_id)

    return {
        "user_id": user_id,
        "user_nickname": user.get("nickname", user_id),
        "conversations": conversations,
        "total": len(conversations)
    }

@router.get("/users/{user_id}/messages/{other_user_id}")
async def get_user_conversation_history(
    user_id: str, other_user_id: str, request: Request,
    page: int = 1, limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Admin: view full chat between two users (read-only)"""
    admin = await get_admin_user(request, db)

    skip = (max(1, page) - 1) * min(limit, 100)
    messages = await db.messages.find(
        {"$or": [
            {"sender_id": user_id, "receiver_id": other_user_id},
            {"sender_id": other_user_id, "receiver_id": user_id}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 100)).to_list(100)

    messages.reverse()

    # Get user info
    user_info = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1})
    other_info = await db.users.find_one({"user_id": other_user_id}, {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1})

    total = await db.messages.count_documents({"$or": [
        {"sender_id": user_id, "receiver_id": other_user_id},
        {"sender_id": other_user_id, "receiver_id": user_id}
    ]})

    await log_admin_action(db, admin["user_id"], "view_conversation", f"{user_id} <-> {other_user_id}")

    return {
        "messages": messages,
        "total": total,
        "page": page,
        "user": user_info,
        "other_user": other_info
    }

# ==================== Admin Change User Password ====================

@router.post("/users/{user_id}/change-password")
async def admin_change_password(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Admin changes a user's password without needing old password"""
    admin = await get_admin_user(request, db)

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    body = await request.json()
    new_password = body.get("new_password", "").strip()

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    hashed = pwd_context.hash(new_password)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": hashed, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Kill all sessions for the user (force re-login)
    await db.user_sessions.delete_many({"user_id": user_id})

    await log_admin_action(db, admin["user_id"], "change_user_password", user_id,
                           f"Changed password for {user.get('nickname', user_id)}. All sessions invalidated.")

    return {"success": True, "message": "Password changed. User's sessions have been invalidated."}

# ==================== User Actions (keep existing) ====================

@router.post("/users/{user_id}/promote")
async def promote_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="User is already admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin"}})
    await log_admin_action(db, admin["user_id"], "promote_admin", user_id, f"Promoted {user.get('nickname', user_id)} to admin")
    return {"success": True, "message": "User promoted to admin"}

@router.post("/users/{user_id}/demote")
async def demote_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
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
    admin = await get_admin_user(request, db)
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot ban another admin. Demote first.")
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_banned": True, "banned_at": datetime.now(timezone.utc).isoformat()}})
    await db.user_sessions.delete_many({"user_id": user_id})
    await log_admin_action(db, admin["user_id"], "ban_user", user_id, f"Banned {user.get('nickname', user_id)}")
    return {"success": True, "message": "User banned"}

@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"user_id": user_id}, {"$unset": {"is_banned": "", "banned_at": ""}})
    await log_admin_action(db, admin["user_id"], "unban_user", user_id, f"Unbanned {user.get('nickname', user_id)}")
    return {"success": True, "message": "User unbanned"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete another admin. Demote first.")
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.predictions.delete_many({"user_id": user_id})
    await db.messages.delete_many({"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]})
    await db.friendships.delete_many({"$or": [{"user_id": user_id}, {"friend_id": user_id}]})
    await db.friend_requests.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.notifications.delete_many({"user_id": user_id})
    await db.favorites.delete_many({"user_id": user_id})
    await db.admin_favorite_users.delete_many({"user_id": user_id})
    await log_admin_action(db, admin["user_id"], "delete_user", user_id, f"Deleted user {user.get('nickname', user_id)} ({user.get('email', '')})")
    return {"success": True, "message": "User permanently deleted"}

@router.post("/users/{user_id}/reset-points")
async def reset_user_points(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"user_id": user_id}, {"$set": {"points": 0, "level": 0}})
    await log_admin_action(db, admin["user_id"], "reset_points", user_id, f"Reset points for {user.get('nickname', user_id)}")
    return {"success": True, "message": "User points reset to 0"}

# ==================== Match Management ====================

@router.get("/matches")
async def get_matches(
    request: Request, search: str = "", page: int = 1, limit: int = 20,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    admin = await get_admin_user(request, db)
    from routes.football import get_cached_matches, force_fetch_matches
    all_matches = get_cached_matches()
    if not all_matches:
        await force_fetch_matches(db)
        all_matches = get_cached_matches()
    if search:
        safe = search.lower()
        all_matches = [m for m in all_matches if
            safe in (m.get("homeTeam", {}).get("name", "")).lower() or
            safe in (m.get("awayTeam", {}).get("name", "")).lower() or
            safe in (m.get("competition", "")).lower()
        ]
    pinned_docs = await db.pinned_matches.find({}, {"_id": 0, "match_id": 1}).to_list(100)
    pinned_ids = {d["match_id"] for d in pinned_docs}
    for m in all_matches:
        m["is_pinned"] = m.get("id") in pinned_ids
    all_matches.sort(key=lambda m: (not m.get("is_pinned", False), m.get("utcDate", "")))
    total = len(all_matches)
    start = (max(1, page) - 1) * limit
    matches = all_matches[start:start + limit]
    return {"matches": matches, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@router.post("/matches/refresh")
async def force_refresh_matches(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    from routes.football import force_fetch_matches
    count = await force_fetch_matches(db)
    await log_admin_action(db, admin["user_id"], "refresh_matches", "", f"Force refreshed matches. Got {count} matches.")
    return {"success": True, "message": f"Refreshed {count} matches"}

@router.post("/matches/{match_id}/pin")
async def pin_match(match_id: int, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
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
    admin = await get_admin_user(request, db)
    await db.hidden_matches.insert_one({"match_id": match_id, "hidden_at": datetime.now(timezone.utc).isoformat()})
    await log_admin_action(db, admin["user_id"], "hide_match", str(match_id))
    return {"success": True, "message": "Match hidden"}

# ==================== System: API Management ====================

@router.get("/system/apis")
async def list_apis(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """List all configured football APIs"""
    admin = await get_admin_user(request, db)

    apis = await db.admin_api_configs.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)

    # If no APIs configured yet, show current env-based config
    if not apis:
        import os
        current_key = os.environ.get("FOOTBALL_API_KEY", "")
        apis = [{
            "api_id": "default_api",
            "name": "Football-Data.org (Default)",
            "base_url": "https://api.football-data.org/v4",
            "api_key": current_key[:8] + "..." if len(current_key) > 8 else current_key,
            "api_key_masked": True,
            "enabled": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_default": True
        }]

    return {"apis": apis, "total": len(apis)}

@router.post("/system/apis")
async def add_api(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Add a new football data API"""
    admin = await get_admin_user(request, db)
    body = await request.json()

    name = sanitize_input(body.get("name", ""))
    base_url = sanitize_input(body.get("base_url", ""))
    api_key = body.get("api_key", "").strip()

    if not name or not base_url:
        raise HTTPException(status_code=400, detail="Name and base URL are required")

    api_id = f"api_{uuid.uuid4().hex[:12]}"
    doc = {
        "api_id": api_id,
        "name": name,
        "base_url": base_url,
        "api_key": api_key,
        "enabled": True,
        "is_active": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    await db.admin_api_configs.insert_one(doc)
    doc.pop("_id", None)

    # Mask key in response
    if api_key:
        doc["api_key"] = api_key[:8] + "..." if len(api_key) > 8 else api_key
    doc["api_key_masked"] = True

    await log_admin_action(db, admin["user_id"], "add_api", api_id, f"Added API: {name}")
    return {"success": True, "api": doc}

@router.post("/system/apis/{api_id}/toggle")
async def toggle_api(api_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Enable/disable an API"""
    admin = await get_admin_user(request, db)

    api_config = await db.admin_api_configs.find_one({"api_id": api_id}, {"_id": 0})
    if not api_config:
        raise HTTPException(status_code=404, detail="API not found")

    new_state = not api_config.get("enabled", True)
    await db.admin_api_configs.update_one(
        {"api_id": api_id},
        {"$set": {"enabled": new_state}}
    )

    # If disabling the active API, deactivate it
    if not new_state and api_config.get("is_active"):
        await db.admin_api_configs.update_one(
            {"api_id": api_id},
            {"$set": {"is_active": False}}
        )

    await log_admin_action(db, admin["user_id"], "toggle_api", api_id, f"{'Enabled' if new_state else 'Disabled'} API: {api_config['name']}")
    return {"success": True, "enabled": new_state}

@router.post("/system/apis/{api_id}/activate")
async def activate_api(api_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Set an API as the active one (used for fetching matches)"""
    admin = await get_admin_user(request, db)

    api_config = await db.admin_api_configs.find_one({"api_id": api_id}, {"_id": 0})
    if not api_config:
        raise HTTPException(status_code=404, detail="API not found")

    if not api_config.get("enabled"):
        raise HTTPException(status_code=400, detail="Cannot activate a disabled API. Enable it first.")

    # Deactivate all others
    await db.admin_api_configs.update_many({}, {"$set": {"is_active": False}})
    # Activate this one
    await db.admin_api_configs.update_one({"api_id": api_id}, {"$set": {"is_active": True}})

    # Update environment variable for the football API service
    import os
    if api_config.get("api_key"):
        os.environ["FOOTBALL_API_KEY"] = api_config["api_key"]

    await log_admin_action(db, admin["user_id"], "activate_api", api_id, f"Activated API: {api_config['name']}")
    return {"success": True, "message": f"API '{api_config['name']}' is now active"}

@router.delete("/system/apis/{api_id}")
async def delete_api(api_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Remove an API config"""
    admin = await get_admin_user(request, db)

    api_config = await db.admin_api_configs.find_one({"api_id": api_id}, {"_id": 0})
    if not api_config:
        raise HTTPException(status_code=404, detail="API not found")

    if api_config.get("is_active"):
        raise HTTPException(status_code=400, detail="Cannot delete the active API. Switch to another API first.")

    await db.admin_api_configs.delete_one({"api_id": api_id})
    await log_admin_action(db, admin["user_id"], "delete_api", api_id, f"Deleted API: {api_config['name']}")
    return {"success": True}

# ==================== Prediction Monitoring ====================

@router.get("/prediction-streaks")
async def get_prediction_streaks(
    request: Request,
    min_streak: int = 10,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Find users with consecutive correct predictions (10+ by default)"""
    admin = await get_admin_user(request, db)

    # Get users who have at least min_streak awarded predictions
    pipeline = [
        {"$match": {"points_awarded": True}},
        {"$group": {"_id": "$user_id", "total": {"$sum": 1}}},
        {"$match": {"total": {"$gte": min_streak}}},
        {"$sort": {"total": -1}}
    ]
    candidates = await db.predictions.aggregate(pipeline).to_list(200)

    streaks = []
    for candidate in candidates:
        uid = candidate["_id"]
        # Get all awarded predictions for this user, sorted by date
        preds = await db.predictions.find(
            {"user_id": uid, "points_awarded": True},
            {"_id": 0, "prediction_id": 1, "match_id": 1, "prediction": 1, "points_value": 1, "points_awarded_at": 1, "created_at": 1}
        ).sort("points_awarded_at", -1).to_list(500)

        # Calculate current streak from most recent
        current_streak = 0
        for p in preds:
            if p.get("points_value", 0) > 0:
                current_streak += 1
            else:
                break

        # Calculate best streak
        best_streak = 0
        temp_streak = 0
        for p in reversed(preds):
            if p.get("points_value", 0) > 0:
                temp_streak += 1
                best_streak = max(best_streak, temp_streak)
            else:
                temp_streak = 0

        if current_streak >= min_streak or best_streak >= min_streak:
            user = await db.users.find_one(
                {"user_id": uid},
                {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1, "points": 1, "level": 1}
            )
            if user:
                # Get this user's upcoming predictions (not yet awarded)
                upcoming_preds = await db.predictions.find(
                    {"user_id": uid, "points_awarded": {"$ne": True}},
                    {"_id": 0, "match_id": 1, "prediction": 1, "created_at": 1}
                ).sort("created_at", -1).limit(10).to_list(10)

                # Enrich upcoming predictions with match data
                enriched_upcoming = []
                for up in upcoming_preds:
                    match = None
                    try:
                        from routes.football import get_cached_matches
                        cached = get_cached_matches()
                        for m in cached:
                            if m.get("id") == up["match_id"]:
                                match = {
                                    "homeTeam": m.get("homeTeam", {}).get("name", ""),
                                    "awayTeam": m.get("awayTeam", {}).get("name", ""),
                                    "competition": m.get("competition", ""),
                                    "dateTime": m.get("dateTime", ""),
                                    "status": m.get("status", "")
                                }
                                break
                    except Exception:
                        pass
                    enriched_upcoming.append({
                        "match_id": up["match_id"],
                        "prediction": up["prediction"],
                        "match": match
                    })

                streaks.append({
                    "user": user,
                    "current_streak": current_streak,
                    "best_streak": best_streak,
                    "total_predictions": candidate["total"],
                    "upcoming_predictions": enriched_upcoming
                })

    streaks.sort(key=lambda x: x["current_streak"], reverse=True)

    return {"streaks": streaks, "total": len(streaks), "min_streak": min_streak}

# ==================== Favorite Users ====================

@router.get("/favorite-users")
async def get_favorite_users(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get admin's favorite users list"""
    admin = await get_admin_user(request, db)

    favorites = await db.admin_favorite_users.find(
        {"admin_id": admin["user_id"]}, {"_id": 0}
    ).sort("added_at", -1).to_list(100)

    # Enrich with user data
    result = []
    for fav in favorites:
        user = await db.users.find_one(
            {"user_id": fav["user_id"]},
            {"_id": 0, "user_id": 1, "nickname": 1, "email": 1, "picture": 1,
             "points": 1, "level": 1, "is_online": 1, "is_banned": 1, "last_seen": 1}
        )
        if user:
            user["added_at"] = fav.get("added_at")
            user["note"] = fav.get("note", "")
            result.append(user)

    return {"favorites": result, "total": len(result)}

@router.post("/favorite-users/{user_id}")
async def add_favorite_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Add a user to admin's favorites"""
    admin = await get_admin_user(request, db)

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "nickname": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.admin_favorite_users.find_one(
        {"admin_id": admin["user_id"], "user_id": user_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already in favorites")

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    note = sanitize_input(body.get("note", ""))

    doc = {
        "fav_id": f"fav_{uuid.uuid4().hex[:12]}",
        "admin_id": admin["user_id"],
        "user_id": user_id,
        "note": note,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_favorite_users.insert_one(doc)

    await log_admin_action(db, admin["user_id"], "add_favorite_user", user_id, f"Added {user.get('nickname', user_id)} to favorites")
    return {"success": True, "message": f"Added {user.get('nickname', user_id)} to favorites"}

@router.delete("/favorite-users/{user_id}")
async def remove_favorite_user(user_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Remove a user from admin's favorites"""
    admin = await get_admin_user(request, db)

    result = await db.admin_favorite_users.delete_one(
        {"admin_id": admin["user_id"], "user_id": user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not in favorites")

    await log_admin_action(db, admin["user_id"], "remove_favorite_user", user_id)
    return {"success": True}

# ==================== Notifications Control ====================

@router.post("/notifications/broadcast")
async def broadcast_notification(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
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
    admin = await get_admin_user(request, db)
    now = datetime.now(timezone.utc)

    daily_users = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        count = await db.user_sessions.count_documents({"created_at": {"$gte": day_start, "$lte": day_end}})
        daily_users.append({"date": day.strftime("%b %d"), "count": count})

    daily_predictions = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        count = await db.predictions.count_documents({"created_at": {"$gte": day_start, "$lte": day_end}})
        daily_predictions.append({"date": day.strftime("%b %d"), "count": count})

    pipeline = [
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    active_predictors = await db.predictions.aggregate(pipeline).to_list(10)

    for ap in active_predictors:
        user = await db.users.find_one({"user_id": ap["_id"]}, {"_id": 0, "nickname": 1})
        ap["nickname"] = user.get("nickname", ap["_id"]) if user else ap["_id"]
        ap["user_id"] = ap.pop("_id")

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
    action_filter: str = "",
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    admin = await get_admin_user(request, db)

    query = {}
    if action_filter:
        query["action"] = {"$regex": action_filter, "$options": "i"}

    skip = (max(1, page) - 1) * min(limit, 50)
    logs = await db.admin_audit_log.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(min(limit, 50)).to_list(50)

    admin_ids = set(log.get("admin_id") for log in logs)
    admins = await db.users.find({"user_id": {"$in": list(admin_ids)}}, {"_id": 0, "user_id": 1, "nickname": 1}).to_list(100)
    admin_map = {a["user_id"]: a.get("nickname", a["user_id"]) for a in admins}

    for log in logs:
        log["admin_nickname"] = admin_map.get(log.get("admin_id"), "Unknown")

    total = await db.admin_audit_log.count_documents(query)

    return {"logs": logs, "total": total, "page": page}
