# GuessIt - Football Prediction Platform

## Original Problem Statement
1. Clone from https://github.com/Farhad-Iskandarov/guess.it
2. API Health Monitor upgrade
3. Fix Recent Activity on Profile Page
4. Fix Profile statistics and add filter navigation
5. Performance fix for MyPredictions + GuessIt Button Timer

## Architecture
- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB), Pydantic v2
- **Database:** MongoDB (guessit)
- **Real-time:** WebSockets
- **Auth:** Session-based (httpOnly cookies) + Google OAuth
- **Football Data:** Multi-provider (football-data.org v4 + API-Football v3)
- **Payments:** Stripe

## What's Been Implemented

### Session 1 - Clone
- [x] Exact clone of repo from GitHub

### Session 2 - API Health Monitor
- [x] 6 new admin endpoints for logs, stats, settings, cleanup
- [x] SystemTab with 4 sub-tabs

### Session 3 - Recent Activity Fix
- [x] Fixed `if _db_ref:` bug, added persistent match cache

### Session 4 - Statistics & Filter Navigation
- [x] Correct/wrong/pending computed from match results
- [x] ?filter= navigation from Profile to MyPredictions

### Session 5 - Performance + Timer (Mar 2, 2026)
- [x] MyPredictions: 3-tier match resolution (MongoDB cache → API cache → parallel lookup)
- [x] Response time: 30ms (from potentially seconds with serial API calls)
- [x] GuessIt Button: 4-phase countdown timer (>24h: none, 24-6h: label, 6-1h: countdown, <1h: urgency)
- [x] Hover slide animation (timer → GUESS IT) with cubic-bezier easing
- [x] Urgency CSS: green→red gradient, pulse animation, micro-shake under 10min
- [x] Testing: Backend 100%, Frontend 95%

## Environment
- Admin: admin@guessit.com / Admin123!
- Test user: test@guessit.com / Test123!
- DB: guessit on localhost:27017

## Prioritized Backlog
### P0
- Football API key for production data
### P1
- Google OAuth credentials
### P2
- Feature enhancements per user requests
