"""
Subscriptions Routes - Subscription plans and Stripe payment integration
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List
import logging
import uuid
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

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

# ==================== Default Plans ====================

DEFAULT_PLANS = [
    {
        "plan_id": "plan_standard",
        "name": "Standard",
        "price": 4.99,
        "currency": "usd",
        "interval": "month",
        "features": [
            "Ad-free experience",
            "Basic statistics",
            "Profile badge"
        ],
        "badge_name": "Standard",
        "badge_color": "#22c55e",
        "order": 1,
        "is_active": True
    },
    {
        "plan_id": "plan_champion",
        "name": "Champion",
        "price": 9.99,
        "currency": "usd",
        "interval": "month",
        "features": [
            "Everything in Standard",
            "Advanced prediction insights",
            "Priority match analysis",
            "Special Champion badge"
        ],
        "badge_name": "Champion",
        "badge_color": "#3b82f6",
        "order": 2,
        "is_active": True
    },
    {
        "plan_id": "plan_elite",
        "name": "Elite",
        "price": 19.99,
        "currency": "usd",
        "interval": "month",
        "features": [
            "Everything in Champion",
            "Exclusive Elite badge",
            "Early access to new features",
            "Advanced analytics & detailed stats"
        ],
        "badge_name": "Elite",
        "badge_color": "#a855f7",
        "order": 3,
        "is_active": True
    }
]


async def seed_subscription_plans(db):
    """Seed default subscription plans if none exist"""
    count = await db.subscription_plans.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for plan in DEFAULT_PLANS:
            plan["created_at"] = now
            plan["updated_at"] = now
            await db.subscription_plans.insert_one(plan)
        logger.info("Seeded default subscription plans")


# ==================== Models ====================

class CreateCheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str


# ==================== Routes ====================

@router.get("/plans")
async def get_plans(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all active subscription plans"""
    plans = await db.subscription_plans.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(10)
    return {"plans": plans}


@router.get("/my-subscription")
async def get_my_subscription(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get current user's active subscription"""
    user = await get_current_user(request, db)
    
    sub = await db.user_subscriptions.find_one(
        {"user_id": user["user_id"], "status": "active"},
        {"_id": 0}
    )
    
    if sub:
        plan = await db.subscription_plans.find_one(
            {"plan_id": sub["plan_id"]},
            {"_id": 0}
        )
        sub["plan"] = plan
    
    return {"subscription": sub}


@router.post("/checkout")
async def create_checkout(
    data: CreateCheckoutRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a Stripe checkout session for a subscription plan"""
    user = await get_current_user(request, db)
    
    # Get plan from DB (server-side price lookup - never trust frontend)
    plan = await db.subscription_plans.find_one(
        {"plan_id": data.plan_id, "is_active": True},
        {"_id": 0}
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or inactive")
    
    # Check if user already has an active subscription
    existing = await db.user_subscriptions.find_one(
        {"user_id": user["user_id"], "status": "active"},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active subscription. Cancel it first to change plans.")
    
    # Create Stripe checkout session
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{data.origin_url}/subscribe/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/subscribe"
    
    metadata = {
        "user_id": user["user_id"],
        "plan_id": data.plan_id,
        "plan_name": plan["name"],
        "type": "subscription"
    }
    
    checkout_request = CheckoutSessionRequest(
        amount=float(plan["price"]),
        currency=plan.get("currency", "usd"),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    tx_id = f"tx_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    tx_doc = {
        "transaction_id": tx_id,
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "plan_id": data.plan_id,
        "plan_name": plan["name"],
        "amount": float(plan["price"]),
        "currency": plan.get("currency", "usd"),
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": now,
        "updated_at": now
    }
    await db.payment_transactions.insert_one(tx_doc)
    
    return {
        "checkout_url": session.url,
        "session_id": session.session_id
    }


@router.get("/checkout/status/{session_id}")
async def get_checkout_status(
    session_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Check the status of a checkout session and activate subscription if paid"""
    user = await get_current_user(request, db)
    
    # Find the transaction
    tx = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return current status
    if tx.get("payment_status") == "paid":
        sub = await db.user_subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"},
            {"_id": 0}
        )
        return {
            "status": "complete",
            "payment_status": "paid",
            "subscription": sub
        }
    
    # Poll Stripe for status
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    now = datetime.now(timezone.utc).isoformat()
    
    if checkout_status.payment_status == "paid":
        # Update transaction - use atomic operation to prevent double processing
        result = await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {
                "status": "complete",
                "payment_status": "paid",
                "updated_at": now
            }}
        )
        
        # Only activate subscription if we actually updated (prevents double activation)
        if result.modified_count > 0:
            # Activate subscription
            sub_id = f"sub_{uuid.uuid4().hex[:12]}"
            sub_doc = {
                "subscription_id": sub_id,
                "user_id": user["user_id"],
                "plan_id": tx["plan_id"],
                "plan_name": tx["plan_name"],
                "status": "active",
                "amount": tx["amount"],
                "currency": tx.get("currency", "usd"),
                "session_id": session_id,
                "activated_at": now,
                "created_at": now
            }
            await db.user_subscriptions.insert_one(sub_doc)
            
            # Update user with subscription info
            plan = await db.subscription_plans.find_one(
                {"plan_id": tx["plan_id"]},
                {"_id": 0}
            )
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {
                    "subscription_plan": tx["plan_id"],
                    "subscription_name": tx["plan_name"],
                    "subscription_badge": plan.get("badge_name") if plan else None,
                    "subscription_badge_color": plan.get("badge_color") if plan else None,
                    "subscription_active": True,
                    "updated_at": now
                }}
            )
            
            logger.info(f"Subscription activated: {user['user_id']} -> {tx['plan_name']}")
        
        sub = await db.user_subscriptions.find_one(
            {"user_id": user["user_id"], "status": "active"},
            {"_id": 0}
        )
        return {
            "status": "complete",
            "payment_status": "paid",
            "subscription": sub
        }
    
    elif checkout_status.status == "expired":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now}}
        )
        return {"status": "expired", "payment_status": "expired"}
    
    return {
        "status": checkout_status.status,
        "payment_status": checkout_status.payment_status
    }


@router.post("/cancel")
async def cancel_subscription(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Cancel user's active subscription"""
    user = await get_current_user(request, db)
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.user_subscriptions.update_one(
        {"user_id": user["user_id"], "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": now}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    # Update user record
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "subscription_plan": None,
            "subscription_name": None,
            "subscription_badge": None,
            "subscription_badge_color": None,
            "subscription_active": False,
            "updated_at": now
        }}
    )
    
    return {"success": True, "message": "Subscription cancelled"}
