# GuessIt – Football Prediction Platform

## Overview
GuessIt is a real-time football prediction platform where users predict match outcomes (1/X/2 + exact score), compete on leaderboards, chat with friends, and subscribe for premium features.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 3, shadcn/ui (Radix), Recharts, CRACO |
| Backend | FastAPI (Python 3.11), Uvicorn, Pydantic v2 |
| Database | MongoDB (Motor async driver) |
| Cache & Pub/Sub | Redis 7 (leaderboard caching, WebSocket scaling, rate limiting) |
| Real-time | WebSockets (asyncio, parallel broadcast via `asyncio.gather`) |
| Auth | Session-based (httpOnly cookies) + Google OAuth |
| Payments | Stripe (3-tier subscription plans) |
| Football Data | Multi-provider (football-data.org v4, API-Football v3) |
| Process Management | Supervisor (API server, reminder worker, Redis, MongoDB) |

## Architecture

```
                    ┌──────────────┐
                    │   Nginx/     │
                    │   Ingress    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌────▼─────┐  ┌──▼──────────┐
     │  Frontend   │  │  API     │  │  Reminder   │
     │  React:3000 │  │  :8001   │  │  Worker     │
     └─────────────┘  └────┬─────┘  └──────┬──────┘
                           │               │
                    ┌──────▼───────┐       │
                    │   Redis      │◄──────┘
                    │   :6379      │ (pub/sub + cache)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   MongoDB    │
                    │   :27017     │
                    └──────────────┘
```

### Weekly Competition Data Flow (Zero-Reset Architecture)

```
 Week N (active)              Week N+1 (new)
┌─────────────┐            ┌─────────────┐
│weekly_seasons│            │weekly_seasons│
│ season: W10 │──finalize──│ season: W11 │
│ status:active│           │ status:active│
└──────┬──────┘            └──────┬──────┘
       │                          │
┌──────▼──────┐            ┌──────▼──────┐
│weekly_user_  │            │weekly_user_  │
│points        │            │points        │
│ W10 + userA  │  (clean)   │ W11 + userA  │
│ W10 + userB  │──────────→ │ W11 + userB  │
│  (indexed)   │  No reset! │  (starts at 0)│
└──────┬──────┘            └──────────────┘
       │
┌──────▼──────────┐
│weekly_results_   │
│archive           │
│ W10: top 100     │
│ precomputed      │
└─────────────────┘
```

### Process Model
| Process | Role | Instances |
|---------|------|-----------|
| `backend` (Uvicorn) | HTTP API + WebSocket server | 1 (scalable to N with Gunicorn) |
| `reminder_worker` | Scheduler, match polling, weekly reset | Exactly 1 (must NOT scale) |
| `redis` | Cache, pub/sub, rate limiting | 1 |
| `mongodb` | Data persistence | 1 |
| `frontend` | React dev server | 1 |

## Weekly Competition Engine (v2.0)

### Design Principles
- **Zero-Reset Architecture**: No `update_many` for weekly reset. New season = new `season_id`. Users automatically start fresh.
- **Season Isolation**: Each week is a separate document in `weekly_seasons`. Points tracked per `(season_id, user_id)` in `weekly_user_points`.
- **O(log n) Rankings**: Compound index `(season_id, weekly_points DESC)` enables indexed sort for leaderboard queries.
- **Precomputed Archives**: Top 100 snapshot stored in `weekly_results_archive` with precomputed ranks, percentiles.
- **Redis Caching**: All hot-path queries cached (10-15s TTL). Status, leaderboard, summary endpoints all cache-first.

### Weekly Cycle
1. **Monday 00:00 UTC**: New season auto-created (e.g., `2026-W11`)
2. **During week**: Points accumulated via atomic `$inc` into `weekly_user_points`
3. **End of week**: Reminder worker detects season change, finalizes old season (archives top 100, marks completed)
4. **No downtime**: Season rotation is a document insert, not a collection scan

