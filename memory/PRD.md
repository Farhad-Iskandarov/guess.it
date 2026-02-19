# GuessIt - Football Prediction Platform (Duplicate)

## Original Problem Statement
Create a full copy (duplicate) of the existing GuessIt project from https://github.com/Farhad-Iskandarov/guess.it and set it up for editing.

## Architecture
- **Frontend**: React 19 + Tailwind CSS 3.4 + Shadcn/UI + Radix UI + Lucide React
- **Build Tool**: CRACO (Create React App Configuration Override)
- **Backend**: FastAPI (Python) + Motor (async MongoDB driver)
- **Database**: MongoDB (DB: guessit)
- **Auth**: Email/password (bcrypt) + Google OAuth (Emergent Auth) + httpOnly session cookies
- **Football Data**: Football-Data.org v4 API (free tier, key: configured)
- **Real-Time**: WebSocket with 30s polling + 60s fallback

## What's Been Implemented
- [2026-02-19] Full project clone from GitHub — 100% identical copy
- [2026-02-19] Environment configured: FOOTBALL_API_KEY, MONGO_URL, DB_NAME=guessit
- [2026-02-19] Removed TopMatchesCards section from HomePage (user request)
- [2026-02-19] Bug Fix: My Predictions "Match data unavailable" — fixed with individual match ID lookups
- [2026-02-19] Refresh → Remove on main page: Changed button text/icon, deletes prediction from DB
- [2026-02-19] Predictions page: Added search input for filtering by club name
- [2026-02-19] Predictions page: Fixed Header bug — now shows user menu when authenticated
- [2026-02-19] Predictions page: Added "vs" between home and away team names
- [2026-02-19] Predictions page: Added Edit/Submit and Remove for upcoming matches only
  - Edit opens inline vote selector (1/X/2) with Submit/Cancel
  - Submit calls savePrediction API and updates local state
  - Remove calls deletePrediction API and removes card from list
  - Summary cards update dynamically
  - Finished/Live match cards have NO edit/remove (read-only)

## Testing Results
- Iteration 1: 92% (initial clone)
- Iteration 2: 96% (match data bug fix)
- Iteration 3: 95% (Remove btn, search, header, vs)
- Iteration 4: 98% (Edit/Submit/Remove on predictions page)

## Prioritized Backlog
### P0 (Done)
- Exact clone, TopMatchesCards removed, match data bug fixed
- Remove button, search, header fix, vs text
- Edit/Submit/Remove for upcoming predictions

### P1 (Future)
- Leaderboard system, user profiles, match result comparison

### P2 (Future)
- Push notifications, friend system, advanced predictions
