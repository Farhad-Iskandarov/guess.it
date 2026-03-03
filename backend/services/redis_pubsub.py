"""
Redis Pub/Sub layer for cross-instance WebSocket broadcasting.
Enables horizontal scaling by routing all WebSocket broadcasts through Redis channels.
"""
import asyncio
import json
import logging
import redis.asyncio as aioredis
import os

logger = logging.getLogger(__name__)

# Redis connection
_redis: aioredis.Redis = None
_subscriber_task = None
_handlers: dict[str, list] = {}

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

# Channel names
CHANNEL_LIVE_MATCHES = "ws:live_matches"
CHANNEL_FRIENDS = "ws:friends"
CHANNEL_CHAT = "ws:chat"
CHANNEL_NOTIFICATIONS = "ws:notifications"


async def get_redis() -> aioredis.Redis:
    """Get or create Redis connection."""
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            await _redis.ping()
            logger.info("Redis connected successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Falling back to local-only mode.")
            _redis = None
    return _redis


async def publish(channel: str, data: dict):
    """Publish a message to a Redis channel."""
    r = await get_redis()
    if r is None:
        return False
    try:
        await r.publish(channel, json.dumps(data, default=str))
        return True
    except Exception as e:
        logger.warning(f"Redis publish error: {e}")
        return False


def register_handler(channel: str, handler):
    """Register a handler function for a Redis channel."""
    if channel not in _handlers:
        _handlers[channel] = []
    _handlers[channel].append(handler)


async def _subscriber_loop():
    """Background task that subscribes to all registered channels and dispatches messages."""
    r = await get_redis()
    if r is None:
        logger.warning("Redis not available, pub/sub subscriber not started")
        return

    pubsub = r.pubsub()
    channels = list(_handlers.keys())
    if not channels:
        return

    try:
        await pubsub.subscribe(*channels)
        logger.info(f"Redis subscriber listening on channels: {channels}")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            channel = message["channel"]
            try:
                data = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                continue

            handlers = _handlers.get(channel, [])
            for handler in handlers:
                try:
                    await handler(data)
                except Exception as e:
                    logger.error(f"Handler error on channel {channel}: {e}")
    except asyncio.CancelledError:
        await pubsub.unsubscribe(*channels)
        await pubsub.close()
    except Exception as e:
        logger.error(f"Redis subscriber error: {e}")


async def start_subscriber():
    """Start the Redis subscriber background task."""
    global _subscriber_task
    if _subscriber_task is not None:
        return
    _subscriber_task = asyncio.create_task(_subscriber_loop())
    logger.info("Redis pub/sub subscriber started")


async def stop_subscriber():
    """Stop the Redis subscriber."""
    global _subscriber_task
    if _subscriber_task:
        _subscriber_task.cancel()
        try:
            await _subscriber_task
        except asyncio.CancelledError:
            pass
        _subscriber_task = None


# ==================== Caching Helpers ====================

async def cache_get(key: str) -> str:
    """Get a value from Redis cache."""
    r = await get_redis()
    if r is None:
        return None
    try:
        return await r.get(key)
    except Exception:
        return None


async def cache_set(key: str, value: str, ttl_seconds: int = 30):
    """Set a value in Redis cache with TTL."""
    r = await get_redis()
    if r is None:
        return False
    try:
        await r.set(key, value, ex=ttl_seconds)
        return True
    except Exception:
        return False


async def cache_delete(key: str):
    """Delete a key from Redis cache."""
    r = await get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except Exception:
        pass


# ==================== Rate Limiting ====================

async def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> bool:
    """Check rate limit using Redis sliding window. Returns True if allowed."""
    r = await get_redis()
    if r is None:
        return True  # Allow if Redis unavailable

    try:
        pipe = r.pipeline()
        await pipe.incr(key)
        await pipe.expire(key, window_seconds)
        results = await pipe.execute()
        current_count = results[0]
        return current_count <= max_requests
    except Exception:
        return True  # Allow on error


async def close():
    """Close Redis connection."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
