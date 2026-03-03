# GuessIt - Football Prediction Platform

## Original Problem Statement
1. Clone project from https://github.com/Farhad-Iskandarov/guess.it
2. Production Hardening Phase v1.5 — scalability upgrades for 10K users
3. Leaderboard UI redesign — premium competitive sports ranking interface

## Architecture
- Frontend: React 19, CRACO, Tailwind CSS 3, shadcn/ui, Recharts
- Backend: FastAPI (Python 3.11), Uvicorn, Pydantic v2
- Database: MongoDB (compound unique indexes)
- Cache & Pub/Sub: Redis 7
- Real-time: WebSockets (parallel broadcast)
- Auth: Session-based (httpOnly cookies) + Google OAuth
- Payments: Stripe
- Background Worker: Standalone reminder_worker.py

## Implementation History

### Phase 1: Clone [2026-03-03]
- Full project clone from GitHub, all files preserved

### Phase 2: Production Hardening v1.5 [2026-03-03]
- P0: Reminder worker extraction, prediction race fix (unique index + upsert), atomic $inc, parallel WS broadcast
- P1: Redis infrastructure, leaderboard caching, rate limiting, metrics endpoint
- Benchmarked: 1,636 writes/sec, 0 duplicates, 100% atomic accuracy

### Phase 3: Leaderboard UI Redesign [2026-03-03]
- Centered 3-column podium (2nd|1st|3rd) with gold/silver/bronze hierarchy
- 1st place: crown icon, largest avatar, gold glow, dominant visual
- Max-width 1000px container, card background with shadow
- Improved table: stronger header, row hover effects, formatted numbers, color-coded accuracy
- Current user highlighting with "(You)" label
- Empty slot placeholders when < 3 users
- Responsive: works on 390px mobile through 1920px desktop
- Entrance animations with staggered delays
- NO logic changes — design only

## Prioritized Backlog
### P0 (Next)
- [ ] Gunicorn multi-worker deployment
- [ ] OS file descriptor tuning

### P1
- [ ] Auto football API failover
- [ ] Notification retry queue
- [ ] Prediction lock countdown timer

### P2
- [ ] MongoDB replica set
- [ ] Redis Sentinel
- [ ] APM dashboard
