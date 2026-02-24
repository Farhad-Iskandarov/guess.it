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
    search: str = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    admin = await get_admin_user(request, db)

    skip = (max(1, page) - 1) * min(limit, 50)
    
    # Get predictions
    predictions = await db.predictions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(50)

    # Fetch match data for enrichment
    # Get current matches that are cached by the system
    from services.football_api import get_matches, get_live_matches
    from datetime import datetime, timedelta, timezone
    
    matches = []
    try:
        # First try to get current matches (today + upcoming)
        matches_today = await get_matches(
            db,
            date_from=(datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d"),
            date_to=(datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d"),
            competition=None,
            status=None
        )
        matches.extend(matches_today)
        
        # Also get recent finished matches (last 7 days)
        matches_recent = await get_matches(
            db,
            date_from=(datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d"),
            date_to=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            competition=None,
            status=None
        )
        matches.extend(matches_recent)
        
        logger.info(f"Fetched {len(matches)} matches for prediction enrichment")
    except Exception as e:
        logger.error(f"Failed to fetch matches for prediction enrichment: {e}")
    
    # Create match lookup dictionary (remove duplicates)
    match_dict = {}
    for m in matches:
        if m.get('id'):
            match_dict[m['id']] = m
    
    logger.info(f"Match dictionary has {len(match_dict)} unique matches")
    
    enriched_predictions = []
    for pred in predictions:
        match_id = pred.get('match_id')
        match_data = match_dict.get(match_id)
        
        if not match_data:
            logger.warning(f"Match {match_id} not found in fetched data")
        
        # Create enriched prediction
        enriched = {
            **pred,
            "match_data": match_data if match_data else {
                "id": match_id,
                "homeTeam": {"name": "Unknown", "crest": None},
                "awayTeam": {"name": "Unknown", "crest": None},
                "utcDate": pred.get("created_at", ""),
                "competition": {"name": "Unknown"},
                "status": "UNKNOWN"
            }
        }
        
        # Apply search filter if provided
        if search:
            if match_data:
                home_name = match_data.get("homeTeam", {}).get("name", "").lower()
                away_name = match_data.get("awayTeam", {}).get("name", "").lower()
            else:
                home_name = ""
                away_name = ""
            search_lower = search.lower()
            
            if search_lower in home_name or search_lower in away_name:
                enriched_predictions.append(enriched)
        else:
            enriched_predictions.append(enriched)

    total = await db.predictions.count_documents({"user_id": user_id})

    return {"predictions": enriched_predictions, "total": total, "page": page}

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


# ==================== Gift Points ====================

@router.post("/gift-points")
async def gift_points(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Admin gifts points to one or more users with a custom message and audit trail."""
    admin = await get_admin_user(request, db)
    body = await request.json()

    user_ids = body.get("user_ids", [])
    points = body.get("points", 0)
    message = sanitize_input(body.get("message", ""))

    if not user_ids or not isinstance(user_ids, list):
        raise HTTPException(status_code=400, detail="At least one user_id is required")
    if not isinstance(points, (int, float)) or points <= 0:
        raise HTTPException(status_code=400, detail="Points must be a positive number")
    if points > 100000:
        raise HTTPException(status_code=400, detail="Maximum 100,000 points per gift")
    if len(user_ids) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 users per batch")

    points = int(points)
    now = datetime.now(timezone.utc).isoformat()
    gift_id = f"gift_{uuid.uuid4().hex[:12]}"
    default_message = f"You have received {points} bonus points as a Gift"
    notification_message = message if message else default_message

    # Verify all users exist
    existing_users = await db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "nickname": 1, "points": 1}
    ).to_list(500)
    existing_ids = {u["user_id"] for u in existing_users}
    missing = [uid for uid in user_ids if uid not in existing_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Users not found: {', '.join(missing[:5])}")

    # Award points to all users in bulk
    await db.users.update_many(
        {"user_id": {"$in": user_ids}},
        {"$inc": {"points": points}}
    )

    # Store audit trail in points_gifts collection
    gift_doc = {
        "gift_id": gift_id,
        "admin_id": admin["user_id"],
        "admin_nickname": admin.get("nickname", admin["user_id"]),
        "user_ids": user_ids,
        "user_count": len(user_ids),
        "points": points,
        "message": notification_message,
        "created_at": now,
    }
    await db.points_gifts.insert_one(gift_doc)

    # Create notifications for each user
    notifications = []
    for uid in user_ids:
        notifications.append({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": uid,
            "type": "points_gift",
            "message": notification_message,
            "data": {
                "from_admin": True,
                "gift_id": gift_id,
                "points": points,
            },
            "read": False,
            "created_at": now,
        })
    if notifications:
        await db.notifications.insert_many(notifications)

    # Send real-time WebSocket notifications
    try:
        from routes.messages import notification_manager
        for notif in notifications:
            n_copy = {k: v for k, v in notif.items() if k != "_id"}
            await notification_manager.notify(notif["user_id"], {"type": "notification", "notification": n_copy})
    except Exception as e:
        logger.warning(f"WS gift notification error: {e}")

    # Log admin action
    user_names = [u.get("nickname") or u["user_id"] for u in existing_users[:5]]
    names_str = ", ".join(user_names)
    if len(user_ids) > 5:
        names_str += f" (+{len(user_ids) - 5} more)"
    await log_admin_action(
        db, admin["user_id"], "gift_points",
        f"{len(user_ids)} users",
        f"Gifted {points} pts to {names_str}. Message: {notification_message[:100]}"
    )

    # Get updated user data
    updated_users = await db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "nickname": 1, "points": 1, "level": 1}
    ).to_list(500)

    return {
        "success": True,
        "gift_id": gift_id,
        "points": points,
        "recipients": len(user_ids),
        "message": notification_message,
        "updated_users": updated_users,
    }


@router.get("/gift-points/log")
async def get_gift_points_log(
    request: Request,
    page: int = 1,
    limit: int = 20,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get audit log of all points gifts"""
    admin = await get_admin_user(request, db)

    skip = (max(1, page) - 1) * min(limit, 50)
    gifts = await db.points_gifts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(50)
    total = await db.points_gifts.count_documents({})

    return {"gifts": gifts, "total": total, "page": page}



# ==================== Carousel Banner Management ====================

@router.get("/banners")
async def list_banners(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """List all carousel banners"""
    admin = await get_admin_user(request, db)
    
    banners = await db.carousel_banners.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return {"banners": banners, "total": len(banners)}


@router.post("/banners")
async def create_banner(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Create a new carousel banner"""
    from fastapi import File, UploadFile, Form
    admin = await get_admin_user(request, db)
    
    # Get form data
    form_data = await request.form()
    title = sanitize_input(form_data.get("title", ""))
    subtitle = sanitize_input(form_data.get("subtitle", ""))
    button_text = sanitize_input(form_data.get("button_text", ""))
    button_link = sanitize_input(form_data.get("button_link", ""))
    order = int(form_data.get("order", 0))
    is_active = form_data.get("is_active", "true").lower() == "true"
    
    # Handle file upload
    image_file = form_data.get("image")
    image_url = ""
    
    if image_file and hasattr(image_file, 'filename'):
        # Validate file type
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
        file_ext = '.' + image_file.filename.split('.')[-1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Only JPG, PNG, WebP, and GIF images allowed")
        
        # Read and validate file
        contents = await image_file.read()
        
        # Validate file size (5MB max)
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
        
        # Save file
        import os
        from pathlib import Path
        
        banner_dir = Path("/app/backend/uploads/banners")
        banner_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_id = uuid.uuid4().hex[:12]
        filename = f"banner_{file_id}{file_ext}"
        file_path = banner_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        image_url = f"/api/uploads/banners/{filename}"
    
    if not title or not image_url:
        raise HTTPException(status_code=400, detail="Title and image are required")
    
    banner_id = f"banner_{uuid.uuid4().hex[:12]}"
    doc = {
        "banner_id": banner_id,
        "title": title,
        "subtitle": subtitle,
        "button_text": button_text,
        "button_link": button_link,
        "image_url": image_url,
        "order": order,
        "is_active": is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    
    await db.carousel_banners.insert_one(doc)
    doc.pop("_id", None)
    
    await log_admin_action(db, admin["user_id"], "create_banner", banner_id, f"Created banner: {title}")
    return {"success": True, "banner": doc}


@router.put("/banners/{banner_id}")
async def update_banner(banner_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Update a carousel banner"""
    admin = await get_admin_user(request, db)
    
    banner = await db.carousel_banners.find_one({"banner_id": banner_id}, {"_id": 0})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    # Get form data
    form_data = await request.form()
    title = sanitize_input(form_data.get("title", banner["title"]))
    subtitle = sanitize_input(form_data.get("subtitle", banner.get("subtitle", "")))
    button_text = sanitize_input(form_data.get("button_text", banner.get("button_text", "")))
    button_link = sanitize_input(form_data.get("button_link", banner.get("button_link", "")))
    order = int(form_data.get("order", banner.get("order", 0)))
    is_active = form_data.get("is_active", str(banner.get("is_active", True))).lower() == "true"
    
    image_url = banner["image_url"]
    
    # Handle new image upload
    image_file = form_data.get("image")
    if image_file and hasattr(image_file, 'filename'):
        # Validate and save new image (same logic as create)
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
        file_ext = '.' + image_file.filename.split('.')[-1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Only JPG, PNG, WebP, and GIF images allowed")
        
        contents = await image_file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
        
        import os
        from pathlib import Path
        
        # Delete old image if it's a local upload
        if banner["image_url"].startswith("/api/uploads/banners/"):
            old_file_path = Path(f"/app/backend/uploads/banners/{banner['image_url'].split('/')[-1]}")
            if old_file_path.exists():
                old_file_path.unlink()
        
        # Save new image
        banner_dir = Path("/app/backend/uploads/banners")
        banner_dir.mkdir(parents=True, exist_ok=True)
        
        file_id = uuid.uuid4().hex[:12]
        filename = f"banner_{file_id}{file_ext}"
        file_path = banner_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        image_url = f"/api/uploads/banners/{filename}"
    
    update_doc = {
        "title": title,
        "subtitle": subtitle,
        "button_text": button_text,
        "button_link": button_link,
        "image_url": image_url,
        "order": order,
        "is_active": is_active,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.carousel_banners.update_one(
        {"banner_id": banner_id},
        {"$set": update_doc}
    )
    
    await log_admin_action(db, admin["user_id"], "update_banner", banner_id, f"Updated banner: {title}")
    return {"success": True, "banner": {**banner, **update_doc}}


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Delete a carousel banner"""
    admin = await get_admin_user(request, db)
    
    banner = await db.carousel_banners.find_one({"banner_id": banner_id}, {"_id": 0})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    # Delete image file if it's a local upload
    if banner["image_url"].startswith("/api/uploads/banners/"):
        from pathlib import Path
        file_path = Path(f"/app/backend/uploads/banners/{banner['image_url'].split('/')[-1]}")
        if file_path.exists():
            file_path.unlink()
    
    await db.carousel_banners.delete_one({"banner_id": banner_id})
    await log_admin_action(db, admin["user_id"], "delete_banner", banner_id, f"Deleted banner: {banner['title']}")
    return {"success": True}


@router.post("/banners/{banner_id}/toggle")
async def toggle_banner(banner_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Toggle banner active status"""
    admin = await get_admin_user(request, db)
    
    banner = await db.carousel_banners.find_one({"banner_id": banner_id}, {"_id": 0})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    new_status = not banner.get("is_active", True)
    await db.carousel_banners.update_one(
        {"banner_id": banner_id},
        {"$set": {"is_active": new_status}}
    )
    
    await log_admin_action(db, admin["user_id"], "toggle_banner", banner_id, 
                          f"{'Activated' if new_status else 'Deactivated'} banner: {banner['title']}")
    return {"success": True, "is_active": new_status}



# ==================== Subscriptions Management ====================

@router.get("/subscriptions")
async def list_subscriptions(request: Request, db: AsyncIOMotorDatabase = Depends(get_db),
                             page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    admin = await get_admin_user(request, db)
    skip = (page - 1) * limit
    subs = await db.subscriptions.find({}, {"_id": 0}).sort("subscribed_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.subscriptions.count_documents({})
    return {"subscriptions": subs, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@router.delete("/subscriptions/{sub_id}")
async def delete_subscription(sub_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    result = await db.subscriptions.delete_one({"sub_id": sub_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await log_admin_action(db, admin["user_id"], "delete_subscription", sub_id, f"Deleted subscription: {sub_id}")
    return {"success": True}

# ==================== Contact Messages Management ====================

@router.get("/contact-messages")
async def list_contact_messages(request: Request, db: AsyncIOMotorDatabase = Depends(get_db),
                                page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    admin = await get_admin_user(request, db)
    skip = (page - 1) * limit
    msgs = await db.contact_messages.find({}, {"_id": 0}).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.contact_messages.count_documents({})
    unread = await db.contact_messages.count_documents({"read": False})
    return {"messages": msgs, "total": total, "unread": unread, "page": page, "pages": (total + limit - 1) // limit}

@router.put("/contact-messages/{msg_id}/flag")
async def toggle_flag_message(msg_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    msg = await db.contact_messages.find_one({"msg_id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    new_flag = not msg.get("flagged", False)
    await db.contact_messages.update_one({"msg_id": msg_id}, {"$set": {"flagged": new_flag, "read": True}})
    return {"success": True, "flagged": new_flag}

@router.delete("/contact-messages/{msg_id}")
async def delete_contact_message(msg_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    result = await db.contact_messages.delete_one({"msg_id": msg_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    await log_admin_action(db, admin["user_id"], "delete_contact_msg", msg_id, f"Deleted contact message: {msg_id}")
    return {"success": True}

# ==================== Contact Settings Management ====================

@router.get("/contact-settings")
async def get_contact_settings_admin(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    settings = await db.contact_settings.find_one({"key": "contact_info"}, {"_id": 0})
    if not settings:
        return {"email_title": "Email Us", "email_address": "support@guessit.com",
                "location_title": "Location", "location_address": "San Francisco, CA"}
    return {"email_title": settings.get("email_title", "Email Us"),
            "email_address": settings.get("email_address", "support@guessit.com"),
            "location_title": settings.get("location_title", "Location"),
            "location_address": settings.get("location_address", "San Francisco, CA")}

@router.put("/contact-settings")
async def update_contact_settings(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    body = await request.json()
    update = {
        "key": "contact_info",
        "email_title": sanitize_input(body.get("email_title", "Email Us")),
        "email_address": sanitize_input(body.get("email_address", "support@guessit.com")),
        "location_title": sanitize_input(body.get("location_title", "Location")),
        "location_address": sanitize_input(body.get("location_address", "San Francisco, CA")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin["user_id"]
    }
    await db.contact_settings.update_one({"key": "contact_info"}, {"$set": update}, upsert=True)
    await log_admin_action(db, admin["user_id"], "update_contact_settings", "contact_info", "Updated contact settings")
    return {"success": True}

# ==================== News Management ====================

from pathlib import Path
NEWS_IMG_DIR = Path("/app/backend/uploads/news")
NEWS_IMG_DIR.mkdir(parents=True, exist_ok=True)

@router.get("/news")
async def list_news_admin(request: Request, db: AsyncIOMotorDatabase = Depends(get_db),
                          page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    admin = await get_admin_user(request, db)
    skip = (page - 1) * limit
    articles = await db.news_articles.find({}, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.news_articles.count_documents({})
    return {"articles": articles, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@router.post("/news/upload-image")
async def upload_news_image(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Upload an inline image for news content blocks"""
    admin = await get_admin_user(request, db)
    form_data = await request.form()
    image_file = form_data.get("image")
    if not image_file or not hasattr(image_file, 'filename') or not image_file.filename:
        raise HTTPException(status_code=400, detail="Image file is required")
    file_id = uuid.uuid4().hex[:12]
    ext = Path(image_file.filename).suffix.lower() or ".jpg"
    filename = f"news_{file_id}{ext}"
    file_path = NEWS_IMG_DIR / filename
    file_content = await image_file.read()
    with open(file_path, "wb") as f:
        f.write(file_content)
    image_url = f"/api/uploads/news/{filename}"
    return {"success": True, "url": image_url}

@router.post("/news")
async def create_news(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    form_data = await request.form()
    
    title = sanitize_input(form_data.get("title", ""))
    content = form_data.get("content", "").strip()[:10000]
    content_blocks_str = form_data.get("content_blocks", "")
    date_str = form_data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    category = sanitize_input(form_data.get("category", "News"))
    published = form_data.get("published", "true").lower() == "true"
    
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    
    # Parse content blocks
    import json as json_lib
    content_blocks = []
    if content_blocks_str:
        try:
            content_blocks = json_lib.loads(content_blocks_str)
        except:
            content_blocks = []
    
    # Build excerpt from text blocks
    excerpt_parts = []
    for block in content_blocks:
        if block.get("type") == "text" and block.get("value"):
            excerpt_parts.append(block["value"])
    excerpt_text = " ".join(excerpt_parts) if excerpt_parts else content
    excerpt = excerpt_text[:200] + ("..." if len(excerpt_text) > 200 else "")
    
    image_url = ""
    image_file = form_data.get("image")
    if image_file and hasattr(image_file, 'filename') and image_file.filename:
        file_id = uuid.uuid4().hex[:12]
        ext = Path(image_file.filename).suffix.lower() or ".jpg"
        filename = f"news_{file_id}{ext}"
        file_path = NEWS_IMG_DIR / filename
        file_content = await image_file.read()
        with open(file_path, "wb") as f:
            f.write(file_content)
        image_url = f"/api/uploads/news/{filename}"
    
    # If no cover image but blocks have an image, use the first one
    if not image_url:
        for block in content_blocks:
            if block.get("type") == "image" and block.get("url"):
                image_url = block["url"]
                break
    
    article_id = f"news_{uuid.uuid4().hex[:12]}"
    doc = {
        "article_id": article_id,
        "title": title,
        "content": content,
        "content_blocks": content_blocks,
        "excerpt": excerpt,
        "date": date_str,
        "category": category,
        "image_url": image_url,
        "published": published,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["user_id"]
    }
    await db.news_articles.insert_one(doc)
    doc.pop("_id", None)
    await log_admin_action(db, admin["user_id"], "create_news", article_id, f"Created news: {title}")
    return {"success": True, "article": doc}

@router.put("/news/{article_id}")
async def update_news(article_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    article = await db.news_articles.find_one({"article_id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    form_data = await request.form()
    title = sanitize_input(form_data.get("title", article["title"]))
    content = form_data.get("content", article.get("content", "")).strip()[:10000]
    content_blocks_str = form_data.get("content_blocks", "")
    date_str = form_data.get("date", article.get("date", ""))
    category = sanitize_input(form_data.get("category", article.get("category", "News")))
    published = form_data.get("published", str(article.get("published", True))).lower() == "true"
    
    import json as json_lib
    content_blocks = article.get("content_blocks", [])
    if content_blocks_str:
        try:
            content_blocks = json_lib.loads(content_blocks_str)
        except:
            pass
    
    excerpt_parts = []
    for block in content_blocks:
        if block.get("type") == "text" and block.get("value"):
            excerpt_parts.append(block["value"])
    excerpt_text = " ".join(excerpt_parts) if excerpt_parts else content
    excerpt = excerpt_text[:200] + ("..." if len(excerpt_text) > 200 else "")
    
    image_url = article.get("image_url", "")
    image_file = form_data.get("image")
    if image_file and hasattr(image_file, 'filename') and image_file.filename:
        if image_url.startswith("/api/uploads/news/"):
            old_path = NEWS_IMG_DIR / image_url.split("/")[-1]
            if old_path.exists():
                old_path.unlink()
        file_id = uuid.uuid4().hex[:12]
        ext = Path(image_file.filename).suffix.lower() or ".jpg"
        filename = f"news_{file_id}{ext}"
        file_path = NEWS_IMG_DIR / filename
        file_content = await image_file.read()
        with open(file_path, "wb") as f:
            f.write(file_content)
        image_url = f"/api/uploads/news/{filename}"
    
    if not image_url:
        for block in content_blocks:
            if block.get("type") == "image" and block.get("url"):
                image_url = block["url"]
                break
    
    update_data = {
        "title": title,
        "content": content,
        "content_blocks": content_blocks,
        "excerpt": excerpt,
        "date": date_str,
        "category": category,
        "image_url": image_url,
        "published": published,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.news_articles.update_one({"article_id": article_id}, {"$set": update_data})
    await log_admin_action(db, admin["user_id"], "update_news", article_id, f"Updated news: {title}")
    return {"success": True}

@router.delete("/news/{article_id}")
async def delete_news(article_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    article = await db.news_articles.find_one({"article_id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Delete image
    img = article.get("image_url", "")
    if img.startswith("/api/uploads/news/"):
        path = NEWS_IMG_DIR / img.split("/")[-1]
        if path.exists():
            path.unlink()
    
    await db.news_articles.delete_one({"article_id": article_id})
    await log_admin_action(db, admin["user_id"], "delete_news", article_id, f"Deleted news: {article['title']}")
    return {"success": True}

@router.put("/news/{article_id}/toggle")
async def toggle_news_publish(article_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await get_admin_user(request, db)
    article = await db.news_articles.find_one({"article_id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    new_status = not article.get("published", True)
    await db.news_articles.update_one({"article_id": article_id}, {"$set": {"published": new_status}})
    await log_admin_action(db, admin["user_id"], "toggle_news", article_id, 
                          f"{'Published' if new_status else 'Unpublished'} news: {article['title']}")
    return {"success": True, "published": new_status}


# ==================== Points Configuration Management ====================

from models.points_config import DEFAULT_POINTS_CONFIG

@router.get("/points-config")
async def get_points_config(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get current points configuration"""
    admin = await get_admin_user(request, db)
    
    config = await db.points_config.find_one({"config_id": "default_points"}, {"_id": 0})
    
    if not config:
        # Return default config
        return DEFAULT_POINTS_CONFIG
    
    return config


@router.put("/points-config")
async def update_points_config(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Update points configuration"""
    admin = await get_admin_user(request, db)
    
    body = await request.json()
    
    # Validate level thresholds
    level_thresholds = body.get("level_thresholds", DEFAULT_POINTS_CONFIG["level_thresholds"])
    if not isinstance(level_thresholds, list) or len(level_thresholds) != 11:
        raise HTTPException(status_code=400, detail="level_thresholds must be a list of exactly 11 integers")
    
    # Ensure thresholds are monotonically increasing
    for i in range(1, len(level_thresholds)):
        if level_thresholds[i] < level_thresholds[i-1]:
            raise HTTPException(status_code=400, detail="level_thresholds must be monotonically increasing")
    
    update_data = {
        "config_id": "default_points",
        "correct_prediction": max(0, min(1000, int(body.get("correct_prediction", 10)))),
        "wrong_penalty": max(0, min(100, int(body.get("wrong_penalty", 5)))),
        "penalty_min_level": max(0, min(10, int(body.get("penalty_min_level", 5)))),
        "exact_score_bonus": max(0, min(500, int(body.get("exact_score_bonus", 50)))),
        "level_thresholds": [int(t) for t in level_thresholds],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin["user_id"]
    }
    
    await db.points_config.update_one(
        {"config_id": "default_points"},
        {"$set": update_data},
        upsert=True
    )
    
    await log_admin_action(
        db, admin["user_id"], "update_points_config", "points", 
        f"Updated: correct={update_data['correct_prediction']}, wrong={update_data['wrong_penalty']}, exact_bonus={update_data['exact_score_bonus']}"
    )
    
    return {"success": True, "config": update_data}


@router.post("/points-config/reset")
async def reset_points_config(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Reset points configuration to defaults"""
    admin = await get_admin_user(request, db)
    
    default_config = {
        **DEFAULT_POINTS_CONFIG,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin["user_id"]
    }
    
    await db.points_config.update_one(
        {"config_id": "default_points"},
        {"$set": default_config},
        upsert=True
    )
    
    await log_admin_action(db, admin["user_id"], "reset_points_config", "points", "Reset to defaults")
    
    return {"success": True, "config": default_config}


# ==================== SUBSCRIPTION PLANS MANAGEMENT ====================

@router.get("/subscription-plans")
async def list_subscription_plans(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get all subscription plans (including inactive)"""
    admin = await get_admin_user(request, db)
    plans = await db.subscription_plans.find({}, {"_id": 0}).sort("order", 1).to_list(20)
    return {"plans": plans}


@router.put("/subscription-plans/{plan_id}")
async def update_subscription_plan(plan_id: str, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Update a subscription plan"""
    admin = await get_admin_user(request, db)
    body = await request.json()
    
    now = datetime.now(timezone.utc).isoformat()
    update_fields = {"updated_at": now}
    
    allowed = ["name", "price", "features", "badge_name", "badge_color", "order", "is_active"]
    for key in allowed:
        if key in body:
            update_fields[key] = body[key]
    
    result = await db.subscription_plans.update_one(
        {"plan_id": plan_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    await log_admin_action(db, admin["user_id"], "update_subscription_plan", plan_id, f"Updated plan: {plan_id}")
    
    return {"success": True}


@router.get("/subscription-stats")
async def get_subscription_stats(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get subscription statistics for dashboard"""
    admin = await get_admin_user(request, db)
    
    total_subs = await db.user_subscriptions.count_documents({"status": "active"})
    
    # Count per plan
    plans = await db.subscription_plans.find({}, {"_id": 0}).sort("order", 1).to_list(10)
    plan_stats = []
    for plan in plans:
        count = await db.user_subscriptions.count_documents({"plan_id": plan["plan_id"], "status": "active"})
        plan_stats.append({
            "plan_id": plan["plan_id"],
            "name": plan["name"],
            "price": plan["price"],
            "subscriber_count": count,
            "is_active": plan.get("is_active", True)
        })
    
    # Total revenue from paid transactions
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.payment_transactions.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Recent subscriptions
    recent = await db.user_subscriptions.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("activated_at", -1).limit(10).to_list(10)
    
    for sub in recent:
        user = await db.users.find_one({"user_id": sub["user_id"]}, {"_id": 0, "nickname": 1, "email": 1, "picture": 1})
        if user:
            sub["user_nickname"] = user.get("nickname")
            sub["user_email"] = user.get("email")
            sub["user_picture"] = user.get("picture")
    
    return {
        "total_subscribers": total_subs,
        "plan_stats": plan_stats,
        "total_revenue": round(total_revenue, 2),
        "recent_subscriptions": recent
    }


@router.get("/user-subscriptions")
async def list_user_subscriptions(request: Request, db: AsyncIOMotorDatabase = Depends(get_db),
                                   page: int = 1, limit: int = 20):
    """List all user subscriptions"""
    admin = await get_admin_user(request, db)
    skip = (page - 1) * limit
    
    total = await db.user_subscriptions.count_documents({})
    subs = await db.user_subscriptions.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for sub in subs:
        user = await db.users.find_one({"user_id": sub["user_id"]}, {"_id": 0, "nickname": 1, "email": 1, "picture": 1})
        if user:
            sub["user_nickname"] = user.get("nickname")
            sub["user_email"] = user.get("email")
    
    return {"subscriptions": subs, "total": total}