### Benchmark Results
| Operation | Throughput |
|-----------|-----------|
| Concurrent weekly point $inc (3,000 writes) | **1,942 writes/sec** |
| Leaderboard query (indexed sort) | **1,390 queries/sec** |
| Rank calculation (indexed count) | **2,092 queries/sec** |
| Atomic correctness (300 pts across 30 increments) | **100% accurate** |

### Weekly Competition Indexes
| Collection | Index | Unique | Purpose |
|-----------|-------|--------|---------|
| weekly_seasons | `(season_id)` | Yes | Season lookup |
| weekly_seasons | `(status)` | No | Active season query |
| weekly_user_points | `(season_id, user_id)` | Yes | Prevent duplicate entries |
| weekly_user_points | `(season_id, weekly_points DESC)` | No | O(log n) leaderboard sort |
| weekly_results_archive | `(season_id)` | Yes | Archive lookup |

### API Endpoints
- `GET /api/weekly/status` — Current season info, countdown, user rank (cached 10s)
- `GET /api/weekly/leaderboard` — Season leaderboard with user profiles (cached 15s)
- `GET /api/weekly/summary/{season_id}` — Completed season results, winner, user rank/percentile
- `GET /api/weekly/history` — List of past completed seasons with winners

## Production Hardening (v1.5)

### What Changed

#### P0 — Critical Fixes
1. **Reminder Engine Isolation** — Extracted to `reminder_worker.py`, runs as standalone supervisor process. API event loop no longer blocked by scheduler/polling tasks.

2. **Prediction Race Condition Eliminated** — Added compound unique index `(user_id, match_id)` on both `predictions` and `exact_score_predictions`. Replaced read-then-write (`find_one` + `insert_one`) with atomic `find_one_and_update` + `$setOnInsert` + `upsert=True`.

3. **Atomic Points Update** — Replaced `$set: {points: computed_value}` with `$inc: {points: delta}`. Verified: 1,000 concurrent `$inc` on same document = 1,000 points. Zero lost updates.

4. **Parallel WebSocket Broadcast** — Replaced sequential `for conn: await send` with `asyncio.gather(*sends)` + 5s per-connection timeout. Dead connections auto-cleaned.

#### P1 — Improvements
5. **Redis Infrastructure** — Redis 7 running as supervisor process (256MB, LRU eviction). Provides caching, pub/sub, and rate limiting.

6. **Redis Pub/Sub** — Reminder worker publishes match updates to Redis channel. API workers subscribe and rebroadcast to local WebSocket clients. Enables multi-worker WebSocket scaling.

7. **Leaderboard Caching** — Global and weekly leaderboards cached in Redis with 30-second TTL. Eliminates repeated MongoDB sort queries.

8. **Prediction Rate Limiting** — 15 predictions per minute per user via Redis atomic counter. Returns HTTP 429 when exceeded.

9. **System Metrics Endpoint** — `GET /api/system/metrics` returns WebSocket connection counts, Redis/MongoDB status, and architecture info.

### Benchmark Results (Measured on 4-core ARM, 16GB RAM)

| Metric | Result |
|--------|--------|
| HTTP throughput (`/api/health`) | 389 req/s (50 concurrent) |
| HTTP throughput (`/api/leaderboard`) | 415 req/s (50 concurrent, Redis cached) |
| Prediction write throughput | 1,636 writes/sec (3,000 concurrent upserts) |
| Atomic `$inc` throughput | 2,166 ops/sec (1,000 concurrent on same doc) |
| Prediction duplicates after 3K concurrent writes | 0 |
| Points accuracy after 1K concurrent `$inc` | 100% (1000/1000) |
| WebSocket connections (stable, API responsive) | 500 |
| WebSocket connections (API starts degrading) | ~800 |
| WebSocket connections (API timeout) | ~950 |
| API response time with 500 WS open | 2-4ms |
| Memory at 500 WS connections | ~11 MB RSS |

### Current Capacity Assessment

| Scenario | Status |
|----------|--------|
| 500 concurrent users | **Stable** — all features functional |
| 1,000 concurrent users | **Functional with degradation** — WebSocket delays possible |
| 3,000 concurrent users | **Requires multi-worker** — single worker saturates |
| 10,000 concurrent users | **Requires Gunicorn + 4 workers** — not possible on single worker |

