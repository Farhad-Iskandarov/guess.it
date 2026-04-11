# GuessIt - Football Prediction App PRD

## Original Problem Statement
Clone the existing project from https://github.com/Farhad-Iskandarov/guess.it as a 100% identical copy, then implement incremental improvements.

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React (CRA + Craco) on port 3000
- **Database**: MongoDB (motor async driver)
- **Real-time**: WebSockets
- **Styling**: Tailwind CSS + shadcn/ui

## What's Been Implemented
### Session 1 - Clone (2026-04-10)
- Exact clone from GitHub

### Session 2 - Quick Predict Modal Fix (2026-04-10)
- Modal stays open after prediction, mobile layout fixed

### Session 3 - Mobile Bottom Nav + Live Time (2026-04-10)
- 5-tab bottom nav, live match minute display

### Session 4 - UX Fixes (2026-04-10)
- Scroll reset, live vote bars, bell toast removed

### Session 5 - Match Card UI (2026-04-11)
- Full club names (no truncation, natural wrapping)
- Better card spacing (10px → 16px gaps)
- Improved internal padding and readability
- 100% test pass rate

## Prioritized Backlog
- P1: Configure FOOTBALL_API_KEY
- P2: Configure Stripe, Google OAuth
