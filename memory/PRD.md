# GuessIt - Football Prediction Platform

## Original Problem Statement
Clone the GitHub repository https://github.com/Farhad-Iskandarov/guess.it exactly as-is into a fully editable and runnable environment. Then implement 6 feature updates without breaking existing functionality.

## Architecture
- **Frontend:** React 19 + CRACO + Tailwind CSS 3 + shadcn/ui (Radix) + Recharts
- **Backend:** FastAPI (Python 3.11) + Motor (async MongoDB) + Pydantic v2
- **Database:** MongoDB (DB: guessit)
- **Real-time:** WebSockets (live matches, chat, notifications)
- **Auth:** Session-based (httpOnly cookies) + Google OAuth
- **Football Data:** Multi-provider (football-data.org v4 + API-Football v3)
- **Payments:** Stripe (subscription system)

## What's Been Implemented
- [2026-02-27] Full repository clone from GitHub
- [2026-02-27] Environment setup (MongoDB, JWT, Stripe test key, admin credentials)
- [2026-02-27] Mobile UI fixes: search dropdown, notification dropdown, profile menu
- [2026-02-27] Scroll to Top button on Main Page
- [2026-02-27] **Saved Matches Feature**: New page at /saved-matches, added to profile dropdown, shows bookmarked match cards
- [2026-02-27] **Friend Prediction Notifications**: Real-time WS notifications when friends create new predictions
- [2026-02-27] **Favorite Teams scroll fix**: Max 280px height with overflow scroll (compact view ~5 teams)
- [2026-02-27] **My Leaderboard section**: Full-width friends ranking in Profile page with rank badges
- [2026-02-27] **Leaderboard rank notifications**: Friends leaderboard rank change notifications + Global top 100 rank change notifications
- [2026-02-27] **Profile performance optimization**: Single `/api/profile/bundle` endpoint (parallel DB+API queries), error state UI with retry, 1.15s load time
- [2026-02-27] **Profile sections fixed**: Recent Activity enriched with match data (team names, scores), Favorites fixed (wrong collection name), both sections fully functional

## Admin Credentials
- Email: admin@guessit.com
- Password: Admin123!

## New API Endpoints
- `GET /api/friends/leaderboard` — Friends-only leaderboard with rank tracking
- `GET /api/football/leaderboard/check-rank` — Global rank check (top 100 notifications)
- `GET /api/favorites/matches` — Saved/bookmarked matches

## Core Features
- User registration/login (email + Google OAuth)
- Match predictions with points system (friend prediction notifications)
- Exact score predictions
- Global leaderboard (top 100 rank notifications)
- Friends system with friends leaderboard
- Real-time messaging/chat
- In-app real-time notifications (WebSocket)
- User profiles with avatar/banner
- Saved Matches page
- Favorite matches/teams (compact scroll)
- My Leaderboard (friends ranking)
- Dark/Light theme toggle
- Admin panel (14 tabs)
- Stripe subscriptions
- News/Blog, Contact form, Newsletter

## Prioritized Backlog
- P0: Configure real Football API key for live match data
- P1: Configure Google OAuth credentials
- P2: Configure production Stripe keys
- P3: Add prediction streak tracking
- P4: Add swipe-to-dismiss gestures on mobile dropdowns
