# GuessIt - Football Prediction App PRD

## Original Problem Statement
Create a full copy (duplicate) of the existing project from https://github.com/Farhad-Iskandarov/guess.it and open it for editing. No redesign, no UI changes, no framework/library swaps. 100% identical clone.

## Architecture
- **Frontend**: React 19 with Craco, Tailwind CSS, Radix UI, React Router v7
- **Backend**: FastAPI (Python 3.11) with Motor (async MongoDB), Redis pub/sub (fallback to local mode)
- **Database**: MongoDB (local, test_database)
- **External APIs**: football-data.org v4, Stripe
- **Real-time**: WebSockets (live matches, chat, friends, notifications)

## What's Been Implemented

### Session 1: Clone Setup (2026-04-09)
- Complete project cloned from GitHub (main branch)
- All backend/frontend files copied and configured
- Admin account seeded, subscription plans seeded, weekly season created

### Session 2: Bug Fixes & Features (2026-04-10)
- **Bug Fix**: Predictions page KeyError 'votes' (predictions.py)
- **Bug Fix**: Slow page load on navigation back (HomePage.jsx cache logic)
- **Feature**: Match card click → navigates to match detail page
- **Feature**: Display-only prediction bars (no click interaction)
- **Feature**: Quick Predict tab in PREDICT MATCH modal (Home/Draw/Away)
- **UI**: Compact match card styling (padding, spacing, sizes)

### Session 2: Documentation (2026-04-10)
- Updated README.md with full project documentation
- Created progress.md with detailed change log and architecture notes

## Prioritized Backlog
- P1: Configure FOOTBALL_API_KEY for live match data
- P1: Configure STRIPE_API_KEY for subscription payments
- P2: Set up Redis for cross-worker pub/sub
- P2: Google OAuth configuration

## Next Tasks
- Awaiting user instructions for further modifications
- See `/app/progress.md` for detailed change log and architecture context
