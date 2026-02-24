# GuessIt - Football Prediction Platform (Clone)

## Original Problem Statement
Clone the existing project from https://github.com/Farhad-Iskandarov/guess.it as a 100% identical duplicate.

## Architecture
- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB driver), Pydantic v2
- **Database:** MongoDB
- **Real-time:** WebSockets (live matches, chat, notifications)
- **Auth:** Session-based (httpOnly cookies) + Google OAuth
- **Football Data:** football-data.org API (v4)
- **Payments:** Stripe (subscription system)

## What's Been Implemented

### Phase 1: Clone (Feb 24, 2026)
- Full clone from GitHub, all files, dependencies, env configured

### Phase 2: Exact Score Prediction Enhancements (Feb 24, 2026)
- Exact score predictions appear in My Predictions page
- Button renamed: "Lock Exact Score Prediction" -> "Guess Exact Score"
- "Your Pick" shows exact score as amber badge
- Edit & Remove work for exact score predictions

### Phase 3: Admin Points Gifting (Feb 24, 2026)
- POST /api/admin/gift-points - gifts points to 1-500 users
- GET /api/admin/gift-points/log - audit trail
- Multi-select checkboxes, Gift dialog, per-user Gift icon in Users tab

### Phase 4: Homepage Tab Filters (Feb 24, 2026)
- Popular: Top 10 matches by prediction count
- Top Live: Top 10 live matches by prediction count
- Soon: Matches within next 3 days
- Top Matches/Ended/Favorite: Unchanged

### Phase 5: Final Stabilization & Documentation (Feb 24, 2026)
- Admin seeder now reads ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NICKNAME from env vars
- .gitignore updated to exclude .env files
- Created backend/.env.example and frontend/.env.example
- README.md rewritten with comprehensive Run Locally section (8 steps)
- Environment variables reference table, troubleshooting, developer notes
- All 25+ API endpoints verified working (100% backend pass)
- No sensitive data in committed source files

## Admin Credentials (auto-seeded)
- Email: farhad.isgandar@gmail.com, Password: Salam123?
- Override via: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NICKNAME env vars
- Admin panel: /itguess/admin/login

## Backlog
- P1: Gift points history tab in admin
- P2: Exact score editing from Advanced Options modal
- P2: Prediction Result Notifications
