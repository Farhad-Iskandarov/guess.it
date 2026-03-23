"""
Error Spike Detector — Lightweight async engine that checks for error spikes
after each new error report.

Spike triggers:
  1. Volume spike:  >= VOLUME_THRESHOLD errors in WINDOW_MINUTES
  2. Repeat spike:  >= REPEAT_THRESHOLD of the SAME error message in WINDOW_MINUTES

Cooldown: Won't re-alert for the same pattern within COOLDOWN_MINUTES.

Delivers alerts as in-app admin notifications.
Future: Email (SendGrid/Resend) and Slack webhook — see README.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# ── Thresholds ──
VOLUME_THRESHOLD = 10        # total errors in window
REPEAT_THRESHOLD = 5         # same message in window
WINDOW_MINUTES = 5           # detection window
COOLDOWN_MINUTES = 15        # silence repeated alerts

# ── In-memory cooldown tracker ──
_cooldowns = {}  # key -> last_alert_timestamp


def _is_cooled_down(key: str) -> bool:
    """Return True if we can alert for this key (cooldown expired)."""
    last = _cooldowns.get(key, 0)
    return (time.time() - last) >= (COOLDOWN_MINUTES * 60)


def _mark_alerted(key: str):
    _cooldowns[key] = time.time()


async def check_and_alert(db):
    """
    Run after each error report. Checks for spikes and creates admin
    notifications if thresholds are exceeded. Non-blocking, fire-and-forget.
    """
    try:
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(minutes=WINDOW_MINUTES)).isoformat()

        # ── 1. Volume spike ──
        volume_key = "spike:volume"
        if _is_cooled_down(volume_key):
            recent_count = await db.error_logs.count_documents(
                {"created_at": {"$gte": window_start}}
            )
            if recent_count >= VOLUME_THRESHOLD:
                # Get top error in this window for context
                top = await db.error_logs.aggregate([
                    {"$match": {"created_at": {"$gte": window_start}}},
                    {"$group": {"_id": "$message", "count": {"$sum": 1}, "routes": {"$addToSet": "$route"}}},
                    {"$sort": {"count": -1}},
                    {"$limit": 1},
                ]).to_list(1)

                top_msg = top[0]["_id"] if top else "Various errors"
                top_count = top[0]["count"] if top else recent_count
                top_routes = top[0].get("routes", []) if top else []

                await _send_admin_alert(
                    db,
                    alert_type="volume_spike",
                    title=f"Error spike: {recent_count} errors in {WINDOW_MINUTES}min",
                    details={
                        "total_errors": recent_count,
                        "window_minutes": WINDOW_MINUTES,
                        "top_error": top_msg,
                        "top_error_count": top_count,
                        "affected_routes": top_routes[:5],
                        "detected_at": now.isoformat(),
                    },
                )
                _mark_alerted(volume_key)
                logger.warning(f"[SpikeDetector] Volume spike: {recent_count} errors in {WINDOW_MINUTES}min")

        # ── 2. Repeat spike (same message) ──
        repeat_pipeline = [
            {"$match": {"created_at": {"$gte": window_start}}},
            {"$group": {"_id": "$message", "count": {"$sum": 1}, "routes": {"$addToSet": "$route"}}},
            {"$match": {"count": {"$gte": REPEAT_THRESHOLD}}},
            {"$sort": {"count": -1}},
            {"$limit": 3},
        ]
        repeats = await db.error_logs.aggregate(repeat_pipeline).to_list(3)

        for rep in repeats:
            repeat_key = f"spike:repeat:{rep['_id'][:80]}"
            if _is_cooled_down(repeat_key):
                await _send_admin_alert(
                    db,
                    alert_type="repeat_spike",
                    title=f"Recurring error: \"{rep['_id'][:60]}\" ({rep['count']}x in {WINDOW_MINUTES}min)",
                    details={
                        "error_message": rep["_id"],
                        "occurrences": rep["count"],
                        "window_minutes": WINDOW_MINUTES,
                        "affected_routes": rep.get("routes", [])[:5],
                        "detected_at": now.isoformat(),
                    },
                )
                _mark_alerted(repeat_key)
                logger.warning(f"[SpikeDetector] Repeat spike: '{rep['_id'][:60]}' x{rep['count']}")

    except Exception as e:
        # Never crash the request handler — just log
        logger.error(f"[SpikeDetector] Check failed: {e}")


async def _send_admin_alert(db, alert_type: str, title: str, details: dict):
    """
    Create an in-app notification for all admin users + store in error_alerts collection.
    Future: add email/Slack delivery here.
    """
    import uuid

    now = datetime.now(timezone.utc).isoformat()

    # Store the alert
    alert_doc = {
        "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
        "alert_type": alert_type,
        "title": title,
        "details": details,
        "created_at": now,
        "acknowledged": False,
    }
    await db.error_alerts.insert_one(alert_doc)

    # Push in-app notification to all admin users
    admin_users = await db.users.find(
        {"role": "admin"}, {"_id": 0, "user_id": 1}
    ).to_list(50)

    for admin in admin_users:
        from routes.notifications import create_notification
        await create_notification(
            db,
            user_id=admin["user_id"],
            notif_type="error_spike",
            message=title,
            data={"alert_type": alert_type, **details},
        )

    logger.info(f"[SpikeDetector] Alert sent to {len(admin_users)} admin(s): {title[:80]}")

    # ── Future: Email delivery ──
    # email_to = os.environ.get("ALERT_EMAIL")
    # if email_to:
    #     await send_alert_email(email_to, title, details)

    # ── Future: Slack webhook ──
    # slack_url = os.environ.get("SLACK_WEBHOOK_URL")
    # if slack_url:
    #     await send_slack_alert(slack_url, title, details)
