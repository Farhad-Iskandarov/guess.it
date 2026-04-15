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


## Session 3 - Mobile Bottom Nav & Live Match Time (2026-04-10)

### Feature 1: Mobile Bottom Navigation Bar
- Created `MobileBottomNav.jsx` component with 5 tabs: Home, Leaderboard, Message, Saved, Profile
- Fixed at bottom of screen, full width, mobile-only (hidden on md+ breakpoints)
- Dark theme: #0a0a0a background, white active tab, zinc-500 inactive tabs
- Light theme: white background, zinc-900 active tab, zinc-400 inactive tabs
- Thin outlined icons (lucide-react: Home, Trophy, Send, Bookmark, User)
- Active tab detection based on current route
- Hidden on auth pages (login, register, choose-nickname, admin)
- Bottom padding added to main content (pb-16 md:pb-0) to prevent content overlap
- Safe area support for iPhone notch (env(safe-area-inset-bottom))
- Unauthenticated users clicking Message/Saved/Profile are redirected to login

### Feature 2: Live Match Minute Display
- Enhanced MatchCard to show exact match minute (45', HT, 90+3') between team rows for live matches
- Improved status badge to properly handle HT (Half Time) display
- Both MatchCard (desktop) and MatchList (mobile) already had minute support in status badges

### Files Changed
- `frontend/src/components/layout/MobileBottomNav.jsx` (new)
- `frontend/src/App.js` (import + render MobileBottomNav, bottom padding)
- `frontend/src/index.css` (safe-area-bottom CSS)
- `frontend/src/components/home/MatchCard.jsx` (live minute between teams, HT handling)
- `README.md` (updated features section)
- `progress.md` (this entry)

---

## Session 4 - UX Fixes: Scroll, Live Votes, Bell Toast, Branding (2026-04-10)

### Fix 1: Scroll Reset on Tab Switch
- Added `ScrollToTop` component in `App.js` that resets `window.scrollTo(0, 0)` on every route change
- Also added `window.scrollTo(0, 0)` in `MobileBottomNav.handleNav` for immediate effect
- Each tab now behaves like a fresh page load — no cached scroll positions

### Fix 2: Live Progress Bar Updates
- Modified `handlePredictionSaved` in `HomePage.jsx` to optimistically update match vote counts/percentages
- After a prediction, the prediction bars (1/X/2 percentages) update immediately without page refresh
- When a vote is added/changed/removed, the old vote count is decremented and new vote incremented
- Percentages are recalculated in real-time with rounding correction

### Fix 3: Bell Icon Toast Removed
- Removed `toast.success('Match bookmarked')` and `toast.success('Bookmark removed')` from `handleToggleFavoriteMatch` in `HomePage.jsx`
- Also removed `toast.error` for bookmark failures — silently logs to console instead
- Bell icon click now toggles bookmark state visually without any bottom notification

### Fix 4: "Made with Emergent" Branding
- This is an Emergent platform feature in the preview environment
- Users should contact support@emergent.sh with their job ID to request removal

### Files Changed
- `frontend/src/App.js` (added ScrollToTop component)
- `frontend/src/components/layout/MobileBottomNav.jsx` (scroll reset on navigation)
- `frontend/src/pages/HomePage.jsx` (optimistic vote updates, removed bell toast)
- `README.md` (updated)
- `progress.md` (this entry)

---

## Session 5 - Match Card UI Improvements (2026-04-11)

### Fix 1: Full Club Names (No Truncation)
- Removed `truncate` CSS class from both home and away team name spans in `MatchRow`
- Added `break-words` class to allow natural multi-line wrapping for long names
- Examples: "OLYMPIQUE LYON" wraps to 2 lines, "STADE RENNAIS" wraps properly
- Reduced font size on mobile (`text-xs sm:text-sm`) to fit more text per line

### Fix 2: Card Spacing
- Increased gap between match cards from `space-y-2.5` (10px) to `space-y-6` (24px)
- Each card is now clearly separated with breathing room
- Container margin increased from `mt-1` to `mt-2`
- Card border opacity increased from `/50` to `/70` for clearer visual distinction

### Fix 3: Internal Card Readability
- Increased vertical padding from `py-3` to `py-4` (mobile)
- Increased internal spacing from `space-y-2.5` to `space-y-3`
- Teams row vertical padding increased from `py-0.5` to `py-1`
- Added `data-testid` to home/away team names for testing

### Files Changed
- `frontend/src/components/home/MatchList.jsx` (MatchRow team names, spacing, padding)
- `README.md` (updated)
- `progress.md` (this entry)

---

