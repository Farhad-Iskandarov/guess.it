# GuessIt - Football Prediction App (Cloned Project)

## Original Problem Statement
Create a full copy (duplicate) of existing project from GitHub: https://github.com/Farhad-Iskandarov/guess.it  
Rules: No redesign, no UI/layout/component/color/structure changes. Preserve all pages, routes, logic, database schema, and integrations. Result must be 100% identical clone.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui (Radix) + react-router-dom v7
- **Backend**: FastAPI (Python) with motor (async MongoDB driver)
- **Database**: MongoDB
- **Build Tool**: CRACO (Create React App Configuration Override)

## Core Features (from original project)
- Football match prediction platform
- User auth (register/login/JWT)
- Admin panel with match management
- Live match polling from Football API
- Subscription plans (Stripe integration)
- Leaderboards and user profiles
- Friends system with messaging
- News & banner management
- Favorites & notification system
- Dark/Light theme toggle
- Guest profiles

## What's Been Implemented (2026-02-25)
- [x] Exact clone of GitHub repo to /app environment
- [x] All backend dependencies installed (FastAPI, motor, bcrypt, stripe, etc.)
- [x] All frontend dependencies installed (React 19, Radix UI, recharts, etc.)
- [x] Backend running on port 8001 with MongoDB connection
- [x] Frontend compiled and serving on port 3000
- [x] Admin account seeded (farhad.isgandar@gmail.com)
- [x] Subscription plans seeded
- [x] All pages and routes preserved
- [x] Testing passed: 100% backend, 100% frontend

### Bug Fix: Football API Activation (2026-02-25)
- [x] Fixed: API activation failing because base_url stored without protocol (e.g. `football-data.org` instead of `https://api.football-data.org/v4`)
- [x] Added `_normalize_base_url()` in `football_api.py` — auto-corrects any football-data.org URL to correct v4 API endpoint
- [x] Added URL normalization in `admin.py` `add_api` route for future API additions
- [x] Fixed existing DB record to correct base_url
- [x] API now ACTIVE, 120 total matches loaded, 67 matches displayed on homepage
- [x] Testing passed: 100% backend, 100% frontend

### Invite Friend Match Card Consistency Fix (2026-02-25)
- [x] MatchList.jsx now sends full match_card data (crests, competition, real status, score) when inviting via Advance → Invite Friend
- [x] Backend friends.py accepts optional match_card field and uses it for chat message (falls back to minimal data for backward compat)
- [x] Both invite paths (chat + button and Main Page Advance Invite) now produce identical-looking cards in chat
- [x] Testing passed: all core functionality verified

### Chat Match Card UI/UX Fix (2026-02-25)
- [x] Softened expanded match card background from harsh `#1a242d/90` to `bg-secondary/60` 
- [x] Increased button spacing: vote buttons gap 1.5→2.5, action buttons gap 1.5→2.5, py 2→2.5
- [x] Increased expanded section vertical spacing: space-y 2.5→3.5, padding 3→3.5
- [x] Testing passed: 100% UI improvements verified
- [x] Saved FOOTBALL_API_KEY and FOOTBALL_API_BASE_URL in backend/.env for persistence across restarts
- [x] Updated seed function in server.py to use env-based base_url with football-data.org normalization
- [x] Changed homepage default tab from "Popular" to "Top Matches"
- [x] Testing passed: 100% both fixes verified

## Prioritized Backlog
- P0: User provides FOOTBALL_API_KEY and STRIPE_API_KEY for full functionality
- P1: Any feature additions or modifications requested by user
- P2: Performance optimizations, additional testing

## User Personas
- Football fans who predict match outcomes
- Admin who manages matches, news, banners
- Premium subscribers with enhanced features
