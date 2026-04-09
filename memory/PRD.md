# GuessIt - Football Prediction App PRD

## Original Problem Statement
Clone the exact project from https://github.com/Farhad-Iskandarov/guess.it and set it up as a fully running duplicate.

## Architecture
- **Frontend**: React 19 with Craco, Tailwind CSS, Radix UI, React Router v7
- **Backend**: FastAPI (Python) with Motor (async MongoDB), Redis pub/sub
- **Database**: MongoDB (local), Redis for caching/pub/sub
- **External APIs**: football-data.org v4, Stripe

## What's Been Implemented

### Phase 1: Full Clone (2026-03-23)
- Complete project clone + environment setup

### Phase 2: Search & Match Data Fixes (2026-03-26)
- Backend search expanded (team + competition names, full dataset)
- WebSocket reconnect with data refresh, improved polling

### Phase 3: Banner Section (2026-04-09)
- Portrait image-card carousel (3:4, snap scroll, no auto-slide)

### Phase 4-5: Match Card Redesign (2026-04-09)
- Top Row: Date | Time | Countdown + bell icon
- Teams Row: Large crests + bold uppercase names + VS center
- 3 prediction bars side-by-side with green labels
- PREDICT MATCH button → opens Advanced Options modal

### Phase 6: League Grouping & Cleanup (2026-04-09)
**Matches grouped by league:**
- League Headers: [Logo] League Name / Country Name + ">" arrow
- Matches organized under their respective league section
- Leagues with live matches sorted first

**Removed:**
- All filter tabs (Top Matches, Popular, Top Live, Soon, Ended, Favorite)
- All league filter pills (All Matches, Live, UCL, etc.)
- View toggle (grid/list)

**Changed:**
- Bookmark icon → Bell notification icon on match cards
- Backend: Added competitionCountry field from football-data.org area data
- Frontend: Static COMPETITION_COUNTRIES fallback mapping
- README.md updated
- Testing: 100% pass rate (15 tests)

## Prioritized Backlog
- P0: None
- P1: Awaiting user instructions
- P2: League detail page (when tapping > on league header)

## Next Tasks
- Awaiting user instructions