## Session 5 - Global Club Name Truncation Fix (2026-04-13)

### Problem
Club names were truncated with "..." (ellipsis) in several pages: My Predictions, Saved Matches, Match Detail, Messages, Admin Panel, Top Matches Carousel, and Header search results. The main match cards on the homepage had already been fixed in Session 4, but the fix was not applied globally.

### Fix Applied
Replaced all `truncate` CSS classes on team/club name `<span>` and `<label>` elements with `line-clamp-2 break-words leading-tight` across 8 frontend files. This allows long club names (e.g., "OLYMPIQUE LYON", "BORUSSIA DORTMUND") to wrap naturally to a maximum of 2 lines without ellipsis.

### Files Changed (18 total edits across 8 files)
- `frontend/src/pages/MyPredictionsPage.jsx` — 4 team name elements (compact + grid views + exact score labels)
- `frontend/src/pages/MatchDetailPage.jsx` — 5 elements (main header names, exact score labels, standings table)
- `frontend/src/pages/MessagesPage.jsx` — 6 elements (chat match cards, exact score inputs, match share items)
- `frontend/src/pages/AdminPage.jsx` — 4 elements (prediction rows, match management rows)
- `frontend/src/components/home/TopMatchesCards.jsx` — 1 element (TeamDisplay component)
- `frontend/src/components/home/MatchList.jsx` — 3 elements (advanced dialog title, exact score labels)
- `frontend/src/components/home/MatchCard.jsx` — 2 elements (exact score input labels)
- `frontend/src/components/layout/Header.jsx` — 2 elements (search result team names)

### Testing Results
- Frontend: 90% pass rate (all team name tests passed)
- Desktop (1920px) + Mobile (390px) verified via screenshots
- Low-priority notes: player scorer names and competition names still truncate in some spots (not club names, out of scope)

### Files Updated
- `README.md` (added new Recent Changes entry)
- `progress.md` (this entry + updated Files Modified table)

---

## Session 6 - Mobile Layout Restructuring for Club Names (2026-04-13)

### Problem
Even after Session 5's `line-clamp-2` fix, club names were still truncated on mobile (e.g., "FC St....", "Boru ssi...", "Baye r 0...") because the **container width** was too narrow. The prediction badge ("YOUR PICK"), score column, and action buttons all used `flex-shrink-0`, squeezing the team name container to ~30% of the card width on mobile.

### Root Cause
Layout issue, not CSS text issue. The `flex items-center gap-4` container put teams, score, and prediction badge all in one horizontal row. On 390px mobile screens, this left only ~100px for team names — even 2 lines wasn't enough to show "TSG 1899 Hoffenheim".

### Fix Applied
**Restructured card layouts with responsive breakpoints:**

1. **Grid view (MyPredictionsPage)**: Changed outer container from `flex items-center gap-4` to `flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4`. Teams + Score are in one row (teams get `flex-1`), YOUR PICK badge moves to its own row on mobile.
2. **List view (MyPredictionsPage)**: Same responsive stacking — status/meta, teams, and score+pick+actions each get their own row on mobile.
3. **Team name spans**: Changed from `line-clamp-2 break-words leading-tight` to just `break-words leading-tight` — no line clamping needed now since containers have enough width.
4. **SavedMatchesPage**: Added `break-words leading-tight` and `flex-shrink-0` on score for consistency.

### Testing Results
- Frontend: 100% pass rate
- Mobile (390px): All names fully visible — "FC St. Pauli 1910", "TSG 1899 Hoffenheim", "Borussia Dortmund", "Bayer 04 Leverkusen", etc.
- Desktop (1920px): Side-by-side layout preserved unchanged

### Files Changed
- `frontend/src/pages/MyPredictionsPage.jsx` (grid + list views restructured)
- `frontend/src/pages/SavedMatchesPage.jsx` (break-words + flex-shrink-0 added)
- `README.md` (updated)
- `progress.md` (this entry)

---

## Session 7 - Dynamic Points System (2026-04-13)

### What was done
Implemented a dynamic points system where prediction rewards are calculated based on vote distribution popularity, replacing fixed point values.

### Formula
`points = base_points * (1 - percentage/100) * 1.3`, clamped to [5, 50]
- Popular choices (>60% votes) → low points (e.g., 5 pts) + "👥 Popular Pick" label
- Rare choices (<20% votes) → high points (e.g., 50 pts) + "🔥 High Risk" label
- Balanced (20-60%) → medium points + "⚖️ Balanced" label
- 0 total votes → equal distribution fallback (33.3% each → 43 pts, Balanced)

