# GuessIt - Football Prediction Platform

## Original Problem Statement
1. Clone project from https://github.com/Farhad-Iskandarov/guess.it
2. Production Hardening Phase v1.5 — scalability for 10K users
3. Leaderboard UI redesign — premium competitive sports interface
4. Weekly Competition Engine v2.0 — season-based, zero-reset architecture

## Architecture
- Frontend: React 19, CRACO, Tailwind CSS 3, shadcn/ui, Recharts
- Backend: FastAPI (Python 3.11), Uvicorn, Pydantic v2
- Database: MongoDB (compound unique indexes, season-based isolation)
- Cache & Pub/Sub: Redis 7 (leaderboard caching, WebSocket scaling, rate limiting)
- Real-time: WebSockets (parallel broadcast)
- Weekly Engine: Season-based with precomputed archives, zero-reset

## Implementation History

### Phase 1: Clone [2026-03-03]
- Full project clone from GitHub

### Phase 2: Production Hardening v1.5 [2026-03-03]
- P0: Reminder worker extraction, prediction race fix, atomic $inc, parallel WS broadcast
- P1: Redis infrastructure, leaderboard caching, rate limiting, metrics endpoint

### Phase 3: Leaderboard UI Redesign [2026-03-03]
- Centered 3-column podium (2nd|1st|3rd), gold/silver/bronze, premium sports design

### Phase 4: Weekly Competition Engine v2.0 [2026-03-03]
- **weekly_seasons** collection: One doc per ISO week (2026-W10), auto-created
- **weekly_user_points** collection: Per (season_id, user_id), atomic $inc, indexed sort
- **weekly_results_archive**: Top 100 precomputed snapshot per completed season
- **Zero-Reset**: New season = new season_id, no mass update_many
- **Season rotation**: Handled by reminder_worker background process
- **Frontend**: Live countdown (dd:hh:mm:ss), last week's winner highlight, season info banner
- **Caching**: /weekly/status cached 10s, /weekly/leaderboard cached 15s, /weekly/summary cached 60s
- **Benchmarks**: 1,942 writes/sec, 1,390 leaderboard queries/sec, 2,092 rank queries/sec

### Testing [2026-03-03]
- 100% backend + frontend pass rate across all iterations
- Atomicity verified: 3,000 concurrent writes, zero duplicates, zero lost updates

## Prioritized Backlog
### P0 (Next)
- [ ] Gunicorn multi-worker deployment
- [ ] OS file descriptor tuning (ulimit -n 65535)

### P1
- [ ] Auto football API failover
- [ ] Notification retry queue
- [ ] Prediction lock countdown timer (engagement driver)

### P2
- [ ] MongoDB replica set
- [ ] Redis Sentinel for HA
- [ ] APM monitoring dashboard
- [ ] Weekly competition email/push summary notifications
