from fastapi import FastAPI, APIRouter, Request
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
from fastapi import WebSocket, WebSocketDisconnect
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

# Import auth routes
from routes.auth import router as auth_router
from routes.predictions import router as predictions_router
from routes.football import router as football_router, manager as ws_manager, start_polling, stop_polling
from routes.favorites import router as favorites_router
from routes.settings import router as settings_router
from routes.friends import router as friends_router, friend_manager
from routes.messages import router as messages_router, chat_manager, notification_manager
from routes.notifications import router as notifications_router
from routes.admin import router as admin_router
from routes.public import router as public_router
from routes.subscriptions import router as subscriptions_router, seed_subscription_plans

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="GuessIt API", version="1.0.0")

# Store db in app state for dependency injection
app.state.db = db

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "GuessIt API is running"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get("/profile/bundle")
async def get_profile_bundle(request: Request):
    """Combined profile endpoint — returns predictions, favorites, friends leaderboard in one call.
    Runs all queries in parallel for speed."""
    from routes.auth import get_current_user
    from routes.auth import validate_session

    user_obj = await get_current_user(request, db)
    user_id = user_obj.user_id

    # Get full user doc for points/level
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    async def fetch_predictions():
        from services.football_api import get_matches
        preds = await db.predictions.find({"user_id": user_id}, {"_id": 0}).to_list(500)
        # Summary
        correct = sum(1 for p in preds if p.get("result") == "correct" or (p.get("points_awarded") and p.get("points_value", 0) > 0))
        wrong = sum(1 for p in preds if p.get("result") == "wrong" or (p.get("points_awarded") and p.get("points_value", 0) < 0))
        pending = len(preds) - correct - wrong

        # Recent 5 predictions — enriched with match data
        sorted_preds = sorted(preds, key=lambda p: p.get("updated_at", ""), reverse=True)[:5]
        if sorted_preds:
            # Get matches from in-memory cache (fast) or API — max 10 day range
            now = datetime.now(timezone.utc)
            date_from = (now - timedelta(days=3)).strftime("%Y-%m-%d")
            date_to = (now + timedelta(days=5)).strftime("%Y-%m-%d")
            try:
                all_matches = await get_matches(db, date_from=date_from, date_to=date_to)
                match_map = {m["id"]: m for m in all_matches}
            except Exception:
                match_map = {}

            for pred in sorted_preds:
                m = match_map.get(pred["match_id"])
                if m:
                    pred["match"] = {
                        "homeTeam": m.get("homeTeam", {}),
                        "awayTeam": m.get("awayTeam", {}),
                        "competition": m.get("competition", {}),
                        "dateTime": m.get("dateTime"),
                        "status": m.get("status"),
                        "score": m.get("score", {}),
                    }
                    status = m.get("status")
                    score = m.get("score", {})
                    if status == "FINISHED" and score.get("home") is not None:
                        actual = "draw"
                        if score["home"] > score.get("away", 0):
                            actual = "home"
                        elif score.get("away", 0) > score["home"]:
                            actual = "away"
                        pred["result"] = "correct" if pred["prediction"] == actual else "wrong"
                    else:
                        pred["result"] = pred.get("result", "pending")
                else:
                    pred["result"] = pred.get("result", "pending")

        return {
            "predictions": sorted_preds,
            "total": len(preds),
            "summary": {
                "correct": correct, "wrong": wrong, "pending": pending,
                "points": user.get("points", 0) if user else 0
            }
        }

    async def fetch_favorites():
        favs = await db.favorites.find({"user_id": user_id}, {"_id": 0}).to_list(50)
        return {"favorites": favs}

    async def fetch_friends_leaderboard():
        friendships = await db.friendships.find(
            {"$or": [{"user_a": user_id}, {"user_b": user_id}]}, {"_id": 0}
        ).to_list(1000)
        friend_ids = [user_id]
        for f in friendships:
            friend_ids.append(f["user_b"] if f["user_a"] == user_id else f["user_a"])
        users_list = await db.users.find(
            {"user_id": {"$in": friend_ids}},
            {"_id": 0, "user_id": 1, "nickname": 1, "picture": 1, "points": 1, "level": 1}
        ).sort("points", -1).to_list(len(friend_ids))
        lb = []
        my_rank = None
        for idx, u in enumerate(users_list):
            rank = idx + 1
            entry = {
                "rank": rank, "user_id": u["user_id"], "nickname": u.get("nickname", "User"),
                "picture": u.get("picture"), "points": u.get("points", 0),
                "level": u.get("level", 0), "is_me": u["user_id"] == user_id
            }
            lb.append(entry)
            if u["user_id"] == user_id:
                my_rank = rank
        return {"leaderboard": lb, "my_rank": my_rank}

    # Run ALL queries in parallel
    preds_result, favs_result, lb_result = await asyncio.gather(
        fetch_predictions(), fetch_favorites(), fetch_friends_leaderboard(),
        return_exceptions=True
    )

    return {
        "predictions": preds_result if not isinstance(preds_result, Exception) else {"predictions": [], "total": 0, "summary": {"correct": 0, "wrong": 0, "pending": 0, "points": 0}},
        "favorites": favs_result if not isinstance(favs_result, Exception) else {"favorites": []},
        "friends_leaderboard": lb_result if not isinstance(lb_result, Exception) else {"leaderboard": [], "my_rank": None},
    }

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include auth routes
api_router.include_router(auth_router)
api_router.include_router(predictions_router)
api_router.include_router(football_router)
api_router.include_router(favorites_router)
api_router.include_router(settings_router)
api_router.include_router(friends_router)
api_router.include_router(messages_router)
api_router.include_router(notifications_router)
api_router.include_router(admin_router)
api_router.include_router(public_router)
api_router.include_router(subscriptions_router)

