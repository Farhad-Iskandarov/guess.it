# GuessIt - Football Prediction Platform

A full-stack football match prediction platform where users predict match outcomes (home/draw/away + exact scores), compete on leaderboards, and engage with friends in real time.

**Source**: Cloned from [github.com/Farhad-Iskandarov/guess.it](https://github.com/Farhad-Iskandarov/guess.it)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Craco, Tailwind CSS, Radix UI, React Router v7 |
| Backend | FastAPI (Python 3.11), Motor (async MongoDB driver) |
| Database | MongoDB (local) |
| Real-time | WebSockets (live matches, chat, friends, notifications) |
| Cache | Redis pub/sub (falls back to local mode if unavailable) |
| External APIs | football-data.org v4 (match data), Stripe (subscriptions) |

---

## Project Structure

```
/app/
├── backend/
│   ├── server.py                  # Main FastAPI app, startup, middleware, WebSocket endpoints
│   ├── reminder_worker.py         # Background worker for match reminders
│   ├── .env                       # Backend environment variables
│   ├── requirements.txt           # Python dependencies
│   ├── models/
│   │   ├── auth.py                # User, session, password models
│   │   ├── prediction.py          # Prediction data models
│   │   ├── points_config.py       # Points/scoring configuration
│   │   └── weekly_season.py       # Weekly season models
│   ├── routes/
│   │   ├── auth.py                # Registration, login, logout, password reset, Google OAuth
│   │   ├── admin.py               # Admin panel CRUD (users, matches, API config)
│   │   ├── football.py            # Match data fetching, caching, live scores
│   │   ├── predictions.py         # Submit/view predictions, detailed history
│   │   ├── weekly.py              # Weekly season leaderboard engine
│   │   ├── friends.py             # Friend requests, friend list management
│   │   ├── messages.py            # Chat/messaging system
│   │   ├── notifications.py       # Push notification management
│   │   ├── favorites.py           # Favorite teams and saved matches
│   │   ├── subscriptions.py       # Stripe subscription management
│   │   ├── settings.py            # User settings/preferences
│   │   ├── public.py              # Public endpoints (news, about, etc.)
│   │   └── error_logs.py          # Error logging endpoints
│   └── services/
│       ├── football_api.py        # football-data.org API client
│       ├── prediction_processor.py # Score calculation and processing
│       ├── weekly_engine.py       # Weekly season creation/rotation
│       ├── achievement_engine.py  # Achievement/badge system
│       ├── redis_pubsub.py        # Redis pub/sub for cross-worker events
│       ├── reminder_engine.py     # Match reminder scheduling
│       └── spike_detector.py      # Anomaly detection for predictions
│
├── frontend/
│   ├── .env                       # Frontend environment variables
│   ├── package.json               # Node dependencies
│   ├── craco.config.js            # Craco config (path aliases, plugins)
│   ├── tailwind.config.js         # Tailwind theme/colors/animations
│   ├── src/
│   │   ├── App.js                 # Root component, all routes defined here
│   │   ├── App.css                # Global animations, custom styles
│   │   ├── index.css              # Tailwind imports, CSS variables, themes
│   │   ├── pages/                 # All page-level components
│   │   │   ├── HomePage.jsx       # Main page with match list, top matches carousel
│   │   │   ├── LoginPage.jsx      # Email/password login
│   │   │   ├── RegisterPage.jsx   # User registration
│   │   │   ├── AdminLoginPage.jsx # Admin login (/itguess/admin/login)
│   │   │   ├── AdminPage.jsx      # Admin dashboard (/itguess/admin)
│   │   │   ├── ProfilePage.jsx    # User profile, stats, achievements
│   │   │   ├── MyPredictionsPage.jsx  # User's prediction history
│   │   │   ├── MatchDetailPage.jsx    # Individual match detail (/match/:matchId)
│   │   │   ├── LeaderboardPage.jsx    # Weekly + global leaderboard
│   │   │   ├── FriendsPage.jsx    # Friend management
│   │   │   ├── MessagesPage.jsx   # Chat interface
│   │   │   ├── SettingsPage.jsx   # User preferences
│   │   │   ├── SavedMatchesPage.jsx   # Bookmarked matches
│   │   │   ├── SubscriptionPage.jsx   # Subscription plans
│   │   │   └── ... (About, Contact, News, HowItWorks, etc.)
│   │   ├── components/
│   │   │   ├── home/
│   │   │   │   ├── MatchList.jsx          # Main match list (league-grouped cards)
│   │   │   │   ├── MatchCard.jsx          # Compact match card variant
│   │   │   │   ├── TopMatchesCards.jsx    # Featured matches carousel
│   │   │   │   └── ...
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx, Footer.jsx, Sidebar.jsx
│   │   │   │   └── ...
│   │   │   └── ui/                        # Radix UI primitives (button, dialog, tabs, etc.)
│   │   ├── lib/
│   │   │   ├── AuthContext.js     # Auth state, login/logout, session management
│   │   │   ├── FriendsContext.js  # Friends state, WebSocket integration
│   │   │   ├── MessagesContext.js # Messages state, WebSocket integration
│   │   │   └── ThemeContext.js    # Dark/light theme toggle
│   │   ├── services/
│   │   │   ├── matches.js         # Match API + in-memory cache
│   │   │   ├── predictions.js     # Predictions API + cache
│   │   │   ├── friends.js         # Friends API
│   │   │   ├── messages.js        # Messages API
│   │   │   └── favorites.js       # Favorites API
│   │   ├── hooks/                 # Custom hooks (toast, live matches, localStorage)
│   │   └── utils/                 # Error handler, time formatting
│   └── plugins/                   # Craco plugins
│
└── memory/
    ├── PRD.md                     # Product requirements document
    └── test_credentials.md        # Test login credentials
```

---

## Environment Variables

### Backend (`/app/backend/.env`)

| Variable | Description | Status |
|----------|-------------|--------|
| `MONGO_URL` | MongoDB connection string | Configured |
| `DB_NAME` | Database name | Configured |
| `CORS_ORIGINS` | Allowed CORS origins | Configured (`*`) |
| `REDIS_URL` | Redis connection (optional) | Configured (falls back to local) |
| `FOOTBALL_API_KEY` | football-data.org API key | **NOT SET** - needs key |
| `FOOTBALL_API_BASE_URL` | Football API base URL | Configured |
| `ADMIN_EMAIL` | Admin account email | Configured |
| `ADMIN_PASSWORD` | Admin account password | Configured |
| `ADMIN_NICKNAME` | Admin display name | Configured |
| `STRIPE_API_KEY` | Stripe payment key | **NOT SET** - needs key |

### Frontend (`/app/frontend/.env`)

| Variable | Description |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | Backend API URL (auto-configured) |

---

## Key Routes

### Frontend Routes (defined in `App.js`)

| Route | Page | Auth |
|-------|------|------|
| `/` | HomePage (match list) | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/leaderboard` | Leaderboard | Public |
| `/match/:matchId` | Match Detail | Public |
| `/my-predictions` | My Predictions | Protected |
| `/profile` | User Profile | Protected |
| `/friends` | Friends | Protected |
| `/messages` | Chat | Protected |
| `/settings` | Settings | Protected |
| `/saved-matches` | Saved Matches | Protected |
| `/subscription` | Subscription Plans | Protected |
| `/itguess/admin/login` | Admin Login | Public |
| `/itguess/admin` | Admin Dashboard | Admin Only |

### Backend API Endpoints (all prefixed with `/api`)

| Group | Base Path | Key Endpoints |
|-------|-----------|---------------|
| Auth | `/api/auth` | `/login`, `/register`, `/logout`, `/me`, `/google/callback` |
| Football | `/api/football` | `/matches`, `/matches/{id}`, `/live` |
| Predictions | `/api/predictions` | `/submit`, `/my`, `/me/detailed` |
| Weekly | `/api/weekly` | `/leaderboard`, `/current-season` |
| Friends | `/api/friends` | `/list`, `/request`, `/accept`, `/reject` |
| Messages | `/api/messages` | `/conversations`, `/send`, `/history/{userId}` |
| Admin | `/api/admin` | `/users`, `/matches`, `/config`, `/stats` |
| Favorites | `/api/favorites` | `/teams`, `/matches` |

### WebSocket Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/ws/matches` | Live match score updates |
| `/api/ws/friends/{userId}` | Friend requests, online status |
| `/api/ws/chat/{userId}` | Real-time chat messages |
| `/api/ws/notifications/{userId}` | Push notifications |

---

## Credentials

### Admin Account
- **Email**: `farhad.isgandar@gmail.com`
- **Password**: `Salam123?`
- **Admin Panel**: `/itguess/admin/login`

---

## Running Locally

Backend and frontend are managed by **supervisord**:

```bash
# Check status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# View logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.err.log
```

- Backend runs on port **8001** (internal)
- Frontend runs on port **3000** (internal)
- All `/api` routes are proxied to the backend via Kubernetes ingress

---

## Known Limitations

1. **FOOTBALL_API_KEY not configured** - Match data comes from persistent cache only. To get live data, add a key from [football-data.org](https://www.football-data.org/)
2. **STRIPE_API_KEY not configured** - Subscription payments won't process. Add a Stripe test/live key
3. **Redis not available** - Pub/sub falls back to local mode. Multi-worker real-time events won't sync across instances
4. **bcrypt warning** - `passlib` shows a deprecation warning about `bcrypt.__about__`. Cosmetic only, does not affect functionality

---

## Recent Changes

### Mobile Bottom Navigation Bar (2026-04-10)
- 5-tab bottom nav: Home, Leaderboard, Message, Saved, Profile
- Mobile-only (hidden on desktop), fixed at bottom
- Dark/light theme aware, Instagram/TikTok style
- Active tab highlighted, hidden on auth/admin pages
- iPhone safe-area support

### Live Match Time on Match Cards (2026-04-10)
- Shows exact match minute (45', HT, 90+3') on live match cards
- Displayed prominently between team rows and in status badge
- Animated pulse for live indicators

### UX Improvements (2026-04-10)
- **Scroll reset**: Every tab switch via bottom nav resets scroll to top — no stale scroll positions
- **Live vote bars**: Prediction percentages update instantly after voting (optimistic updates)
- **Bell icon silenced**: Tapping the bell icon no longer shows a toast notification — clean toggle only

### Match Card UI Overhaul (2026-04-11)
- **Full club names**: No more truncation ("...") — long names wrap to 2 lines naturally (e.g., "OLYMPIQUE LYON")
- **Better spacing**: Increased gap between cards (10px to 24px) with stronger borders for clean, breathable layout
- **Improved readability**: More internal padding, balanced alignment, no cramped elements

### Global Club Name Truncation Fix (2026-04-13)
- **Applied globally**: Full club names now shown without "..." truncation across ALL pages and components
- **Affected pages**: My Predictions, Saved/Bookmarked Matches, Match Detail, Messages, Admin Panel, Top Matches Carousel, Search Results (Header)
- **Behavior**: Long names wrap to 2 lines max (`line-clamp-2`) with clean layout — no overflow, no ellipsis
- **Mobile responsive**: Proper wrapping and spacing maintained on all screen sizes (tested 390px and 1920px)
- **Files changed**: `MyPredictionsPage.jsx`, `MatchDetailPage.jsx`, `MessagesPage.jsx`, `AdminPage.jsx`, `TopMatchesCards.jsx`, `MatchList.jsx`, `MatchCard.jsx`, `Header.jsx`

### Mobile Layout Restructuring for Club Names (2026-04-13)
- **Root cause**: On mobile, prediction badges and action buttons used `flex-shrink-0`, squeezing team name containers to ~30% width
- **Fix**: Restructured card layouts in My Predictions page (both grid and list views) using responsive `flex-col sm:flex-row` — teams now get full width on mobile, with "YOUR PICK" badge on its own row below
- **Saved Matches**: Added `break-words leading-tight` for consistent text wrapping
- **Result**: All club names fully readable on mobile (390px) — "FC St. Pauli 1910", "TSG 1899 Hoffenheim", "Borussia Dortmund", "Bayer 04 Leverkusen" etc.
- **Desktop preserved**: Side-by-side layout unchanged on desktop (1920px)
- **Testing**: 100% frontend pass rate

### Dynamic Points System (2026-04-13)
- **Formula**: `points = base_points * (1 - percentage/100) * 1.3`, clamped to [5, 50]
- **Behavior**: Popular choices (>60%) → low points + "👥 Popular Pick" label. Rare choices (<20%) → high points + "🔥 High Risk" label. Otherwise → "⚖️ Balanced"
- **Admin**: "Correct Prediction" renamed to "Base Points (Dynamic)" (default: 50)
- **Frontend**: Dynamic points and risk labels shown on prediction bars and Quick Predict modal
- **Backend**: Points calculated per match based on vote distribution, stored as `dynamicPoints` in match data
- **Edge case**: 0 total votes → equal distribution (33.3% each → 43 pts, Balanced)
- **Testing**: 100% backend + frontend + integration pass rate

### Prediction UI Cleanup (2026-04-13)
- Removed "pts" values from prediction bars and Quick Predict modal (backend unchanged)
- Removed risk label icons and text (👥 Most Popular / 🔥 High Risk / ⚖️ Balanced) — X-edit reverted per user request
- Clean display: only percentages + progress bars remain

### Header Auto-Hide & Scroll-to-Top Fix (2026-04-15)
- **Header**: Hides smoothly on scroll down, reappears on scroll up (mobile only, desktop always visible)
- **Implementation**: Fixed positioning with `translateY(-100%)` hide + 0.3s transition. JS scroll-direction detection only on `< 768px`
- **Scroll-to-top button**: Now stays visible after scroll-up stops (Instagram/Twitter style). Hides only on scroll-down or near page top
- **No content shift**: Spacer div prevents layout jump when header hides/shows
