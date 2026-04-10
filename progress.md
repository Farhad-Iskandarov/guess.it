# Progress Log - GuessIt Platform

All changes, bug fixes, and context for future development sessions.

---

## Session 1 - Project Clone & Setup (2026-04-09)

### What was done
- Cloned the entire project from `https://github.com/Farhad-Iskandarov/guess.it` (main branch)
- Copied all backend files: `server.py`, `models/`, `routes/`, `services/`, `uploads/`, `reminder_worker.py`
- Copied all frontend files: `src/`, `public/`, `plugins/`, config files (`craco.config.js`, `tailwind.config.js`, etc.)
- Installed Python dependencies from `requirements.txt` (125+ packages including FastAPI, Motor, Stripe, etc.)
- Installed Node dependencies via `yarn install` (React 19, Radix UI, Tailwind, etc.)
- Configured backend `.env` with MongoDB, Redis, admin credentials, API placeholders
- Admin account auto-seeded on startup (`farhad.isgandar@gmail.com` / `Salam123?`)
- Subscription plans auto-seeded
- Weekly season auto-created
- MongoDB indexes created on startup

### Testing results
- Backend: 93.3% pass rate (14/15 tests)
- Frontend: 100%
- Integration: 100%

---

## Session 2 - Bug Fixes & Feature Additions (2026-04-10)

### Bug Fix 1: Predictions Page Error

**Symptom**: Opening `/my-predictions` showed "Something went wrong. Could not load predictions. Please try again."

**Root cause**: `KeyError: 'votes'` in `/app/backend/routes/predictions.py` at line ~519. When building match data for exact-score-only predictions, the code accessed `match_data["votes"]` and `match_data["totalVotes"]` directly. But match data from the persistent cache sometimes lacks these fields.

**Fix**: Changed direct dict access to `.get()` with defaults:
```python
# Before (broken)
"votes": match_data["votes"],
"totalVotes": match_data["totalVotes"],

# After (fixed)
"votes": match_data.get("votes", {}),
"totalVotes": match_data.get("totalVotes", 0),
```
Applied the same `.get()` pattern to ALL fields in that block (`homeTeam`, `awayTeam`, `competition`, `dateTime`, `status`, `score`, `predictionLocked`, `lockReason`).

**File changed**: `/app/backend/routes/predictions.py` (~line 510-530)

---

### Feature 1: Match Card Click Navigation

**Request**: Clicking on a match card (except the predict button and bell icon) should navigate to the match detail page.

**Implementation**:
- Added `useNavigate` and `onNavigateMatch` prop to `MatchRow` in `MatchList.jsx`
- Added `onClick` handler to the card container div
- Used `e.target.closest('button, a, input, ...')` to exclude interactive elements from triggering navigation
- Navigation target: `/match/${match.id}`

**File changed**: `/app/frontend/src/components/home/MatchList.jsx`

---

### Feature 2: Display-Only Prediction Bars

**Request**: The vote buttons (1/X/2) under team names were changing color when clicked. User wanted this disabled.

**Implementation**:
- Changed `PredictionBars` from interactive `<button>` elements to static `<div>` elements
- Removed `onClick`, `disabled` props
- Added `cursor-default select-none` classes
- Kept visual highlighting for the most-picked option (display only)

**File changed**: `/app/frontend/src/components/home/MatchList.jsx` (PredictionBars component)