# Include the router in the main app
app.include_router(api_router)

# Create uploads directory and mount static files for avatars
UPLOAD_DIR = ROOT_DIR / 'uploads' / 'avatars'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/avatars", StaticFiles(directory=str(UPLOAD_DIR)), name="avatars")

# Create banners directory and mount static files
BANNER_DIR = ROOT_DIR / 'uploads' / 'banners'
BANNER_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/banners", StaticFiles(directory=str(BANNER_DIR)), name="banners")

# Create news images directory and mount static files
NEWS_DIR = ROOT_DIR / 'uploads' / 'news'
NEWS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads/news", StaticFiles(directory=str(NEWS_DIR)), name="news")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stripe webhook endpoint
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        body = await request.body()
        sig = request.headers.get("Stripe-Signature")
        
        api_key = os.environ.get("STRIPE_API_KEY")
        if not api_key:
            return {"status": "error", "message": "Stripe not configured"}
        
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, sig)
        
        now = datetime.now(timezone.utc).isoformat()
        
        if webhook_response.payment_status == "paid" and webhook_response.session_id:
            # Atomic update to prevent double processing
            result = await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id, "payment_status": {"$ne": "paid"}},
                {"$set": {
                    "status": "complete",
                    "payment_status": "paid",
                    "updated_at": now
                }}
            )
            
            if result.modified_count > 0:
                tx = await db.payment_transactions.find_one(
                    {"session_id": webhook_response.session_id},
                    {"_id": 0}
                )
                if tx:
                    sub_id = f"sub_{uuid.uuid4().hex[:12]}"
                    sub_doc = {
                        "subscription_id": sub_id,
                        "user_id": tx["user_id"],
                        "plan_id": tx["plan_id"],
                        "plan_name": tx["plan_name"],
                        "status": "active",
                        "amount": tx["amount"],
                        "currency": tx.get("currency", "usd"),
                        "session_id": webhook_response.session_id,
                        "activated_at": now,
                        "created_at": now
                    }
                    await db.user_subscriptions.insert_one(sub_doc)
                    
                    plan = await db.subscription_plans.find_one(
                        {"plan_id": tx["plan_id"]},
                        {"_id": 0}
                    )
                    await db.users.update_one(
                        {"user_id": tx["user_id"]},
                        {"$set": {
                            "subscription_plan": tx["plan_id"],
                            "subscription_name": tx["plan_name"],
                            "subscription_badge": plan.get("badge_name") if plan else None,
                            "subscription_badge_color": plan.get("badge_color") if plan else None,
                            "subscription_active": True,
                            "updated_at": now
                        }}
                    )
                    logger.info(f"Webhook: Subscription activated for {tx['user_id']}")
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# WebSocket endpoint for live match updates
@app.websocket("/api/ws/matches")
async def websocket_matches(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for client messages
            data = await websocket.receive_text()
            # Client can send "ping" to keep alive
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)