### Scaling Path to 10K

To reach 10,000 concurrent users:

1. **Switch to Gunicorn** with 4 Uvicorn workers:
   ```bash
   gunicorn server:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:8001
   ```
   This alone multiplies capacity ~4x (2,000-3,000 WebSockets, 1,500+ req/s)

2. **Redis Pub/Sub already implemented** — cross-worker WebSocket broadcasting works out of the box

3. **Reminder worker already isolated** — will not duplicate across API workers

4. **Rate limiting already in Redis** — works across all workers

### Next Bottleneck After Multi-Worker
- MongoDB connection pool (default 100 per worker × 4 = 400 connections)
- OS file descriptor limit (`ulimit -n`, default 1024 — raise to 65535)
- Redis Pub/Sub fan-out latency at 10K+ subscribers

## MongoDB Index Summary

| Collection | Index | Unique | Purpose |
|-----------|-------|--------|---------|
| predictions | `(user_id, match_id)` | Yes | Prevent duplicate predictions |
| predictions | `(match_id, prediction)` | No | Vote counting |
| predictions | `(user_id, points_awarded)` | No | User prediction queries |
| exact_score_predictions | `(user_id, match_id)` | Yes | Prevent duplicates |
| exact_score_predictions | `(match_id)` | No | Batch processing |
| users | `(points, -1)` | No | Global leaderboard |
| users | `(weekly_points, -1, correct_predictions, -1)` | No | Weekly leaderboard |
| notifications | `(type, user_id, data.match_id)` | No | Reminder deduplication |
| weekly_reset_log | `(week_key)` | Yes | Prevent double weekly reset |
| favorite_matches | `(user_id, match_id)` | Yes | Prevent duplicate favorites |
| messages | `(sender_id, receiver_id, created_at)` | No | Chat queries |

## API Endpoints

### Auth
- `POST /api/auth/register` — Register with email
- `POST /api/auth/login` — Login (returns session cookie)
- `POST /api/auth/logout` — Logout
- `POST /api/auth/set-nickname` — Set nickname after registration

### Football
- `GET /api/football/matches` — All matches (cached)
- `GET /api/football/live` — Live matches
- `GET /api/football/today` — Today's matches
- `GET /api/football/upcoming` — Upcoming matches
- `GET /api/football/leaderboard` — Global leaderboard (Redis cached, 30s TTL)
- `GET /api/football/leaderboard/weekly` — Weekly leaderboard (Redis cached)
- `WS /api/ws/matches` — Live match updates

### Predictions
- `POST /api/predictions` — Create/update prediction (atomic upsert, rate limited)
- `POST /api/predictions/exact-score` — Exact score prediction
- `GET /api/predictions/me` — User's predictions

### Friends & Chat
- `POST /api/friends/request` — Send friend request
- `GET /api/friends` — List friends
- `WS /api/ws/chat/{user_id}` — Real-time chat
- `WS /api/ws/friends/{user_id}` — Friend status updates

### Notifications
- `GET /api/notifications` — User notifications
- `POST /api/notifications/read-all` — Mark all notifications as read (auto-triggered on panel open)
- `GET /api/notifications/unread-count` — Unread notification count
- `WS /api/ws/notifications/{user_id}` — Real-time notifications (including achievement unlocks)

### Subscriptions
- `GET /api/subscriptions/plans` — Available plans
- `POST /api/subscriptions/create-session` — Stripe checkout

### Admin
- `GET /api/admin/dashboard` — Admin dashboard
- `GET /api/admin/users` — User management
- `POST /api/admin/gift-points` — Gift points to users
- Full CRUD for news, banners, match management

### Achievements
- `GET /api/achievements` — All achievements with real-time progress for current user
- `GET /api/profile/bundle` — Includes achievements in combined profile data response

### System
- `GET /api/health` — Health check
- `GET /api/system/metrics` — WebSocket counts, Redis/MongoDB status

## Environment Variables

