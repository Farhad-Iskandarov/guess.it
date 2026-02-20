"""
Public routes for subscriptions, contact form, news, and contact settings
"""
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Optional
import uuid
import html
import re
from pathlib import Path

router = APIRouter(tags=["Public"])

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

def sanitize(text: str) -> str:
    if not text:
        return ""
    text = html.escape(str(text).strip())
    text = re.sub(r'<[^>]*>', '', text)
    return text[:5000]

# ==================== Subscriptions ====================

@router.post("/subscribe")
async def subscribe_email(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    body = await request.json()
    email = body.get("email", "").strip().lower()
    if not email or not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        raise HTTPException(status_code=400, detail="Valid email is required")
    
    existing = await db.subscriptions.find_one({"email": email})
    if existing:
        return {"success": True, "message": "You're already subscribed!"}
    
    doc = {
        "sub_id": f"sub_{uuid.uuid4().hex[:12]}",
        "email": email,
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subscriptions.insert_one(doc)
    return {"success": True, "message": "Subscribed successfully!"}

# ==================== Contact Form ====================

@router.post("/contact")
async def submit_contact(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    body = await request.json()
    name = sanitize(body.get("name", ""))
    email = body.get("email", "").strip().lower()
    subject = sanitize(body.get("subject", ""))
    message = sanitize(body.get("message", ""))
    
    if not name or not email or not subject or not message:
        raise HTTPException(status_code=400, detail="All fields are required")
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        raise HTTPException(status_code=400, detail="Valid email is required")
    
    doc = {
        "msg_id": f"msg_{uuid.uuid4().hex[:12]}",
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "flagged": False,
        "read": False,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_messages.insert_one(doc)
    return {"success": True, "message": "Message sent successfully!"}

# ==================== Contact Settings (Public Read) ====================

@router.get("/contact-settings")
async def get_contact_settings(db: AsyncIOMotorDatabase = Depends(get_db)):
    settings = await db.contact_settings.find_one({"key": "contact_info"}, {"_id": 0})
    if not settings:
        return {
            "email_title": "Email Us",
            "email_address": "support@guessit.com",
            "location_title": "Location",
            "location_address": "San Francisco, CA"
        }
    return {
        "email_title": settings.get("email_title", "Email Us"),
        "email_address": settings.get("email_address", "support@guessit.com"),
        "location_title": settings.get("location_title", "Location"),
        "location_address": settings.get("location_address", "San Francisco, CA")
    }

# ==================== News (Public Read) ====================

NEWS_IMG_DIR = Path("/app/backend/uploads/news")
NEWS_IMG_DIR.mkdir(parents=True, exist_ok=True)

@router.get("/news")
async def list_news(db: AsyncIOMotorDatabase = Depends(get_db), limit: int = 50, skip: int = 0):
    articles = await db.news_articles.find(
        {"published": True}, {"_id": 0}
    ).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.news_articles.count_documents({"published": True})
    return {"articles": articles, "total": total}

@router.get("/news/{article_id}")
async def get_news_article(article_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    article = await db.news_articles.find_one({"article_id": article_id, "published": True}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Get similar articles (same category or recent)
    similar = await db.news_articles.find(
        {"published": True, "article_id": {"$ne": article_id}},
        {"_id": 0}
    ).sort("date", -1).limit(3).to_list(3)
    
    return {"article": article, "similar": similar}
