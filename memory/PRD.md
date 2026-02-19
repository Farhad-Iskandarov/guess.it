# GuessIt — Football Prediction Platform (Clone)

## Original Problem Statement
Clone the existing GuessIt project from https://github.com/Farhad-Iskandarov/guess.it as an exact 100% identical duplicate. No redesign, no changes. Preserve all pages, routes, logic, database schema, and integrations.

## Architecture
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI, Radix UI, Lucide React, CRACO, React Router v7
- **Backend**: Python 3.11, FastAPI, Uvicorn, Motor (async MongoDB driver)
- **Database**: MongoDB (guessit)
- **Auth**: bcrypt, httpOnly session cookies, Emergent Google OAuth
- **External API**: Football-Data.org v4 (API key: configured in .env)
- **Real-Time**: WebSocket + polling fallback

## Core Requirements (Static)
1. Browse upcoming/live football matches from major leagues
2. Predict match outcomes (Home/Draw/Away)
3. Live score updates via WebSocket (30s polling)
4. User authentication (email/password + Google OAuth)
5. Points & Level system (10 levels, +10 correct, -5 wrong after Lv5)
6. Favorite clubs with heart toggle
7. Friends system with real-time WebSocket notifications
8. User profile & settings (avatar upload, nickname change, password change)
9. My Predictions page with filters, search, edit/remove
10. Dark/Light theme toggle

## What's Been Implemented (Clone completed 2026-02-19)
- Full project cloned from GitHub repository
- All backend routes: auth, football, predictions, favorites, friends, settings
- All frontend pages: Home, Login, Register, ChooseNickname, AuthCallback, MyPredictions, Profile, Settings, Friends
- All components: Header, Footer, PromoBanner, TabsSection, LeagueFilters, MatchList, MatchCard, etc.
- 46 Shadcn/UI components
- Football-Data.org API integration configured with API key
- MongoDB configured with DB_NAME=guessit
- WebSocket for live match updates and friend notifications

## Testing Results
- Backend: 100% (all API endpoints working)
- Frontend: 95% (all UI working, WebSocket through preview proxy uses fallback polling)
- Registration, Login, Football API, Predictions, Favorites, Friends, Settings — all verified

## User Personas
- Football fans who want to predict match outcomes
- Competitive users who track points/levels
- Social users who add friends and share predictions

## Prioritized Backlog
### P0 (Critical) — Done
- [x] Full project clone
- [x] Football API integration
- [x] Auth system
- [x] All pages and routes

### P1 (High)
- [ ] Leaderboard System
- [ ] Push Notifications
- [ ] Match Result Comparison (show correct/incorrect)

### P2 (Medium)
- [ ] Advanced Predictions (score prediction, first goal scorer)
- [ ] Newsletter System
- [ ] PWA Support
- [ ] Historical Statistics

## Next Tasks
- Awaiting user's specific change requests for the cloned project