### Backend Changes
1. `models/points_config.py`: Changed `correct_prediction` default from 10 → 50 (now means "base points")
2. `services/football_api.py`: `_enrich_with_votes()` now calculates `dynamicPoints` for each match with home/draw/away points + labels
3. `routes/predictions.py`: Added `calculate_dynamic_points()` helper. Points awarding for finished matches now uses dynamic formula instead of fixed `POINTS_CORRECT`
4. `routes/football.py`: Updated `get_match_by_id` to pass `base_points` to enrich function
5. DB: Updated `points_config.correct_prediction` to 50

### Frontend Changes
1. `MatchList.jsx`: `PredictionBars` component now shows dynamic points + risk labels under percentage bars. Quick Predict modal shows points and labels per option.
2. `AdminPage.jsx`: "Correct Prediction" → "Base Points (Dynamic)" with updated description

### Testing Results
- Backend: 100% (17/17 tests)
- Frontend: 100%
- Integration: 100%
- Admin panel: 100%

---

## Session 8 & 9 - Prediction UI Cleanup (2026-04-13)

### What was done
1. Removed all "pts" text from prediction bars and Quick Predict modal (UI-only, backend unchanged)
2. Added risk label icons+words inline — then removed per user X-edit request
3. Final state: clean percentages + progress bars only, no labels or pts text

### Files Changed
- `frontend/src/components/home/MatchList.jsx` — PredictionBars component: removed pts span, label icons+words inline with %. Quick Predict modal: removed pts span, label icons+words inline with team name.

---

## Session 10 - Header Auto-Hide & Scroll-to-Top Fix (2026-04-15)

### What was done
1. **Header auto-hide on mobile scroll**: Hides smoothly on scroll down, reappears on scroll up. Always visible at page top and on desktop (≥768px). Changed from `sticky` to `fixed` positioning + spacer div.
2. **Scroll-to-top button fix**: Now stays visible after user stops scrolling (Instagram/Twitter behavior). Only disappears on scroll-down or when near page top. Added fade+slide animation. Mobile only (`md:hidden`).

### Files Changed
- `frontend/src/components/layout/Header.jsx` — Added scroll-direction state + useEffect, changed to `fixed` positioning, added spacer div
- `frontend/src/pages/HomePage.jsx` — Rewrote ScrollToTopButton scroll logic, added CSS transitions for fade+slide

### Testing Results
- Desktop: 100% (header always visible)
- Mobile scroll-to-top: 100% (all behaviors correct)
- Mobile header: Working (hide/show/animation smooth)
- Header functionality: 100% (search, theme, menu, login all working)

---



## Files Modified (from original clone)

| File | Change Type | Description |
|------|------------|-------------|
| `backend/routes/predictions.py` | Bug fix + Feature | `.get()` defaults, dynamic points calculation & awarding |
| `frontend/src/pages/HomePage.jsx` | Performance fix | Cache-aware `initialFetchDone`, smarter skeleton condition |
| `frontend/src/components/home/MatchList.jsx` | Feature + UI | PredictionBars with dynamic pts/labels, Quick Predict with pts, club name wrapping |
| `frontend/src/components/home/MatchCard.jsx` | Feature | QuickPrediction, VoteButton, card click nav, live match minute, club name fix |
| `frontend/src/components/layout/MobileBottomNav.jsx` | New component | Mobile-only bottom navigation bar |
| `frontend/src/App.js` | Integration | MobileBottomNav import and render |
| `frontend/src/index.css` | Styling | Safe-area-bottom CSS for iPhone notch |
| `backend/.env` | Config | REDIS_URL, FOOTBALL_API_KEY, ADMIN_*, STRIPE_API_KEY |
| `frontend/src/pages/MyPredictionsPage.jsx` | UI fix + Layout | Responsive layout, club name wrapping |
| `frontend/src/pages/MatchDetailPage.jsx` | UI fix | Club name wrapping (5 occurrences) |
| `frontend/src/pages/MessagesPage.jsx` | UI fix | Club name wrapping (6 occurrences) |
| `frontend/src/pages/AdminPage.jsx` | UI fix + Feature | Club name wrapping + "Base Points (Dynamic)" rename |
| `frontend/src/components/home/TopMatchesCards.jsx` | UI fix | Club name wrapping |
| `frontend/src/components/layout/Header.jsx` | UI fix | Club name wrapping in search |
| `backend/models/points_config.py` | Feature | Default correct_prediction changed to 50 (base points) |
| `backend/services/football_api.py` | Feature | `_enrich_with_votes` calculates dynamicPoints per match |
| `backend/routes/football.py` | Feature | Passes base_points to enrich function |
