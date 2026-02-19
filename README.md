<div align="center">

# GuessIt — Football Prediction Platform

**Predict match outcomes. Compete with fans. Track your accuracy.**

A real-time football prediction platform powered by live data from [Football-Data.org](https://www.football-data.org/), built with React, FastAPI, and MongoDB.

</div>

---

> **IMPORTANT — READ BEFORE CLONING / DEPLOYING**
>
> This project requires a **Football-Data.org API key** to display matches, scores, and live data. Without this key, the app will show **"No matches found"** on the main page.
>
> **Setup after cloning:**
> 1. Get a free API token at [https://www.football-data.org/client/register](https://www.football-data.org/client/register)
> 2. Add it to `/app/backend/.env`:
>    ```
>    FOOTBALL_API_KEY="your_api_token_here"
>    ```
> 3. Restart the backend: `sudo supervisorctl restart backend`
>
> The API uses the `X-Auth-Token` HTTP header internally. Free tier allows **10 requests/minute** and includes: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, World Cup, and European Championship.
>
> **Without this key, you will NOT see any matches, scores, live data, or predictions.**

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [APIs & Integrations](#apis--integrations)
- [Project Structure](#project-structure)
- [Database Models](#database-models)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Default Ports & Connections](#default-ports--connections)
- [Core Flows](#core-flows)
- [Real-Time Architecture](#real-time-architecture)
- [Production Notes](#production-notes)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Project Overview

**GuessIt** is a modern, real-time football prediction web application where users can:

- Browse upcoming and live football matches from major leagues
- Predict match outcomes (Home Win / Draw / Away Win) before kick-off
- Watch live scores update in real-time without page refreshes
- Compete with other fans through a voting system
- Experience a premium, sport-tech styled interface with dark/light themes

The platform uses **Football-Data.org** as its free football data provider, supporting major competitions including the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League, and more.

Predictions are automatically locked **10 minutes before kick-off**, and fully disabled once a match goes live, ensuring fair play.

---

## Key Features

### Match Data & Live Scores
- Real match data from Football-Data.org (free tier)
- Live score updates via WebSocket (30-second polling)
- Match status tracking: NOT_STARTED, LIVE (with estimated minute), FINISHED
- Team crests/logos loaded from API
- Competition filtering (Premier League, UCL, La Liga, Serie A, etc.)

### Prediction System
- Vote on match outcomes: **1** (Home) / **X** (Draw) / **2** (Away)
- Prediction locking: disabled 10 minutes before match start
- Fully locked for LIVE and FINISHED matches
- Visual lock indicators with reason messages
- Predictions persisted to MongoDB for authenticated users
- Pending predictions saved in sessionStorage for unauthenticated users (restored after login)

### User Interface
- Dark/Light theme toggle (persisted in localStorage)
- Grid/List view toggle for match cards (persisted in localStorage)
- Global search: type a team name to find matches instantly
- Debounced search (300ms) with compact dropdown results
- Click-to-navigate: search results scroll to the match card with a highlight animation
- Team numbering (1 = Home, 2 = Away) for clear prediction context
- Estimated match minute display for live matches
- Animated loading screen on initial app load
- Responsive design (mobile-first)

### Authentication
- Email/Password registration with validation
- Email/Password login
- Google OAuth (via Emergent Auth)
- Unique nickname system (required after registration)
- Session-based authentication (httpOnly cookies, 7-day expiry)
- Nickname availability checker with suggestions

### Favorite Clubs
- Heart icon toggle on team names in match cards
- "Favorite" tab shows only matches involving favorited teams
- Favorites stored per-user in MongoDB, persist across sessions
- Auth-gated: only visible to signed-in users
- Animated heart toggle with scale bounce effect

### Real-Time Updates
- WebSocket connection at `/api/ws/matches`
- Backend polls Football-Data.org every 30 seconds for live matches
- Score changes pushed to all connected clients
- Graceful reconnection (5-second retry)
- Fallback: 60-second polling when WebSocket is unavailable

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Tailwind CSS 3.4, Shadcn/UI, Radix UI, Lucide React |
| **Build Tool** | CRACO (Create React App Configuration Override) |
| **Routing** | React Router v7 |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Database** | MongoDB (via Motor async driver) |
| **Auth** | bcrypt (password hashing), httpOnly session cookies |
| **OAuth** | Emergent Auth (Google Sign-In) |
| **Football API** | Football-Data.org v4 (free tier) |
| **Real-Time** | WebSocket (native), Background polling |
| **Validation** | Pydantic v2 |
| **HTTP Client** | httpx (async) |

---

## APIs & Integrations

### Football-Data.org (v4)

- **Base URL**: `https://api.football-data.org/v4`
- **Auth**: `X-Auth-Token` header
- **Free Tier Limits**: 10 requests/minute
- **Supported Competitions** (free tier):

| Code | Competition |
|------|------------|
| `PL` | Premier League |
| `PD` | La Liga |
| `SA` | Serie A |
| `BL1` | Bundesliga |
| `FL1` | Ligue 1 |
| `CL` | UEFA Champions League |
| `EC` | European Championship |
| `WC` | FIFA World Cup |

- **Endpoints Used**:
  - `GET /v4/matches` — All matches with date/status filters
  - `GET /v4/competitions/{code}/matches` — Competition-specific matches

### Emergent Auth (Google OAuth)

- **Auth URL**: `https://auth.emergentagent.com/`
- **Session Exchange**: `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`
- **Flow**: Redirect → Google Sign-In → Session ID → Exchange for user data

---

## Project Structure

```
/app/
├── backend/
│   ├── .env                    # Backend environment variables
│   ├── server.py               # FastAPI main app, routes, WebSocket
│   ├── requirements.txt        # Python dependencies
│   ├── models/
│   │   ├── __init__.py
│   │   ├── auth.py             # User, Session, Login, Register models
│   │   └── prediction.py       # Prediction CRUD models
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py             # Auth routes (register, login, OAuth, nickname)
│   │   ├── predictions.py      # Prediction CRUD routes
│   │   ├── favorites.py        # Favorite clubs CRUD routes
│   │   └── football.py         # Football API proxy, WebSocket, polling
│   └── services/
│       ├── __init__.py
│       └── football_api.py     # Football-Data.org client, caching, transforms
│
├── frontend/
│   ├── .env                    # Frontend environment variables
│   ├── package.json            # Node.js dependencies
│   ├── tailwind.config.js      # Tailwind + custom theme
│   ├── craco.config.js         # Path aliases (@/)
│   ├── public/
│   │   └── index.html          # HTML template
│   └── src/
│       ├── index.js            # React entry point
│       ├── index.css           # Global styles + CSS variables (light/dark)
│       ├── App.js              # Root component, routing, loading screen
│       ├── App.css             # App-level styles
│       ├── lib/
│       │   ├── AuthContext.js   # Auth state, login/register/OAuth handlers
│       │   ├── ThemeContext.js  # Dark/light theme provider
│       │   └── utils.js        # cn() utility (clsx + tailwind-merge)
│       ├── hooks/
│       │   ├── useLiveMatches.js   # WebSocket hook for live updates
│       │   ├── useLocalStorage.js  # localStorage state hook
│       │   └── use-toast.js        # Toast notification hook
│       ├── services/
│       │   ├── matches.js      # Football API client (fetch, search)
│       │   ├── predictions.js  # Prediction API client (save, get, delete)
│       │   └── favorites.js    # Favorites API client (get, add, remove)
│       ├── data/
│       │   └── mockData.js     # Banner slides, static content
│       ├── pages/
│       │   ├── HomePage.jsx        # Main page with matches, filters, toggle
│       │   ├── LoginPage.jsx       # Email/password + Google login
│       │   ├── RegisterPage.jsx    # Registration form
│       │   ├── ChooseNicknamePage.jsx  # Nickname selection
│       │   └── AuthCallback.jsx    # Google OAuth callback handler
│       └── components/
│           ├── layout/
│           │   ├── Header.jsx   # Navbar with search, auth, theme toggle
│           │   └── Footer.jsx   # Site footer
│           ├── home/
│           │   ├── PromoBanner.jsx     # Hero carousel
│           │   ├── TabsSection.jsx     # Top Matches/Popular/Live/Soon tabs
│           │   ├── LeagueFilters.jsx   # Competition filter chips
│           │   ├── TopMatchesCards.jsx  # Featured match cards (top 2)
│           │   ├── MatchCard.jsx       # Individual match card
│           │   └── MatchList.jsx       # Full match list (grid/list view)
│           └── ui/              # 46 Shadcn/UI components
│               ├── button.jsx
│               ├── dialog.jsx
│               ├── avatar.jsx
│               ├── dropdown-menu.jsx
│               └── ... (and more)
│
├── tests/                       # Test directory
├── test_reports/                # Automated test results
└── README.md                    # This file
```

---

## Database Models

### Users Collection (`users`)

| Field | Type | Description |
|-------|------|------------|
| `user_id` | String | Unique identifier (`user_xxxxxxxxxxxx`) |
| `email` | String | User email (unique, case-insensitive) |
| `name` | String | Display name (from Google or manual) |
| `nickname` | String | Unique username (3-20 chars, alphanumeric + underscore) |
| `password_hash` | String | bcrypt hash (null for Google-only users) |
| `auth_provider` | String | `"email"` or `"google"` |
| `nickname_set` | Boolean | Whether user has chosen a nickname |
| `picture` | String | Profile picture URL |
| `created_at` | String (ISO) | Registration timestamp |
| `updated_at` | String (ISO) | Last update timestamp |

### Sessions Collection (`user_sessions`)

| Field | Type | Description |
|-------|------|------------|
| `session_id` | String | Unique session identifier |
| `user_id` | String | Reference to user |
| `session_token` | String | Auth token (stored in httpOnly cookie) |
| `expires_at` | String (ISO) | Expiry time (7 days from creation) |
| `created_at` | String (ISO) | Creation timestamp |

### Predictions Collection (`predictions`)

| Field | Type | Description |
|-------|------|------------|
| `prediction_id` | String | Unique identifier (`pred_xxxxxxxxxxxx`) |
| `user_id` | String | Reference to user |
| `match_id` | Integer | Football-Data.org match ID |
| `prediction` | String | `"home"`, `"draw"`, or `"away"` |
| `created_at` | String (ISO) | First prediction timestamp |
| `updated_at` | String (ISO) | Last update timestamp |

---

## Environment Variables

### Backend (`/backend/.env`)

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=guessit
CORS_ORIGINS=*
FOOTBALL_API_KEY=your_football_data_org_api_key
```

| Variable | Required | Description |
|----------|----------|------------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `CORS_ORIGINS` | Yes | Allowed CORS origins (comma-separated or `*`) |
| `FOOTBALL_API_KEY` | Yes | Football-Data.org API key ([get free key](https://www.football-data.org/client/register)) |

### Frontend (`/frontend/.env`)

```env
REACT_APP_BACKEND_URL=https://your-domain.com
```

| Variable | Required | Description |
|----------|----------|------------|
| `REACT_APP_BACKEND_URL` | Yes | Backend API base URL (used for all API calls) |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **Yarn** (for frontend)
- **Python** 3.11+ (for backend)
- **MongoDB** 6+ (local or Atlas)
- **Football-Data.org API key** (free, [register here](https://www.football-data.org/client/register))

### Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env and add your FOOTBALL_API_KEY

# 5. Start the server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The backend will be available at `http://localhost:8001`.

API docs available at `http://localhost:8001/docs` (Swagger UI).

### Frontend Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
yarn install

# 3. Configure environment
# Edit .env and set REACT_APP_BACKEND_URL=http://localhost:8001

# 4. Start development server
yarn start
```

The frontend will be available at `http://localhost:3000`.

---

## Default Ports & Connections

| Service | Port | URL |
|---------|------|-----|
| Frontend (React) | 3000 | `http://localhost:3000` |
| Backend (FastAPI) | 8001 | `http://localhost:8001` |
| MongoDB | 27017 | `mongodb://localhost:27017` |
| WebSocket | 8001 | `ws://localhost:8001/api/ws/matches` |

**Routing**: All backend API endpoints must be prefixed with `/api/` (e.g., `/api/auth/login`, `/api/football/matches`). The frontend uses `REACT_APP_BACKEND_URL` for all API calls.

---

## Core Flows

### Authentication Flow

```
User → Register (email/password) → Set Nickname → Home
User → Login (email/password) → Home
User → Google Sign-In → Emergent Auth → Callback → Set Nickname → Home
```

### Prediction Flow

```
1. User browses matches (fetched from Football-Data.org via backend proxy)
2. User selects 1 (Home), X (Draw), or 2 (Away)
3. User clicks "GUESS IT" → saved to MongoDB
4. If not logged in → Auth modal → Login → Prediction saved from sessionStorage
5. Predictions locked 10 minutes before kick-off
6. Predictions fully disabled for LIVE and FINISHED matches
```

### Live Update Flow

```
Frontend ← WebSocket ← Backend ← Football-Data.org
     ↑                     ↑
     |                     |--- Polls every 30 seconds
     |--- Receives push updates, applies to match cards
```

---

## Real-Time Architecture

```
┌─────────────────────┐
│  Football-Data.org  │
│    (External API)   │
└─────────┬───────────┘
          │ HTTP (10 req/min)
          ▼
┌─────────────────────┐
│   FastAPI Backend    │
│                     │
│  ┌───────────────┐  │
│  │  Cache Layer  │  │  ← In-memory, TTL-based
│  │  30s (live)   │  │    (30s for live, 120s others)
│  │  120s (other) │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ Background    │  │  ← Polls Football-Data.org every 30s
│  │ Polling Task  │  │    (only when clients connected)
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │  WebSocket    │  │  ← Broadcasts to all connected clients
│  │  Manager      │  │
│  └───────────────┘  │
└─────────┬───────────┘
          │ WebSocket / HTTP
          ▼
┌─────────────────────┐
│   React Frontend    │
│                     │
│  useLiveMatches()   │  ← WebSocket hook
│  Auto-reconnect     │  ← 5s retry on disconnect
│  60s polling        │  ← Fallback when WS unavailable
└─────────────────────┘
```

---

## Production Notes

### Security
- **API Key**: `FOOTBALL_API_KEY` is stored server-side only, never exposed to the frontend
- **Auth Cookies**: `httpOnly`, `Secure`, `SameSite=None` for cross-origin support
- **Password Hashing**: bcrypt with automatic salt
- **Session Tokens**: UUID-based, stored in MongoDB with 7-day expiry
- **CORS**: Configure `CORS_ORIGINS` to restrict allowed origins in production

### Rate Limiting
- Football-Data.org free tier: **10 requests/minute**
- Backend caching prevents exceeding limits (30s for live, 120s for others)
- Rate limiter with automatic wait-and-retry

### Environment Separation
- Use different MongoDB databases for dev/staging/production
- Set `CORS_ORIGINS` to specific domains in production (not `*`)
- Use environment-specific `.env` files

### Performance
- In-memory cache reduces API calls
- WebSocket updates only pushed when clients are connected
- Score animations use CSS transforms (GPU-accelerated, no layout shift)
- Debounced search (300ms) prevents API spam

---

## Future Improvements

- **Leaderboard System**: Track prediction accuracy, weekly/monthly rankings
- **User Profiles**: Prediction history, accuracy stats, badges
- **Match Result Comparison**: Show correct/incorrect after match ends
- **Push Notifications**: Alert users about goal events and prediction deadlines
- **Friend System**: Add friends, view their predictions, private leagues
- **Countdown Timer**: Show "Predictions close in X hours" for urgency
- **Advanced Predictions**: Score prediction, first goal scorer, etc.
- **Historical Statistics**: Past match data, head-to-head records
- **Newsletter System**: Weekly prediction summaries via email
- **PWA Support**: Installable app with offline capabilities
- **Sort & Filter**: Sort matches by popularity, kick-off time, live-first

---

## Football-Data.org API Token

Hi anonimman926,
thanks for registering for an API authentication token. Please modify your client to use a HTTP header named "X-Auth-Token" with the underneath personal token as value.

Your API token: 22713fd8769c4a6393cc424a32939dbe

In order to keep your account active and receive updates, please verify your e-mail address by clicking here.

It's perfectly okay not to do so, your account and all of it's data will then automatically get deleted within a certain amount of inactivity.

Follow the quickstart guide to get up and running quickly and dive further into implementation details using the Reference Documentation.

In case there are still open questions feel free to mail and ask me directly.

Best,
daniel

---

## Changelog

### 2026-02-18
- Added real Football-Data.org API key for live match data
- Fixed banner carousel layout shaking (fixed height, opacity transitions, no layout shift)
- Fixed Grid/List toggle performance (CSS-based switch, memoized components, instant transition)
- Banner height set to exactly 405px with text padding-left adjusted to 4.5rem
- Live match cards: larger scores, match minute above score, subtle glow animation, compact locked banner
- Score alignment: Fixed-width score block (80px) for consistent positioning across all card types (LIVE, FT, upcoming)

---

## License

This project is for educational and personal use.

Football data provided by [Football-Data.org](https://www.football-data.org/).

---

## Changelog (Post-Clone Updates)

### Bug Fixes
- **My Predictions — "Match data unavailable"**: Fixed `/api/predictions/me/detailed` endpoint. Root cause: `get_matches()` was called without date parameters, and Football-Data.org's 10-day max range limit caused empty results. Fix uses standard date range + individual `/matches/{id}` lookups for any missing matches.
- **Header authentication bug on Predictions page**: Predictions page now passes `user`, `isAuthenticated`, and `onLogout` props to `<Header />`. Previously it rendered `<Header />` without auth props, causing Login/Register to always show even when the user was logged in.

### UI Updates
- **Refresh → Remove button (Main Page)**: Renamed "Refresh" button to "Remove" with a `Trash2` icon on all match cards. The `handleRefresh` function already called `deletePrediction()` — now the UI correctly reflects its purpose (deleting the user's prediction from the database).
- **Removed TopMatchesCards section (Main Page)**: Removed the duplicated preview match cards above "All Matches" — the component and its import were removed from `HomePage.jsx`.
- **"vs" between team names (Predictions Page)**: Added italic "vs" text between home and away team rows in each prediction card for clearer match identification.

### New Features
- **Search on Predictions Page**: Added a search input at the top of the My Predictions page. Users can search by club name (home or away). Filtering is instant (no page reload), with a clear button and "No matches found" empty state when no results match.
- **Edit & Submit predictions (Predictions Page)**: For upcoming matches (`NOT_STARTED` status), an "Edit" button opens an inline vote selector (`1 Home` / `X Draw` / `2 Away`) with the current pick highlighted. Clicking "Submit" saves the updated prediction via API. "Cancel" exits without changes. Finished/live matches remain read-only.
- **Remove predictions (Predictions Page)**: For upcoming matches, a "Remove" button deletes the prediction from MongoDB and removes the card from the list instantly. Summary cards (Total, Pending) update dynamically.
- **Grid/List view toggle (Predictions Page)**: Added the same Grid/List toggle design from the main page. Grid view shows prediction cards in a responsive 2-column layout; List view shows a compact single-row layout. Preference is persisted in `localStorage`. Smooth transitions, no page reload, fully responsive, does not break existing filtering or search.

### New/Modified Components
- `MyPredictionsPage.jsx` — Major rewrite: added search, edit/remove, view toggle, authenticated header
- `MatchList.jsx` — `RefreshButton` renamed to `RemoveButton` with `Trash2` icon
- `HomePage.jsx` — Removed `TopMatchesCards` import and rendering

### Structural Changes
- Backend `routes/predictions.py` — Enhanced `/me/detailed` endpoint with wider date range + individual match fetching
- No new pages or routes added
- No framework or library changes

---

### 2026-02-19

#### Bug Fixes
- **Login error message**: Fixed login error that showed technical message "Failed to execute 'json' on 'Response': body stream already read." when credentials are wrong. Now shows clean user-friendly message: "Email or password is incorrect." (`AuthContext.js`, `LoginPage.jsx`)

#### Performance Improvements
- **Match data caching (Main Page)**: Implemented in-memory cache with 5-minute TTL in `matches.js` service. When navigating away from the main page and returning, matches load instantly from cache instead of showing "Loading matches..." every time. Live match data uses a shorter 30-second TTL. Stale cached data is shown immediately while fresh data loads in the background.
- **Optimistic UI for "Guess It" button**: The Guess It button now updates the UI immediately upon click (optimistic update) before the API call completes. If the API call fails, the change is reverted. This makes the prediction interaction feel instant and responsive. (`MatchList.jsx`)

#### New Features
- **Points section (My Predictions)**: Added a 5th summary card "Points" with a star icon (violet theme) to the stats section on the My Predictions page. Summary grid updated from 4 to 5 columns. Points value defaults to 0 — logic to be defined later.

#### UI Updates
- **League name at top of prediction cards**: Moved the competition/league name to the top of each prediction card on the My Predictions page (both grid and list views). Previously it was inline with status and date, causing layout issues with long names like "Campeonato Brasileiro Série A". Now displayed as a separate line at the top, truncated with ellipsis if too long.
- **Finished match result styling (My Predictions)**: Enhanced visual distinction for finished match predictions:
  - **Correct predictions**: Subtle green background (`bg-emerald-500/8%`), green border, and a 3px green left accent bar
  - **Wrong predictions**: Subtle red background (`bg-red-500/7%`), red border, and a 3px red left accent bar
  - Clean and modern — not aggressive, just clear visual feedback

#### Modified Files
- `frontend/src/lib/AuthContext.js` — Safe JSON parsing in loginEmail, user-friendly error messages
- `frontend/src/pages/LoginPage.jsx` — Cleaner error catch for login
- `frontend/src/services/matches.js` — In-memory cache layer with TTL-based expiry
- `frontend/src/pages/HomePage.jsx` — Stale-while-revalidate pattern for instant page loads
- `frontend/src/components/home/MatchList.jsx` — Optimistic UI update in handleGuessIt
- `frontend/src/pages/MyPredictionsPage.jsx` — Points summary card, league name at top, enhanced red/green styling for finished matches

---

### 2026-02-19 (Session 2)

#### New Features
- **Live Matches Section**: Added a dedicated "Live Matches" section above "All Matches" on the homepage. When there are IN_PLAY/LIVE matches, they appear in a separated section at the top with:
  - Animated pulsing red dot indicator
  - Match count badge (e.g., "Live Matches (2)")
  - Same card structure and layout as normal match cards
  - Live cards have the existing red glow/border styling (`live-match-card` CSS class)
  - Real-time score and minute updates via WebSocket
  - Section only appears when there are live matches; otherwise hidden
  - When user clicks "Live" filter, only the "All Matches" section changes to show filtered live matches (no duplication)

#### Performance Improvements
- **Prediction data caching (My Predictions page)**: Added in-memory cache to `predictions.js` service with 5-minute TTL for both `getMyPredictions()` and `getMyDetailedPredictions()`. Cache is automatically invalidated on save or delete operations. Navigating between Main Page and My Predictions page is now instant on subsequent visits.
  - **Caching strategy**: Simple in-memory JavaScript object with timestamp validation
  - **Cache duration**: 5 minutes for match data (30s for live), 5 minutes for predictions
  - **How it works**: First load fetches from API normally. Subsequent navigations within TTL return cached data instantly. Mutations (save/delete prediction) invalidate the cache so next fetch gets fresh data. Live match updates bypass cache and use WebSocket for real-time updates.

#### UI/Responsive Updates
- **Grid/List toggle hidden on mobile**: The view mode toggle (Grid/List) is now hidden on screens smaller than `md` (768px) on both the homepage and My Predictions page. Mobile users see a single optimized grid layout. Desktop users retain full toggle functionality with no changes.
  - Implementation: Uses Tailwind responsive utility `hidden md:flex` on the toggle container
  - No JavaScript device detection
  - No layout shifts or functional regression on desktop

#### Modified Files
- `frontend/src/components/home/MatchList.jsx` — Split matches into Live section + All Matches section; live matches filtered out of All Matches to avoid duplication
- `frontend/src/pages/HomePage.jsx` — View toggle uses `hidden md:flex` for mobile responsiveness
- `frontend/src/pages/MyPredictionsPage.jsx` — View toggle uses `hidden md:flex`; now uses cached `getMyDetailedPredictions()` instead of direct fetch
- `frontend/src/services/predictions.js` — Added in-memory cache with 5-min TTL and invalidation on mutations

---

### 2026-02-19 (Session 3)

#### New Features
- **Clickable summary card filters (My Predictions)**: The summary cards (Total, Correct, Wrong, Pending) are now clickable filter buttons. Clicking a card instantly filters predictions by result type:
  - **Total** → Shows all predictions (default active)
  - **Correct** → Shows only correctly predicted matches
  - **Wrong** → Shows only incorrectly predicted matches
  - **Pending** → Shows only predictions for matches not yet finished
  - **Filtering logic**: Uses a `summaryFilter` state that drives client-side filtering in a `useMemo` hook. Filters by `prediction.result` field (`correct`, `wrong`, `pending`). Works alongside the existing status filter (All/Live/Upcoming/Finished) — both filters compose together.
  - **State handling**: React `useState` + `useMemo` for derived filtered list. No API calls on filter switch. Data is already loaded in memory.
  - **No extra API calls**: Filtering is purely client-side using already-fetched prediction data.
  - Active card highlighted with green ring (`ring-2 ring-primary/30`) and primary border
  - Smooth fade-in animation on filter change (CSS `@keyframes fade-in`, applied via React `key` prop)
  - Works on both desktop and mobile with no layout shift

#### Performance Improvements
- **Instant navigation (My Predictions → Main Page)**: Fixed loading flash when navigating back to the Main Page. The `HomePage` component now initializes `matches` state and `isLoadingMatches` state directly from the in-memory cache (via `getStaleCachedMatches`) using lazy initializer functions in `useState`. This eliminates the brief "Loading matches..." spinner that appeared before the `useEffect` ran.

#### Modified Files
- `frontend/src/pages/MyPredictionsPage.jsx` — SummaryCard now clickable with `summaryFilter` state; `filtered` useMemo applies summary + status + search filters; fade animation on filter change
- `frontend/src/pages/HomePage.jsx` — `useState` lazy initializers read from match cache to prevent loading flash
- `frontend/src/index.css` — Added `.animate-fade-in` keyframe animation

---

### 2026-02-19 (Session 4)

#### UI Updates
- **Saved prediction card highlight**: Match cards on the homepage now show a subtle light green background (`bg-emerald-500/6%`) and green border (`border-emerald-500/25`) when the user has a saved prediction for that match. This provides clear visual feedback that a prediction was saved. Live match cards retain their red live styling (takes priority over the green saved state).

---

### 2026-02-19 (Session 5) — Points & Level System

#### New Features

**Points System:**
- Users earn **+10 points** for each correctly predicted match result
- Points are permanently stored in MongoDB (`users.points`, `users.level`)
- Points persist across page refreshes, logout/login, and server restarts
- Anti-duplicate protection: Each prediction has `points_awarded` flag — points calculated exactly once per finished match
- All points calculation happens server-side (no frontend manipulation possible)

**Level System:**
- Users start at Level 0, progressing to Level 10
- Level thresholds: Lv1=100, Lv2=120, Lv3=200, Lv4=330, Lv5=500, Lv6=580, Lv7=650, Lv8=780, Lv9=900, Lv10=1000
- Level calculated automatically from total points using `calculate_level()` function
- Level updates immediately when points change

**Point Deduction (After Level 5):**
- When user is at Level 5 or higher (500+ points), wrong predictions deduct **-5 points**
- If user drops below Level 5 threshold, deduction stops until they reach Level 5 again
- Points cannot go below 0

**Points UI:**
- Header: "Lv.X Xpts" badge displayed next to avatar (visible on desktop)
- User dropdown menu: Shows Level and Points with icons
- My Predictions page: Level and Points badges below page title
- Points summary card: Clickable filter showing only point-earning predictions
- Prediction cards: Shows "+10 pts" (green) or "-5 pts" (red) in card footer when points were awarded

#### Database Schema Changes
- `users` collection: Added `points` (int, default 0) and `level` (int, default 0) fields
- `predictions` collection: Added `points_awarded` (bool), `points_value` (int), `points_awarded_at` (ISO string) fields

#### Persistence Strategy
- Points stored in MongoDB `users` collection, not frontend state
- Points calculated server-side in `/api/predictions/me/detailed` endpoint
- `points_awarded` flag on each prediction prevents double reward
- Frontend reads points from API response, never writes points directly

#### Modified Files
- `backend/models/auth.py` — Added `points` and `level` fields to `UserResponse` model
- `backend/routes/auth.py` — `/api/auth/me` now returns `points` and `level`
- `backend/routes/predictions.py` — Added `LEVEL_THRESHOLDS`, `calculate_level()`, points processing in `/me/detailed`
- `frontend/src/components/layout/Header.jsx` — Level/Points badge in header and dropdown menu
- `frontend/src/pages/MyPredictionsPage.jsx` — Level/Points display, Points card clickable filter, per-prediction points display

---

### 2026-02-19 (Session 6) — Header Level Fix & Favorite Clubs

#### Header Level Display Fix

- **Renamed "Lv.0" to "Level 0"**: The level badge now displays the full text "Level 0" instead of the abbreviated "Lv.0"
- **Level dropdown popup**: Clicking the Level badge opens a clean dropdown showing:
  - Trophy icon (amber color)
  - "Level 0" text (bold)
  - "0 pts" with lightning bolt icon (green primary)
- **Layout fix**: Level badge is now properly inside the same container as the user avatar. Previously it was a separate block element; now it's inline with the avatar dropdown in `UserDropdownMenu`
- **Mobile responsive**: Removed `hidden sm:block` class — Level badge is now visible on all screen sizes (was previously hidden on mobile)
- **Smooth animation**: Added CSS-based open/close animation for the dropdown:
  - Open: scale(0.92→1) + fade-in with cubic-bezier easing (0.18s)
  - Close: scale(1→0.92) + fade-out (0.12s)
  - Transform origin: top-right (aligned with badge position)
- **Click-outside close**: Dropdown closes when clicking outside (proper `mousedown` event listener with cleanup)

**Modified files:**
- `frontend/src/components/layout/Header.jsx` — Rewrote `LevelPopover` component: removed `hidden sm:block`, added `useRef`+`useEffect` for click-outside, CSS-based animation classes
- `frontend/src/App.css` — Added `.level-popover-open`, `.level-popover-closed` animation classes

#### Favorite Clubs Feature

**New "Favorite" tab:**
- Added "Favorite" tab to the `TabsSection` alongside Top Matches, Popular, Top Live, Soon
- Tab includes a red heart icon that fills when active
- **Auth-gated**: Tab only appears when user is authenticated (hidden for guests)
- When user logs out while on Favorite tab, automatically switches to "Popular"

**Heart icon on clubs:**
- Small heart button next to each team name in match cards (both grid and list views)
- Only visible when user is authenticated
- Click to add team to favorites (heart fills red with scale animation)
- Click again to remove from favorites (heart becomes outline)
- Animation: 0.3s scale bounce on toggle (1→1.35→1)
- Does not break card layout

**Favorite section behavior:**
- Shows matches where at least one team is in user's favorite clubs list
- Uses the same match card design as other tabs
- Filters from already-loaded match data (no extra API calls)
- Real-time updates still work

**Empty states:**
- No favorite clubs: Shows heart icon + "No favorite clubs yet" + instruction text
- No matches for favorites: Shows heart icon + "No matches for your favorites" message
- Both states have fade-in animation

**Backend (already existed, bug fixed):**
- `GET /api/favorites/clubs` — Returns user's favorite clubs
- `POST /api/favorites/clubs` — Add club to favorites (duplicate prevention)
- `DELETE /api/favorites/clubs/{team_id}` — Remove club from favorites
- **Bug fix**: Fixed session cookie name mismatch (`session_id` → `session_token`) in `routes/favorites.py`

**Database schema — Favorites Collection (`favorites`):**

| Field | Type | Description |
|-------|------|------------|
| `user_id` | String | Reference to user |
| `team_id` | Integer | Football-Data.org team ID |
| `team_name` | String | Team display name |
| `team_crest` | String | Team crest/logo URL |
| `created_at` | String (ISO) | When favorited |

**Persistence strategy:**
- Favorites stored per-user in MongoDB `favorites` collection
- Frontend fetches favorites on auth state change
- Local state: `Set<team_id>` for O(1) lookup in match filtering
- Cache: 5-minute TTL in `services/favorites.js`
- No duplicate entries (checked server-side before insert)

**Modified files:**
- `frontend/src/pages/HomePage.jsx` — Added favorites state, fetch on auth, `handleToggleFavorite`, "Favorite" tab with filtering logic, pass favorites to MatchList
- `frontend/src/components/home/TabsSection.jsx` — Added Heart icon import, renders heart icon for `tab.icon === 'heart'`, added `data-testid` on tabs
- `frontend/src/components/home/MatchList.jsx` — Accepts `favoriteTeamIds` and `onToggleFavorite` props, passes them to MatchRow components
- `frontend/src/App.css` — Added `.fav-heart-animate`, `.favorite-empty-state` CSS animations, restored full match-list CSS styles
- `backend/routes/favorites.py` — Fixed cookie name from `session_id` to `session_token`


---

### 2026-02-19 (Session 7) — Mobile Responsiveness Fix

#### Issues Fixed

**Header (mobile):**
- Search bar: Reduced width from `min-w-[260px]` to `w-[180px]` on mobile, preventing overflow and element squeezing
- Auth icons (Messages, Friends): Hidden on small screens (`hidden sm:inline-flex`), only Notifications visible
- Login/Register buttons: Smaller text (`text-xs`) and tighter spacing on mobile
- Search dropdown: Uses `w-[calc(100vw-2rem)]` on mobile for full-width results

**Tabs Section (mobile):**
- Reduced gap from `gap-6` to `gap-3` on mobile → `gap-5 sm` → `gap-6 md`
- Tabs are now horizontally scrollable with `overflow-x-auto scrollbar-hide`
- Each tab has `whitespace-nowrap flex-shrink-0` to prevent wrapping
- "View All" button hidden on mobile (`hidden sm:flex`)
- Font size: `text-sm` on mobile → `text-base` on desktop

**League Filters (mobile):**
- Smaller padding: `px-3 py-1.5` on mobile → `px-4 py-2` on desktop
- Smaller font: `text-xs` on mobile → `text-sm` on desktop
- Added `pr-4` right padding to prevent last chip from being clipped
- Added `flex-shrink-0` on each chip to prevent squeezing

**Match Cards (mobile):**
- Vote buttons (1, X, 2) and Action buttons (GuessIt/Advance/Remove) now stack vertically on mobile using `flex-col sm:flex-row`
- Button heights: `h-[56px]` on mobile → `h-[72px] sm` → `h-[84px] md`
- Button text: `text-[10px]` on mobile → `text-xs sm` → `text-sm md`
- Icons: `w-4 h-4` on mobile → `w-5 h-5` on sm+
- Score block: `60px` wide on mobile → `80px` on sm+
- Meta row: `text-[11px]` on mobile → `text-sm` on sm+, pipe separator hidden on mobile
- Footer stats: `text-[10px]` on mobile → `text-xs` on sm+, `flex-wrap` added

**Main Page Container:**
- Padding: `px-3 py-4` on mobile → `px-4 py-6` on sm+

#### Breakpoint Strategy
- `< 640px` (mobile): Stacked buttons, smaller text, compact spacing
- `640px–768px` (sm): Inline buttons, standard text, normal spacing
- `768px+` (md): 2-column grid for match cards
- `1024px+` (lg/desktop): Full layout with all header icons

#### Modified Files
- `frontend/src/components/layout/Header.jsx` — Search bar width, auth icon visibility, button sizing
- `frontend/src/components/home/TabsSection.jsx` — Gap, scroll, font size, View All hidden on mobile
- `frontend/src/components/home/LeagueFilters.jsx` — Padding, font size, right padding
- `frontend/src/components/home/MatchList.jsx` — Button stacking, heights, font sizes, meta/footer sizing
- `frontend/src/App.css` — Score block responsive width, match card responsive CSS (padding, meta, footer, vote/action button min-widths)
- `frontend/src/pages/HomePage.jsx` — Container padding

---

### 2026-02-19 (Session 8) — Profile & Settings Pages

#### New Features

**Profile Page (`/profile`):**
- Modern user profile displaying:
  - Profile header with animated avatar, level badge, and gradient background
  - Level progress bar with points-to-next-level indicator
  - Join date
  - Settings and Logout buttons
- Stats grid: Predictions count, Correct, Wrong, Points (clickable)
- Recent Activity section with latest 5 predictions
- Favorite Teams section with remove capability
- Achievements system with 6 badges:
  - First Prediction: Make your first prediction
  - On Fire: Get 5 correct predictions
  - Champion: Reach Level 5
  - Veteran: Make 50 predictions
  - Perfectionist: Achieve 80% accuracy (min 10 predictions)
  - Fan: Add 3 favorite teams
- Performance section with circular win rate chart
- Fully responsive (mobile + desktop)

**Settings Page (`/settings`):**
- Modern account settings with 4 sections:

**1. Profile Picture Section:**
- Upload profile photo (JPG, PNG, WebP)
- Preview before saving
- Replace existing photo
- Remove photo option
- File validation: max 2MB, magic byte verification
- Stored in `/app/backend/uploads/avatars/`
- Served via `/api/uploads/avatars/{filename}`

**2. Account Information Section:**
- **Email Change** (email users only):
  - Requires current password confirmation
  - Validates email format
  - Prevents duplicate emails
  - Google users see "Email is managed by Google" notice
- **Nickname Change** (ONE TIME ONLY):
  - After initial nickname set, users get ONE free change
  - Warning banner: "You can only change your nickname once. Choose wisely!"
  - After change: `nickname_changed = true` in database
  - Button disabled permanently after use
  - Server-side enforcement (cannot bypass via API)

**3. Security Section:**
- Change password form with:
  - Current password verification
  - New password with strength requirements (8+ chars, uppercase, lowercase, digit)
  - Confirm new password
  - Password visibility toggle
  - Clear validation messages
- Google users see "Secured by Google" notice

**4. Backend Validation:**
- All settings operations require authentication
- Password verification for email change
- One-time nickname rule enforced server-side
- File upload validates magic bytes, not just extensions
- Proper error responses with user-friendly messages

#### Database Schema Changes

**Users Collection — New Fields:**

| Field | Type | Description |
|-------|------|------------|
| `nickname_changed` | Boolean | `true` after one-time nickname change used |
| `picture` | String | Avatar URL (local upload path or Google OAuth URL) |

#### API Endpoints — Settings Routes (`/api/settings/*`)

| Endpoint | Method | Description |
|----------|--------|------------|
| `/api/settings/profile` | GET | Get user settings profile data |
| `/api/settings/email` | POST | Change email (requires password) |
| `/api/settings/password` | POST | Change password |
| `/api/settings/nickname` | POST | Change nickname (one-time) |
| `/api/settings/avatar` | POST | Upload profile picture |
| `/api/settings/avatar` | DELETE | Remove profile picture |
| `/api/settings/nickname/status` | GET | Check nickname change status |

#### Security Implementation

**Password Change:**
```python
# Verify current password
if not verify_password(data.current_password, user["password_hash"]):
    raise HTTPException(status_code=401, detail="Current password is incorrect")

# Check new password is different
if verify_password(data.new_password, user["password_hash"]):
    raise HTTPException(status_code=400, detail="New password must be different")
```

**One-Time Nickname Rule:**
```python
# Check if nickname was already changed
if user.get("nickname_changed", False):
    raise HTTPException(
        status_code=400,
        detail="You have already used your one-time nickname change."
    )

# After successful change
await db.users.update_one(
    {"user_id": user["user_id"]},
    {"$set": {"nickname": new_nickname, "nickname_changed": True}}
)
```

**Avatar Upload Validation:**
```python
# Validate magic bytes (not just extension)
image_signatures = {
    b'\xff\xd8\xff': 'jpg',
    b'\x89PNG\r\n\x1a\n': 'png',
    b'RIFF': 'webp'  # WebP starts with RIFF
}

# Validate file size (2MB max)
if len(contents) > 2 * 1024 * 1024:
    raise HTTPException(status_code=400, detail="File too large")
```

#### Modified Files

**Backend:**
- `backend/routes/settings.py` — New file with all settings API routes
- `backend/server.py` — Added settings router, static file serving for avatars
- `backend/models/auth.py` — Added `nickname_changed` field to UserResponse

**Frontend:**
- `frontend/src/pages/ProfilePage.jsx` — New profile page
- `frontend/src/pages/SettingsPage.jsx` — New settings page
- `frontend/src/App.js` — Added `/profile` and `/settings` routes
- `frontend/src/components/layout/Header.jsx` — Profile and Settings links in dropdown


---

### 2026-02-19 (Session 9) — Real-Time Friendship System

#### New Features

**Friends Page (`/friends`):**
- Complete friend management system with three tabs:
  - **Friends Tab**: Shows all accepted friends with remove option
  - **Incoming Tab**: Shows pending friend requests with accept/decline buttons
  - **Sent Tab**: Shows outgoing requests with cancel option
- User search by nickname (partial match, case-insensitive)
- Search results show relationship status: Friends, Pending, Add Friend
- Real-time updates via WebSocket

**Friend Request System:**
- Send friend request by searching nickname
- Accept incoming requests (both users become friends)
- Decline incoming requests (status changes to declined)
- Cancel sent requests (request is deleted)
- Remove existing friends (friendship deleted)

**Real-Time Notifications (WebSocket):**
- WebSocket endpoint: `/api/ws/friends/{user_id}`
- Events:
  - `friend_request_received`: New incoming request
  - `friend_request_accepted`: Someone accepted your request
  - `friend_added`: You accepted a request
  - `friend_request_declined`: Request was declined
  - `friend_request_cancelled`: Request was cancelled
  - `friend_removed`: Friend was removed
- Badge on header Friends icon shows pending request count
- Updates without page refresh

**Profile Page Friends Section:**
- Shows up to 4 friends with avatars
- Displays friend's nickname, level, and points
- "View all" button navigates to Friends page

#### Database Schema Changes

**New Collections:**

**friend_requests:**
```javascript
{
  request_id: "freq_xxxx",       // Unique request ID
  sender_id: "user_xxxx",        // User who sent the request
  receiver_id: "user_xxxx",      // User who receives the request
  status: "pending",             // "pending", "accepted", "declined"
  created_at: "ISO date",
  accepted_at: "ISO date",       // When accepted (optional)
  declined_at: "ISO date"        // When declined (optional)
}
```

**friendships:**
```javascript
{
  friendship_id: "friend_xxxx",  // Unique friendship ID
  user_a: "user_xxxx",           // First user
  user_b: "user_xxxx",           // Second user
  created_at: "ISO date"
}
```

#### API Endpoints — Friends Routes (`/api/friends/*`)

| Endpoint | Method | Description |
|----------|--------|------------|
| `/api/friends/search?q=` | GET | Search users by nickname |
| `/api/friends/request` | POST | Send friend request |
| `/api/friends/requests/pending` | GET | Get incoming/outgoing pending requests |
| `/api/friends/requests/count` | GET | Get pending incoming count (for badge) |
| `/api/friends/request/{id}/accept` | POST | Accept friend request |
| `/api/friends/request/{id}/decline` | POST | Decline friend request |
| `/api/friends/request/{id}/cancel` | POST | Cancel sent friend request |
| `/api/friends/list` | GET | Get friends list |
| `/api/friends/{user_id}` | DELETE | Remove friend |

#### Real-Time Architecture

**WebSocket Connection:**
```javascript
// Connect to friend notifications WebSocket
const ws = new WebSocket(`wss://domain/api/ws/friends/${userId}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'friend_request_received':
      // Update incoming requests list and badge count
      break;
    case 'friend_request_accepted':
      // Add new friend to friends list
      break;
    // etc.
  }
};
```

**FriendsContext (React):**
- Global state for pending count, requests, and friends
- WebSocket connection managed by context
- Auto-reconnect on disconnect
- Cache invalidation on state changes

#### Security Validation

**Friend Request Rules (Server-Side):**
```python
# Cannot send to self
if target_user["user_id"] == user["user_id"]:
    raise HTTPException(status_code=400, detail="Cannot send request to yourself")

# Cannot send if already friends
if existing_friendship:
    raise HTTPException(status_code=400, detail="Already friends")

# Cannot send if pending request exists
if existing_request:
    raise HTTPException(status_code=400, detail="Request already pending")
```

**Request Actions:**
- Only receiver can accept/decline
- Only sender can cancel
- Status must be "pending" for actions

#### Modified Files

**Backend:**
- `backend/routes/friends.py` — New file with all friends API routes and WebSocket manager
- `backend/server.py` — Added friends router and `/api/ws/friends/{user_id}` endpoint

**Frontend:**
- `frontend/src/pages/FriendsPage.jsx` — New friends management page
- `frontend/src/lib/FriendsContext.js` — New context for friends state
- `frontend/src/services/friends.js` — New API service for friends
- `frontend/src/pages/ProfilePage.jsx` — Added friends section
- `frontend/src/components/layout/Header.jsx` — Friends icon with badge count
- `frontend/src/App.js` — Added FriendsProvider and /friends route


---

### 2026-02-19 (Session 10) — Header Level Badge Enhancement

#### UI Changes

**Level Badge in Header:**
- Increased badge size for better visibility:
  - Trophy icon: `w-4 h-4` on mobile, `w-5 h-5` on desktop
  - Text: `text-sm` on mobile, `text-base` on desktop
  - Padding: `px-3 py-1.5` on mobile, `px-3.5 py-2` on desktop
  - Border radius: `rounded-xl` for modern look
- Added compact line-height (`leading-[0.5rem]`) for tighter text layout

#### Modified Files

- `frontend/src/components/layout/Header.jsx` — Updated LevelPopover component styling
