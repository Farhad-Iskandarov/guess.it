# GuessIt - Football Prediction Platform (Clone)

## Original Problem Statement
Clone the existing project from https://github.com/Farhad-Iskandarov/guess.it as a 100% identical duplicate.

## Architecture
- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB driver), Pydantic v2
- **Database:** MongoDB
- **Real-time:** WebSockets (live matches, chat, notifications)

## What's Been Implemented

### Phase 1: Clone (Feb 24, 2026)
- Full clone from GitHub

### Phase 2: Exact Score Prediction Enhancements (Feb 24, 2026)
- Exact score in My Predictions, edit/remove, "Guess Exact Score" button

### Phase 3: Admin Points Gifting (Feb 24, 2026)
- Gift points to users, audit trail, real-time notifications

### Phase 4: Homepage Tab Filters (Feb 24, 2026)
- Popular (top 10 by votes), Top Live, Soon (3 days), Ended, Favorite

### Phase 5: Stabilization & Documentation (Feb 24, 2026)
- .env.example files, comprehensive README, .gitignore updates

### Phase 6: Level System Fix & Performance (Feb 25, 2026)
**Level System Bug Fix:**
1. admin.py gift-points: After $inc points, recalculates level using calculate_level()
2. auth.py /me: Always recalculates level from current points; fixes desync on page refresh
3. Both prediction processing AND gifting now properly update levels

**Performance Optimizations:**
1. MongoDB: Added compound indexes on predictions (match_id+prediction), exact_score_predictions (user_id+match_id, match_id), points_gifts (created_at)
2. HomePage.jsx: Removed filterKey increment from tab switching (prevented full MatchList re-mount)
3. HomePage.jsx: Ended matches cached (fetched once, not on every tab switch)
4. MatchList.jsx: Added useMemo for displayMatches, liveMatches, nonLiveMatches
5. README updated with performance and level system docs

**Results:**
- Backend matches endpoint: 0.08s response time
- Frontend homepage load: 2.01s
- Tab switching: 0.54s average (was slow before)
- Level system: 100% sync accuracy

## Admin Credentials
- Email: farhad.isgandar@gmail.com, Password: Salam123?

## Backlog
- P1: Gift points history tab
- P2: Exact score editing from Advanced Options modal
