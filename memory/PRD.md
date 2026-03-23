# GuessIt - Football Prediction Platform PRD

## Original Problem Statement
Clone the existing project from https://github.com/Farhad-Iskandarov/guess.it as an exact duplicate. No redesign, no changes to UI/layout/components/colors/structure. Preserve all pages, routes, logic, database schema, and integrations. Result must be 100% identical and fully editable.

## Architecture
- **Frontend**: React 19, Tailwind CSS 3, shadcn/ui (Radix), Recharts, CRACO
- **Backend**: FastAPI (Python 3.11), Uvicorn, Pydantic v2
- **Database**: MongoDB (Motor async driver)
- **Cache & Pub/Sub**: Redis 7 (leaderboard caching, WebSocket scaling, rate limiting)
- **Real-time**: WebSockets (asyncio, parallel broadcast)
- **Auth**: Session-based (httpOnly cookies) + Google OAuth
- **Payments**: Stripe (3-tier subscription plans)
- **Football Data**: Multi-provider (football-data.org v4, API-Football v3)
- **Process Management**: Supervisor (API server, reminder worker, Redis, MongoDB, frontend)

## User Personas
- Football fans who want to predict match outcomes
- Competitive users tracking leaderboards
- Premium subscribers for advanced features
- Admin managing content, users, and matches

## Core Requirements (Static)
- User registration/login with session-based auth
- Football match predictions (1/X/2 + exact score)
- Real-time leaderboards (global + weekly)
- Friends system with real-time chat
- Achievement system (25 achievements, 6 categories)
- Stripe subscription plans (3-tier)
- Admin dashboard for content management
- WebSocket live match updates
- Redis caching for hot-path queries

## What's Been Implemented
- **[2026-03-23]** Successfully cloned entire project from GitHub into Emergent workspace
  - All backend files: server.py, 12 route modules, 6 service modules, 5 model files, reminder_worker.py
  - All frontend files: App.js, 22 pages, 57 components (46 UI + 6 home + 3 layout + ErrorBoundary), hooks, services, utils, data
  - Frontend plugins: health-check + visual-edits for CRACO
  - Configured environment: MongoDB, Redis, Stripe test key, admin credentials seeded
  - All services running: backend (FastAPI), frontend (React/CRACO), MongoDB, Redis
  - Testing: Backend 100% (9/9), Frontend 100% (10/10 pages verified)

- **[2026-03-23]** Fixed match data visibility on main page
  - **Root cause**: Football API returned only FINISHED matches (no upcoming); frontend filtered all finished matches out → "No matches found"
  - **Backend fix**: Widened default date range from 1-day to 3-day lookback in `/api/football/matches` route (respecting football-data.org 10-day max)
  - **Frontend fix**: Modified `activeMatches` memo in HomePage.jsx to include all matches (finished shown with FT badges) instead of filtering them out
  - Result: 47 matches now visible on main page with correct team crests, scores, competition badges
  - League filtering works (Premier League: 9 matches, Serie A, La Liga, etc.)
  - Testing: Backend 100% (11/11), Frontend 100% (19/19)

## Prioritized Backlog
- **P0**: None (clone is complete, match data visible)
- **P1**: Configure Google OAuth credentials for social login
- **P2**: Set up custom domain and production deployment

## Next Tasks
- User to confirm match visibility fix is satisfactory
- Any further modifications requested by user
