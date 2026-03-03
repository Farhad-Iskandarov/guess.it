"""
Reminder Worker — Standalone background process.
Runs INDEPENDENTLY from the API server to prevent:
  - Event loop starvation on the API
  - Duplicate reminders when scaling API horizontally
  - Scheduler duplication across workers

This worker handles:
  1. Reminder engine (pre-kickoff, favorite club, urgency notifications)
  2. Live match polling + WebSocket broadcast via Redis pub/sub
  3. Weekly leaderboard reset
  4. Exact score processing for finished matches

Only ONE instance of this worker must run.
"""
import asyncio
import os
import sys
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Setup path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("reminder_worker")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Import services
from services.reminder_engine import (
    check_pre_kickoff_reminders,
    check_favorite_club_matchday,
    check_favorite_club_urgency,
    check_weekly_leaderboard_reset,
)
from services.football_api import (
    get_live_matches,
    get_today_matches,
    set_db_for_logging,
    _flush_log_buffer,
)
from services.redis_pubsub import publish, CHANNEL_LIVE_MATCHES

REMINDER_INTERVAL = 300  # 5 minutes
POLLING_INTERVAL = 30    # 30 seconds


async def reminder_loop():
    """Run all reminder checks every 5 minutes."""
    logger.info(f"Reminder loop started (interval={REMINDER_INTERVAL}s)")
    while True:
        try:
            await asyncio.gather(
                check_pre_kickoff_reminders(db),
                check_favorite_club_matchday(db),
                check_favorite_club_urgency(db),
                check_weekly_leaderboard_reset(db),
                return_exceptions=True,
            )
            logger.debug("Reminder checks complete")
        except Exception as e:
            logger.error(f"Reminder loop error: {e}")
        await asyncio.sleep(REMINDER_INTERVAL)


async def polling_loop():
    """Poll for live match updates and publish via Redis."""
    logger.info(f"Polling loop started (interval={POLLING_INTERVAL}s)")
    processed_finished_matches = set()

    while True:
        try:
            # Fetch live matches
            live_matches = await get_live_matches(db)
            if live_matches:
                await publish(CHANNEL_LIVE_MATCHES, {
                    "type": "live_update",
                    "matches": live_matches,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            # Fetch today's matches
            today_matches = await get_today_matches(db)
            if today_matches:
                await publish(CHANNEL_LIVE_MATCHES, {
                    "type": "today_update",
                    "matches": today_matches,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

                # Process newly finished matches
                for match in today_matches:
                    if match.get("status") == "FINISHED":
                        match_id = match.get("id")
                        if match_id and match_id not in processed_finished_matches:
                            score = match.get("score", {})
                            home_score = score.get("home")
                            away_score = score.get("away")
                            if home_score is not None and away_score is not None:
                                try:
                                    from services.prediction_processor import process_exact_score_results
                                    await process_exact_score_results(db, match_id, home_score, away_score)
                                    processed_finished_matches.add(match_id)
                                    logger.info(f"Processed exact scores for finished match {match_id}")
                                except Exception as e:
                                    logger.error(f"Error processing exact scores for match {match_id}: {e}")

            # Flush API logs periodically
            await _flush_log_buffer()

        except Exception as e:
            logger.error(f"Polling loop error: {e}")

        await asyncio.sleep(POLLING_INTERVAL)


async def main():
    """Main entry point for reminder worker."""
    logger.info("=" * 60)
    logger.info("REMINDER WORKER STARTING")
    logger.info("=" * 60)

    # Set DB reference for API logging
    set_db_for_logging(db)

    # Run both loops concurrently
    await asyncio.gather(
        reminder_loop(),
        polling_loop(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Reminder worker stopped")
    finally:
        client.close()