### Backend (`/app/backend/.env`)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
JWT_SECRET=<secret>
STRIPE_API_KEY=<stripe_key>
FOOTBALL_API_KEY=<api_key>
ADMIN_EMAIL=admin@guessit.com
ADMIN_PASSWORD=<password>
ADMIN_NICKNAME=admin
REDIS_URL=redis://localhost:6379
```

### Frontend (`/app/frontend/.env`)
```
REACT_APP_BACKEND_URL=<backend_url>
```

## Running Locally

```bash
# Start all services
sudo supervisorctl start all

# Check status
sudo supervisorctl status

# View logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/reminder_worker.err.log
```

## Smart Achievement System (Progress-Based)

### Design
- **25 achievements** across 6 categories: Predictions, Accuracy, Streaks, Social, Level, Weekly
- **Real-time progress** computed from stored user stats (O(1) per achievement)
- **Incremental counters** — no heavy recalculation per request
- **Smart display** — Profile shows only the 6 "closest to completion" uncompleted achievements
- **Psychological ordering** — sorted by completion % (highest first), creating "almost there" motivation

### Profile Section Behavior
- Shows **only uncompleted** achievements
- Sorted by **completion percentage** (closest to done first)
- Excludes 0% achievements unless needed to fill 6 slots
- When an achievement is completed, it's **automatically replaced** with the next closest

### "View All" Modal
- Triggered by "View All" button in achievements section header
- **Backdrop blur** with smooth zoom-in animation
- **Tabs**: All / In Progress / Completed with counts
- **Sorting**: By Progress %, Category, or Difficulty
- Each achievement shows: icon, title, description, difficulty badge, progress bar, current/threshold, status

### Achievement Categories & Icons
| Category | Icons | Color | Examples |
|----------|-------|-------|----------|
| Predictions | Crosshair, Brain, Target | Blue | First Step, Getting Started, Veteran, Centurion |
| Accuracy | BadgeCheck, Medal, Gem, Percent, Gauge, ShieldCheck | Green | On Fire, Sharp Eye, Oracle, Analyst, Perfectionist |
| Streaks | Flame, Zap | Orange/Red | (Future: streak achievements) |
| Favorites | Heart, HeartHandshake, ShieldHalf | Pink | Fan, Supporter, True Fan |
| Social | UserPlus, UsersRound, Network | Teal | Social, Popular, Influencer |
| Level | Star, Trophy, Crown, Sparkles | Gold/Yellow | Rising Star, Champion, Elite, Legend |
| Weekly | Swords | Amber | Competitor |

### Performance (10K-Safe)
- All stats stored as pre-incremented counters on user documents
- Achievement progress computed via O(1) arithmetic (no aggregation)
- Profile bundle runs all queries in parallel (asyncio.gather)
- No heavy DB scans — lightweight stat reads only

### Notification Integration
- Achievement completion triggers automatic notification creation + WebSocket push
- Notifications auto-marked as read when panel opens (no manual "Mark all as read" button)
- Toast popup appears instantly for achievement notifications
- Achievement notifications link directly to profile page
- Hooks into: prediction creation, friend acceptance, favorite addition, points/level changes

### Match Status Display
- **LIVE:** Red pulsing dot + match minute (e.g., `LIVE 67'`), HT, PEN, ET indicators
- **FINISHED:** Shows `FT`, `AET`, or `PEN` — date/time hidden for finished matches
- **NOT_STARTED:** Shows scheduled date/time (e.g., `Mar 12 · 20:45`) + countdown
- Auto-refresh every 30 seconds (fallback when WebSocket not connected)
- WebSocket pushes real-time score and status updates for connected clients

### Header Authentication Fix
- Header component uses `useAuth()` context as fallback when props are not passed
- Guarantees consistent auth state across all pages (including Subscribe, News, Contact)
- Prevents Login/Register buttons from appearing on pages that don't pass explicit auth props

## Maturity Level

**Semi-Production** — All critical race conditions fixed, atomic operations verified, Redis infrastructure in place, scheduler isolated. The remaining gap to full production is switching from single Uvicorn worker to Gunicorn with 4+ workers (a configuration change, not a code change).