# WebSocket endpoint for friend notifications
@app.websocket("/api/ws/friends/{user_id}")
async def websocket_friends(websocket: WebSocket, user_id: str):
    """WebSocket for real-time friend notifications"""
    # Validate user_id matches the authenticated user
    session_token = websocket.cookies.get("session_token")
    if not session_token:
        await websocket.close(code=4001, reason="Not authenticated")
        return
    
    # Validate session
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session or session.get("user_id") != user_id:
        await websocket.close(code=4003, reason="Invalid session")
        return
    
    await friend_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await friend_manager.disconnect(websocket, user_id)
    except Exception:
        await friend_manager.disconnect(websocket, user_id)


# ==================== WebSocket: Chat ====================

@app.websocket("/api/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    """WebSocket for real-time chat messages"""
    session_token = websocket.cookies.get("session_token")
    if not session_token:
        # Try query param fallback
        session_token = websocket.query_params.get("token")
    if not session_token:
        await websocket.close(code=4001, reason="Not authenticated")
        return

    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session or session.get("user_id") != user_id:
        await websocket.close(code=4003, reason="Invalid session")
        return

    # Update online status
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
    )

    await chat_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await chat_manager.disconnect(websocket, user_id)
        # Update offline status only if no other connections remain
        if not chat_manager.is_online(user_id) and not notification_manager.is_online(user_id):
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
            )


# ==================== WebSocket: Notifications ====================

@app.websocket("/api/ws/notifications/{user_id}")
async def websocket_notifications(websocket: WebSocket, user_id: str):
    """WebSocket for real-time notifications (messages, friend requests, badges, etc.)"""
    session_token = websocket.cookies.get("session_token")
    if not session_token:
        session_token = websocket.query_params.get("token")
    if not session_token:
        await websocket.close(code=4001, reason="Not authenticated")
        return

    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session or session.get("user_id") != user_id:
        await websocket.close(code=4003, reason="Invalid session")
        return

    # Update online status
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
    )

    await notification_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await notification_manager.disconnect(websocket, user_id)
        if not chat_manager.is_online(user_id) and not notification_manager.is_online(user_id):
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
            )


async def seed_default_api_key(db):
    """Seed default Football API key into database if none exists"""
    try:
        # Get API key from environment
        api_key = os.environ.get("FOOTBALL_API_KEY", "")
        
        # Check if any API configs exist
        count = await db.admin_api_configs.count_documents({})
        
        if count == 0 and api_key:
            base_url = os.environ.get("FOOTBALL_API_BASE_URL", "https://v3.football.api-sports.io")
            # Normalize football-data.org URLs
            if "football-data.org" in base_url.lower():
                base_url = "https://api.football-data.org/v4"
            doc = {
                "api_id": f"api_{uuid.uuid4().hex[:12]}",
                "name": "Default Football API",
                "base_url": base_url,
                "api_key": api_key,
                "enabled": True,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            }
            await db.admin_api_configs.insert_one(doc)
            logger.info("Seeded default Football API key into database")
        else:
            logger.info(f"Found {count} API config(s) in database - skipping seed")
    except Exception as e:
        logger.error(f"Failed to seed default API key: {e}")
    except Exception as e:
        logger.error(f"Failed to seed default API key: {e}")


async def seed_admin_account(db):
    """Seed the admin account if it doesn't exist"""
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "farhad.isgandar@gmail.com")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Salam123?")
    ADMIN_NICKNAME = os.environ.get("ADMIN_NICKNAME", "admin")
    
    try:
        # Check if admin account exists
        existing_admin = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
        
        if not existing_admin:
            # Create admin user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            now = datetime.now(timezone.utc).isoformat()
            
            admin_doc = {
                "user_id": user_id,
                "email": ADMIN_EMAIL,
                "password_hash": pwd_context.hash(ADMIN_PASSWORD),
                "nickname": ADMIN_NICKNAME,
                "nickname_set": True,
                "nickname_changed": False,
                "auth_provider": "email",
                "role": "admin",
                "points": 0,
                "level": 0,
                "picture": None,
                "is_online": False,
                "is_banned": False,
                "created_at": now,
                "updated_at": now
            }
            
            await db.users.insert_one(admin_doc)
            logger.info(f"✅ Seeded admin account: {ADMIN_EMAIL}")
        else:
            # Ensure the existing user has admin role
            if existing_admin.get("role") != "admin":
                await db.users.update_one(
                    {"email": ADMIN_EMAIL},
                    {"$set": {"role": "admin", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                logger.info(f"✅ Promoted existing user to admin: {ADMIN_EMAIL}")
            else:
                logger.info(f"ℹ️  Admin account already exists: {ADMIN_EMAIL}")
    except Exception as e:
        logger.error(f"❌ Failed to seed admin account: {e}")



@app.on_event("startup")
async def startup_event():
    """Start background polling for live matches"""
    # Create indexes for messages and notifications
    await db.messages.create_index([("sender_id", 1), ("receiver_id", 1), ("created_at", -1)])
    await db.messages.create_index([("receiver_id", 1), ("read", 1)])
    await db.messages.create_index([("receiver_id", 1), ("delivered", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.favorite_matches.create_index([("user_id", 1), ("match_id", 1)], unique=True)
    await db.favorite_matches.create_index([("user_id", 1), ("created_at", -1)])
    # Admin panel indexes
    await db.admin_audit_log.create_index([("timestamp", -1)])
    await db.admin_audit_log.create_index([("admin_id", 1)])
    await db.admin_audit_log.create_index([("action", 1)])
    await db.reported_messages.create_index([("reported_at", -1)])
    await db.pinned_matches.create_index([("match_id", 1)], unique=True)
    await db.hidden_matches.create_index([("match_id", 1)], unique=True)
    await db.users.create_index([("role", 1)])
    await db.users.create_index([("is_banned", 1)])
    await db.users.create_index([("points", -1)])
    await db.users.create_index([("is_online", 1)])
    # New admin collections indexes
    await db.admin_api_configs.create_index([("api_id", 1)], unique=True)
    await db.admin_api_configs.create_index([("is_active", 1)])
    await db.admin_favorite_users.create_index([("admin_id", 1), ("user_id", 1)], unique=True)
    await db.predictions.create_index([("user_id", 1), ("points_awarded", 1)])
    # Performance indexes for vote counting and match queries
    await db.predictions.create_index([("match_id", 1), ("prediction", 1)])
    await db.exact_score_predictions.create_index([("user_id", 1), ("match_id", 1)])
    await db.exact_score_predictions.create_index([("match_id", 1)])
    await db.points_gifts.create_index([("created_at", -1)])
    # Subscription indexes
    await db.subscription_plans.create_index([("plan_id", 1)], unique=True)
    await db.user_subscriptions.create_index([("user_id", 1), ("status", 1)])
    await db.payment_transactions.create_index([("session_id", 1)], unique=True)
    await db.payment_transactions.create_index([("user_id", 1)])
    
    # Seed default Football API key if none exists
    await seed_default_api_key(db)
    
    # Seed admin account if it doesn't exist
    await seed_admin_account(db)
    
    # Seed subscription plans
    await seed_subscription_plans(db)
    
    start_polling(db)


@app.on_event("shutdown")
async def shutdown_db_client():
    stop_polling()
    client.close()