**Note**: The homepage uses `MatchList.jsx` for match cards, NOT `MatchCard.jsx`. Initially we edited `MatchCard.jsx` by mistake (it's used elsewhere). The homepage match list is rendered by `MatchList.jsx` → `MatchRow` component.

---

### Feature 3: Quick Prediction Shortcuts

**Request**: After clicking "Predict Match", add shortcut buttons for Home Win (1), Draw (X), Away Win (2).

**Implementation**:
- Added `QuickPrediction` component (also added to `MatchCard.jsx` for consistency)
- Added "Quick Predict" as the FIRST tab in `AdvancedOptionsModal` (before Exact Score, Smart Advice, Invite Friend, Friends Activity)
- Three large buttons showing: `1` (home team name), `X` (Draw), `2` (away team name)
- Clicking saves the prediction immediately and closes the modal
- Shows "Your current pick" indicator if already predicted
- Renamed the expand button from "Advanced" to "Predict Match"

**Files changed**:
- `/app/frontend/src/components/home/MatchList.jsx` (AdvancedOptionsModal, sections array)
- `/app/frontend/src/components/home/MatchCard.jsx` (QuickPrediction component)

---

### Bug Fix 2: Slow Page Load on Navigation

**Symptom**: Navigating to another page (e.g., Profile, Leaderboard) and returning to the homepage caused a long delay before match cards appeared. No loading animation during the wait.

**Root cause**: Two issues in `/app/frontend/src/pages/HomePage.jsx`:
1. `initialFetchDone` ref was initialized as `false` on every component remount, causing the loading skeleton to show even when cached data was available
2. The skeleton condition `(isLoadingMatches || !initialFetchDone.current)` showed the skeleton regardless of whether matches were already in state from cache

**Fix**:
```javascript
// Before
const initialFetchDone = useRef(false);
// Skeleton showed when: isLoadingMatches || !initialFetchDone.current

// After
const hasCachedData = !!(getStaleCachedMatches('all')?.matches?.length > 0);
const initialFetchDone = useRef(hasCachedData);
// Skeleton shows when: isLoadingMatches && matches.length === 0
```

**Result**: Matches now render instantly from cache (~0.9s including network overhead). Background refresh runs silently.

**File changed**: `/app/frontend/src/pages/HomePage.jsx` (~lines 99-110, ~line 731)

---

### UI Improvement: Match Card Styling

**Request**: Cards looked "bad and messy" - too much spacing, oversized elements.

**Changes applied** (all in `MatchList.jsx`):

| Element | Before | After |
|---------|--------|-------|
| Card padding | `p-4 sm:p-5` | `px-4 py-3 sm:px-5 sm:py-3.5` |
| Internal spacing | `space-y-4` | `space-y-2.5` |
| Top row border | `pb-3 border-b border-border/40` | `pb-2 border-b border-border/30` |
| Top row text | `text-sm` | `text-xs` |
| Time text | `font-semibold text-foreground` | `font-semibold text-foreground text-sm` |
| Team row padding | `py-1` | `py-0.5` |
| Team name size | `text-sm sm:text-base` | `text-sm` |
| Team crest size | `w-10 h-10 sm:w-12 sm:h-12` | `w-8 h-8 sm:w-10 sm:h-10` |
| VS text | `text-base sm:text-lg tracking-widest` | `text-sm tracking-wider` |
| Score text | `text-xl sm:text-2xl` | `text-xl` |
| Predict button | `py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base` | `py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm` |
| Prediction bars gap | `gap-3 sm:gap-4` | `gap-2 sm:gap-3` |
| Bar height | `h-1.5` | `h-1` |
| Bar label text | `text-xs sm:text-sm` | `text-[11px] sm:text-xs` |
| League header padding | `py-3` | `py-2` |
| League logo size | `w-10 h-10 sm:w-12 sm:h-12` | `w-8 h-8 sm:w-10 sm:h-10` |
| League name | `text-base sm:text-lg` | `text-sm sm:text-base` |
| Card list gap | `space-y-3` | `space-y-2.5` |
| League groups gap | `space-y-6` | `space-y-5` |
| Match list container | no max-width | `max-w-3xl mx-auto` |

---

## Important Architecture Notes (for future sessions)

### Homepage match rendering
- `HomePage.jsx` renders `MatchList` component
- `MatchList.jsx` contains: `MatchRow` (individual cards), `PredictionBars`, `PredictMatchButton`, `LeagueHeader`, `AdvancedOptionsModal`, `BellNotification`, `TeamCrest`, `StatusBadge`
- `MatchCard.jsx` is a SEPARATE component used in other contexts (not on homepage)

### Data flow for matches
1. `matches.js` service has in-memory cache (`cache = {}`)
2. `fetchMatches()` stores data with key `matches_${searchParams}`
3. `getStaleCachedMatches('all')` returns cached data even if TTL expired
4. HomePage initializes state from stale cache on mount
5. Background API call refreshes data without blocking UI

### Authentication flow
- Session-based auth via HTTP-only cookies (`session_token`)
- `AuthContext.js` manages auth state, calls `/api/auth/me` on mount
- Protected routes use `<ProtectedRoute>` wrapper in `App.js`
- Admin routes use role-based check

### WebSocket architecture
- 4 WebSocket endpoints in `server.py`: matches, friends, chat, notifications
- Each uses `ConnectionManager` class for broadcast
- Redis pub/sub planned for multi-worker sync (currently local fallback)

### Database collections (MongoDB)
- `users` - User accounts, profiles, achievements
- `sessions` - Active sessions (session_token → user_id)
- `predictions` - Match predictions (home/draw/away + exact scores)
- `exact_score_predictions` - Dedicated exact score predictions
- `friend_requests` / `friendships` - Social graph
- `messages` / `conversations` - Chat system
- `notifications` - User notifications
- `weekly_seasons` / `weekly_entries` - Weekly leaderboard seasons
- `football_persistent_cache` - Cached match data from API
- `subscription_plans` / `user_subscriptions` - Stripe subscriptions
- `match_votes` - Aggregated vote counts per match
- `favorite_teams` / `favorite_matches` - User favorites
- `error_logs` - Frontend error reports

### Common pitfalls
1. **MongoDB ObjectId serialization**: Always use `.get()` with defaults when building response dicts from MongoDB documents. Fields like `_id`, `created_by` contain `ObjectId` which is not JSON serializable.
2. **Persistent cache missing fields**: Match data from `football_persistent_cache` may lack fields like `votes`, `totalVotes`. Always use `.get()` with defaults.
3. **Redis not available**: The app gracefully falls back to local mode. `redis_pubsub.py` handles connection failures silently.
4. **bcrypt warning**: `passlib` shows `AttributeError: module 'bcrypt' has no attribute '__about__'`. This is cosmetic - authentication works fine.
5. **Component confusion**: `MatchCard.jsx` vs `MatchList.jsx` - the homepage uses `MatchList.jsx`. Check where the component is actually used before editing.

---

## What's NOT configured yet

| Item | What's needed | Where to configure |
|------|--------------|-------------------|
| Football API | API key from [football-data.org](https://www.football-data.org/) | `FOOTBALL_API_KEY` in `/app/backend/.env` |
| Stripe | Stripe API key | `STRIPE_API_KEY` in `/app/backend/.env` |
| Redis | Redis server | Already configured to `localhost:6379`, just needs a running Redis instance |
| Google OAuth | Google OAuth credentials | Needs setup in auth routes |

---

## Quick Commands

```bash
# Check service status
sudo supervisorctl status

# Restart after .env or dependency changes
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# View backend errors
tail -n 50 /var/log/supervisor/backend.err.log

# View frontend errors
tail -n 50 /var/log/supervisor/frontend.err.log

# Test backend health
curl https://guess-it-staging-2.preview.emergentagent.com/api/health

# Test login
curl -X POST https://guess-it-staging-2.preview.emergentagent.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"farhad.isgandar@gmail.com","password":"Salam123?"}'
```

---

## Files Modified (from original clone)

| File | Change Type | Description |
|------|------------|-------------|
| `backend/routes/predictions.py` | Bug fix | `.get()` defaults for match data fields (~line 510-530) |
| `frontend/src/pages/HomePage.jsx` | Performance fix | Cache-aware `initialFetchDone`, smarter skeleton condition |
| `frontend/src/components/home/MatchList.jsx` | Feature + UI | Display-only PredictionBars, card click navigation, Quick Predict tab, compact styling |
| `frontend/src/components/home/MatchCard.jsx` | Feature | Added QuickPrediction component, display-only VoteButton, card click navigation, Trophy import |
| `backend/.env` | Config | Added REDIS_URL, FOOTBALL_API_KEY, ADMIN_*, STRIPE_API_KEY |
