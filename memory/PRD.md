# GuessIt - Football Prediction Platform

## Architecture
- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB), Pydantic v2
- **Database:** MongoDB (DB: guessit)
- **Real-time:** WebSockets | **Payments:** Stripe | **Auth:** Session-based + Google OAuth

## What's Been Implemented

### Session 1: Project Clone
- Full clone from GitHub, dependencies installed, admin seeded

### Session 2: Loading UX
- Skeleton loading, AbortController, stale-while-revalidate caching

### Session 3: Local Timezone
- `formatLocalDateTime()` utility, 8 components updated

### Session 4: Behavioral Notifications
- Reminder engine (pre-kickoff, favorite club matchday, favorite club urgency)

### Session 5: Match Card UX Overhaul
- Removed GuessIt/Remove buttons, tap-to-toggle 1/X/2, countdown in meta bar, bolder Advance

### Session 6: Leaderboard System
- **Backend**: New `GET /api/football/leaderboard/weekly` endpoint, `weekly_points` field tracking, weekly reset job (Monday 00:00 UTC with archive), DB indexes
- **Frontend**: Complete LeaderboardPage rewrite with Weekly/Global tabs, podium top-3 cards, ranking list, skeleton loading, empty states, current user highlight
- **Points system**: When points are awarded, both `points` (global) and `weekly_points` (weekly) increment simultaneously
- **README updated**

## Prioritized Backlog
### P0 — None
### P1 — Configure Football API key, Stripe key, Google OAuth
### P2 — Monthly leaderboard, Regional leaderboard, Weekly rewards, Browser Push Notifications
