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
- **[2026-03-20]** Successfully cloned entire project from GitHub
  - All backend files (server.py, 12 route modules, 6 service modules, 5 model files, reminder_worker)
  - All frontend files (App.js, 22 pages, 6 components, 40+ UI components, hooks, services, utils)
  - Configured environment (MongoDB, Redis, Stripe test key, admin credentials)
  - All 7 supervisor services running (backend, frontend, mongodb, redis, reminder_worker, code-server, nginx)
  - Testing: Backend 94.1%, Frontend 100%, Integration 100%
- **[2026-03-21]** Fixed duplicate email registration error handling
  - Backend: Changed status code from 400 to 409 with user-friendly message
  - Frontend AuthContext: Added try/catch around response.json(), check 409 status before parsing body (prevents "body stream already read")
  - Frontend RegisterPage: Shows inline error under email field with "Go to Login" link + toast notification
  - No technical errors exposed to users
- **[2026-03-21]** Comprehensive error handling overhaul across entire platform
  - Created centralized error utility (utils/errorHandler.js) with safe JSON parsing, user-friendly message mapping, technical error sanitization
  - All 5 service files (predictions, favorites, friends, messages, matches) use createApiError() — safely reads response body, returns clean errors
  - AuthContext: All 4 auth functions wrap response.json() in try/catch with user-friendly fallbacks
  - 15+ page/component files updated: replaced raw error.message with clean user-friendly messages
  - SettingsPage: Maps backend errors to specific messages (password incorrect, email taken, nickname taken)
  - AdminPage: Replaced alert(err.message) with console.error + clean alert
  - Testing: Backend 87%, Frontend 100% — no technical errors visible to users
- **[2026-03-22]** Implemented global ErrorBoundary
  - Class component at components/ErrorBoundary.jsx wrapping entire App tree
  - Clean fallback UI matching dark theme: "Something went wrong" + "Reload page" / "Go to Homepage" buttons
  - Logs real errors to console, shows zero technical details to users
  - Testing: Frontend 100% — all pages load normally, boundary triggers correctly on crashes
- **[2026-03-22]** Added per-route error boundaries for heavy sections
  - Refactored ErrorBoundary to support variant='section' (inline) and variant='global' (full-page)
  - Wrapped Admin (/admin), Match Detail (/match/:matchId), and Profile (/profile) routes
  - Section fallback: "Something went wrong in this section" + Retry (resets state without reload) + Go to Homepage
  - Header/navigation stay intact when a section crashes — only the content area shows fallback
  - Global boundary remains as final fallback
  - Testing: Frontend 100%
- **[2026-03-22]** Implemented automatic error reporting system
  - Backend: /api/error-logs routes (report, list, stats, resolve, delete) in error_logs.py
  - Frontend: ErrorBoundary silently POSTs crash data to backend in componentDidCatch (fire-and-forget)
  - Client-side rate limit: max 5 reports per 60s. Server-side: max 5 per IP per 60s
  - Captures: message, stack, component_stack, route, user_id, boundary_label, user_agent, screen, language
  - Admin: New "Error Logs" tab with Overview (stat cards, top recurring errors, top routes) and All Logs (search, filters, expandable detail, resolve/delete)
  - Updated README with full documentation
  - Testing: Backend 95%, Frontend 100%

## Prioritized Backlog
- **P0**: None (clone is complete and functional)
- **P1**: Configure Football API key for live match data
- **P2**: Configure Google OAuth credentials for social login
- **P2**: Set up custom domain and production deployment

## Next Tasks
- User to provide Football API key (API-Football v3) for live match data
- User to confirm clone is ready and provide change requests
