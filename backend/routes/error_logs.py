"""
Error Logs Route — Automatic error reporting from frontend error boundaries.
- POST /error-logs/report  → public (no auth required), rate-limited by IP
- GET  /error-logs          → admin-only, paginated, filterable
- GET  /error-logs/stats    → admin-only, frequency/aggregation
- GET  /error-logs/alerts   → admin-only, spike alert history
"""
from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
from collections import defaultdict
import asyncio
import time
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/error-logs", tags=["Error Logs"])

# ==================== Client-side rate limiter (by IP) ====================
class IPRateLimiter:
    """Max N reports per IP per window. Prevents spam without requiring auth."""
    def __init__(self, max_reports: int = 5, window_seconds: int = 60):
        self.max_reports = max_reports
        self.window_seconds = window_seconds
        self.hits = defaultdict(list)

    def allow(self, ip: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        self.hits[ip] = [t for t in self.hits[ip] if t > cutoff]
        if len(self.hits[ip]) >= self.max_reports:
            return False
        self.hits[ip].append(now)
        return True

_limiter = IPRateLimiter(max_reports=5, window_seconds=60)


# ==================== POST /report ====================
@router.post("/report")
async def report_error(request: Request):
    """
    Receive an error report from the frontend error boundary.
    No auth required — rate-limited by IP.
    """
    ip = request.headers.get("x-forwarded-for", request.client.host or "unknown").split(",")[0].strip()
    if not _limiter.allow(ip):
        raise HTTPException(status_code=429, detail="Too many error reports. Please try again later.")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = str(body.get("message", ""))[:500]
    stack = str(body.get("stack", ""))[:3000]
    component_stack = str(body.get("componentStack", ""))[:2000]
    route = str(body.get("route", ""))[:200]
    user_id = str(body.get("userId", ""))[:50] or None
    boundary_label = str(body.get("boundaryLabel", ""))[:100] or "Unknown"
    user_agent = str(body.get("userAgent", ""))[:500]
    screen = str(body.get("screen", ""))[:50]
    language = str(body.get("language", ""))[:10]

    if not message:
        raise HTTPException(status_code=400, detail="Error message is required")

    db = request.app.state.db
    doc = {
        "error_id": f"err_{int(time.time() * 1000)}_{ip[-4:].replace('.', '')}",
        "message": message,
        "stack": stack,
        "component_stack": component_stack,
        "route": route,
        "user_id": user_id,
        "boundary_label": boundary_label,
        "user_agent": user_agent,
        "screen": screen,
        "language": language,
        "ip": ip,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved": False,
    }

    await db.error_logs.insert_one(doc)
    logger.info(f"[ErrorLog] Captured: '{message[:80]}' from {boundary_label} at {route}")

    # Fire-and-forget spike detection — never blocks the response
    from services.spike_detector import check_and_alert
    asyncio.create_task(check_and_alert(db))

    return {"status": "ok"}


# ==================== Admin helpers ====================
async def _require_admin(request: Request):
    """Quick admin check — reuses the session cookie pattern."""
    db = request.app.state.db
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ==================== GET / (list) ====================
@router.get("")
async def list_error_logs(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    route_filter: Optional[str] = None,
    boundary_filter: Optional[str] = None,
    resolved: Optional[bool] = None,
    search: Optional[str] = None,
):
    await _require_admin(request)
    db = request.app.state.db

    query = {}
    if date_from:
        query["created_at"] = query.get("created_at", {})
        query["created_at"]["$gte"] = date_from
    if date_to:
        query["created_at"] = query.get("created_at", {})
        query["created_at"]["$lte"] = date_to
    if route_filter:
        query["route"] = {"$regex": route_filter, "$options": "i"}
    if boundary_filter:
        query["boundary_label"] = {"$regex": boundary_filter, "$options": "i"}
    if resolved is not None:
        query["resolved"] = resolved
    if search:
        query["message"] = {"$regex": search, "$options": "i"}

    total = await db.error_logs.count_documents(query)
    skip = (page - 1) * limit
    logs = await db.error_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "logs": logs,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),
    }


# ==================== GET /stats ====================
@router.get("/stats")
async def error_stats(request: Request):
    await _require_admin(request)
    db = request.app.state.db

    now = datetime.now(timezone.utc)
    day_ago = (now - timedelta(hours=24)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    total = await db.error_logs.count_documents({})
    last_24h = await db.error_logs.count_documents({"created_at": {"$gte": day_ago}})
    last_7d = await db.error_logs.count_documents({"created_at": {"$gte": week_ago}})
    unresolved = await db.error_logs.count_documents({"resolved": False})

    # Top recurring errors (by message) last 7 days
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$message", "count": {"$sum": 1}, "last_seen": {"$max": "$created_at"}, "routes": {"$addToSet": "$route"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_errors = await db.error_logs.aggregate(pipeline).to_list(10)

    # Top routes with errors
    route_pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$route", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_routes = await db.error_logs.aggregate(route_pipeline).to_list(10)

    # Top boundary labels
    boundary_pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$boundary_label", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_boundaries = await db.error_logs.aggregate(boundary_pipeline).to_list(10)

    return {
        "total": total,
        "last_24h": last_24h,
        "last_7d": last_7d,
        "unresolved": unresolved,
        "top_errors": [{"message": e["_id"], "count": e["count"], "last_seen": e["last_seen"], "routes": e["routes"]} for e in top_errors],
        "top_routes": [{"route": r["_id"], "count": r["count"]} for r in top_routes],
        "top_boundaries": [{"boundary": b["_id"], "count": b["count"]} for b in top_boundaries],
    }


# ==================== PATCH /:error_id/resolve ====================
@router.patch("/{error_id}/resolve")
async def toggle_resolve(error_id: str, request: Request):
    await _require_admin(request)
    db = request.app.state.db

    doc = await db.error_logs.find_one({"error_id": error_id}, {"_id": 0, "resolved": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Error log not found")

    new_val = not doc.get("resolved", False)
    await db.error_logs.update_one({"error_id": error_id}, {"$set": {"resolved": new_val}})
    return {"error_id": error_id, "resolved": new_val}


# ==================== DELETE /:error_id ====================
@router.delete("/{error_id}")
async def delete_error_log(error_id: str, request: Request):
    await _require_admin(request)
    db = request.app.state.db

    result = await db.error_logs.delete_one({"error_id": error_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Error log not found")
    return {"status": "deleted"}


# ==================== GET /alerts ====================
@router.get("/alerts")
async def list_alerts(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    await _require_admin(request)
    db = request.app.state.db

    total = await db.error_alerts.count_documents({})
    skip = (page - 1) * limit
    alerts = await db.error_alerts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "alerts": alerts,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),
    }


# ==================== PATCH /alerts/:alert_id/acknowledge ====================
@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, request: Request):
    await _require_admin(request)
    db = request.app.state.db

    doc = await db.error_alerts.find_one({"alert_id": alert_id}, {"_id": 0, "acknowledged": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Alert not found")

    new_val = not doc.get("acknowledged", False)
    await db.error_alerts.update_one({"alert_id": alert_id}, {"$set": {"acknowledged": new_val}})
    return {"alert_id": alert_id, "acknowledged": new_val}
