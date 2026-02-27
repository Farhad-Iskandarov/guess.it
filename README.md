# GuessIt - Football Prediction Platform

A social football prediction platform where fans analyze, predict, and compete with friends.

---

## Tech Stack

- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB driver), Pydantic v2
- **Database:** MongoDB
- **Real-time:** WebSockets (live matches, chat, notifications)
- **Auth:** Session-based (httpOnly cookies) + Google OAuth
- **Football Data:** Multi-provider (football-data.org v4 + API-Football api-sports.io v3)
- **Payments:** Stripe (subscription system)

---

## Football API - Multi-Provider System

GuessIt supports **two football data providers**. You can switch between them instantly from the Admin Panel without any code changes.

### Supported Providers

| Provider | Base URL | Auth Header | Free Plan |
|----------|----------|-------------|-----------|
| **football-data.org** (v4) | `https://api.football-data.org/v4` | `X-Auth-Token` | 10 req/min, wide date range |
| **API-Football** (api-sports.io v3) | `https://v3.football.api-sports.io` | `x-apisports-key` | 100 req/day, 10 req/min |

### How to Switch APIs

1. Go to **Admin Panel → System → API**
2. Click **Add New API**
3. Enter:
   - **Name:** e.g., "Football-Data.org" or "API-Football"
   - **Base URL:** (see table above)
   - **API Key:** Your key
4. Click **Activate** on the new API

The system will automatically:
- Detect the provider from the base URL
- Validate the key against the correct provider
- Clear all cached data
- Fetch fresh match data immediately
- Display how many matches were loaded

### Where to Get API Keys

| Provider | Registration URL |
|----------|-----------------|
| football-data.org | [football-data.org/client/register](https://www.football-data.org/client/register) |
| API-Football | [dashboard.api-football.com](https://dashboard.api-football.com) |

### Supported Leagues

| Code | League | football-data.org | API-Football ID |
|------|--------|-------------------|-----------------|
| PL | Premier League | Yes | 39 |
| CL | Champions League | Yes | 2 |
| PD | La Liga | Yes | 140 |
| SA | Serie A | Yes | 135 |
| BL1 | Bundesliga | Yes | 78 |
| FL1 | Ligue 1 | Yes | 61 |
| EC | European Championship | Yes | 4 |
| WC | FIFA World Cup | Yes | 1 |

---

## Run Locally

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Python** | 3.11+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Yarn** | 1.22+ | `npm install -g yarn` |
| **MongoDB** | 6.0+ | [mongodb.com/docs/manual/installation](https://www.mongodb.com/docs/manual/installation/) |

### Step 1: Clone the Repository

```bash
git clone https://github.com/Farhad-Iskandarov/guess.it.git
cd guess.it
```

### Step 2: Start MongoDB

Make sure MongoDB is running locally on the default port (27017).

**macOS (Homebrew):**
```bash
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo systemctl start mongod
```

**Windows:**
```bash
net start MongoDB
```

**Docker (alternative):**
```bash
docker run -d --name guessit-mongo -p 27017:27017 mongo:6
```

Verify MongoDB is running:
```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

### Step 3: Configure Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your values:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="guessit"
CORS_ORIGINS="*"
JWT_SECRET=your-strong-random-secret-key
FOOTBALL_API_KEY=your-football-api-key
STRIPE_API_KEY=sk_test_your-stripe-test-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourStrongPassword
ADMIN_NICKNAME=admin
```

> **Football API Key:** Register free at [football-data.org](https://www.football-data.org/client/register) or [API-Football](https://dashboard.api-football.com)
> **Stripe Key:** Get test key at [stripe.com/dashboard](https://dashboard.stripe.com/test/apikeys)

**Frontend:**
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Step 4: Install Backend Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 5: Install Frontend Dependencies

```bash
cd ../frontend
yarn install
```

### Step 6: Start the Backend

```bash
cd backend
source venv/bin/activate    # if not already active
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

On first startup, the backend will automatically:
- Seed the admin account
- Seed the Football API key into the database
- Seed default subscription plans (Standard, Champion, Elite)
- Seed default points configuration

### Step 7: Start the Frontend

In a new terminal:
```bash
cd frontend
yarn start
```

### Step 8: Access the Application

| Page | URL |
|------|-----|
| **Homepage** | [http://localhost:3000](http://localhost:3000) |
| **Admin Panel** | [http://localhost:3000/itguess/admin/login](http://localhost:3000/itguess/admin/login) |
| **API Docs** | [http://localhost:8001/docs](http://localhost:8001/docs) |
| **API Health** | [http://localhost:8001/api/health](http://localhost:8001/api/health) |

### Admin Credentials (auto-seeded)

| Field | Value |
|-------|-------|
| Email | Set via `ADMIN_EMAIL` env var |
| Password | Set via `ADMIN_PASSWORD` env var |

> You can override these via environment variables: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NICKNAME`

---

## Features

### Core Features
- User registration & login (email + Google OAuth)
- Live football match browsing (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UCL)
- Match predictions with points system
- Global leaderboard
- Friends system (send/accept/decline requests)
- Real-time messaging & chat
- In-app notifications
- User profiles with avatar & banner uploads
- Favorite matches & teams
- Dark/Light theme toggle

### Prediction System
- **Winner Predictions (1/X/2)** - Predict match winners for points
- **Exact Score Predictions** - Predict exact final scores for +50 bonus points
  - Clean numeric input (no browser arrows, no forced `0` default)
  - Leading zeros auto-stripped (`02` → `2`, `00` → `0`)
  - Consistent design across all pages: Main Page, Chat, Match Detail, My Predictions
- **Configurable Points System** - Admin can configure all point values dynamically
- **My Predictions Page** - View, edit, remove all predictions before match starts
- **Automatic Level System** - User levels auto-calculate based on point thresholds (0, 100, 120, 200, 250, 350, 500, 750, 1000, 1500, 2000). Levels sync instantly after gifted or earned points.

### Homepage Tabs
- **Top Matches** - All active (non-finished) matches
- **Popular** - Top 10 matches by prediction count
- **Top Live** - Top 10 live matches by prediction count
- **Soon** - Matches scheduled within next 3 days
- **Ended** - Recently finished matches (last 24h)
- **Favorite** - Matches from favorite teams & bookmarked matches

### Content Features
- News/Blog system (admin-managed)
- Email subscriptions (footer newsletter)
- Contact form
- Editable contact info (admin-controlled)

### Subscription System
- 3 Premium Plans: Standard ($4.99/mo), Champion ($9.99/mo), Elite ($19.99/mo)
- Stripe Payment Integration (test mode)
- Subscription management & premium badges

### Admin Panel
- **Manual Points Gifting** - Gift points to individual or multiple users with custom messages, real-time notifications, and full audit trail
- **API Management** - Add, validate, activate, and switch between football data providers without downtime

### Chat & Social
- Real-time messaging with friends
- Compact match card previews in chat — click card body to navigate to Match Detail, use "Predict" button for inline predictions
- Invite friends to guess via match card sharing (unlimited re-sends allowed)
- Mobile keyboard stays open for continuous messaging (no re-tap needed after each send)

### Match Detail Page
- Full match center page (`/match/:matchId`) — mini ESPN-style experience
- Large team logos, big score or VS indicator, status badges (Upcoming/LIVE/FT)
- Vote buttons (1/X/2) with vote counts, percentages, and progress bars
- Guess It, Remove, and Lock Exact Score — all directly visible
- Advanced section: Invite Friend + Share Match Link
- League Standings table: Top 10 teams with home/away teams highlighted
- Scroll-to-top on every navigation for fresh page feel
- Clickable match cards on Homepage and My Predictions page navigate to detail

---

## Admin Panel

### How to access:

1. Go to `/itguess/admin/login`
2. Enter admin credentials (see above)
3. Click "Sign In to Admin Panel"

### Tabs:

| Tab | Description |
|-----|-------------|
| Dashboard | Overview stats, activity, audit log, subscription overview |
| Users | Manage users (ban, gift points, view messages, change password) |
| Matches | Match management and live match control |
| Points Settings | Configure prediction points, penalties, bonuses |
| Carousel Banners | Homepage banner image management |
| News | Create, edit, delete, publish/unpublish articles |
| Subscription Plans | Manage premium plans: prices, features, active/inactive |
| Subscribed Emails | View newsletter subscriptions |
| Contact Messages | View, flag, delete contact form submissions |
| Contact Settings | Edit support email, location info |
| System | **API configuration** - Add, validate, activate football data providers |
| Prediction Monitor | Monitor prediction streaks |
| Favorites | View user favorites |
| Notifications | Send notifications |
| Analytics | Platform analytics and charts |

---

## Project Structure

```
/
├── backend/
│   ├── server.py              # Main FastAPI app, WebSocket, admin seeder
│   ├── .env.example           # Environment template
│   ├── requirements.txt       # Python dependencies
│   ├── models/
│   │   ├── auth.py            # User models
│   │   ├── prediction.py      # Prediction + ExactScore models
│   │   └── points_config.py   # Points configuration model
│   ├── routes/
│   │   ├── auth.py            # Register, Login, Google OAuth, Nickname
│   │   ├── admin.py           # Admin panel + points config + gift points + API management
│   │   ├── public.py          # Subscribe, Contact, News (public)
│   │   ├── predictions.py     # Predictions + exact score + detailed view
│   │   ├── football.py        # Football API, live polling, banners, leaderboard
│   │   ├── subscriptions.py   # Stripe subscription management
│   │   ├── favorites.py       # Favorite clubs
│   │   ├── friends.py         # Friend requests & friendships
│   │   ├── messages.py        # Real-time chat messaging
│   │   ├── notifications.py   # In-app notifications
│   │   └── settings.py        # User settings
│   ├── services/
│   │   ├── football_api.py    # Multi-provider football API service
│   │   └── prediction_processor.py  # Points & exact score processing
│   ├── tests/                 # Backend tests
│   └── uploads/               # User avatars, banners, news images
├── frontend/
│   ├── .env.example           # Environment template
│   ├── package.json           # Node.js dependencies
│   ├── craco.config.js        # CRACO configuration (path aliases)
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── src/
│   │   ├── App.js             # Routes, AdminRoute, PublicLayout
│   │   ├── pages/
│   │   │   ├── HomePage.jsx           # Main page with match tabs & filters
│   │   │   ├── AdminLoginPage.jsx     # Admin login
│   │   │   ├── AdminPage.jsx          # Admin dashboard (all tabs)
│   │   │   ├── MyPredictionsPage.jsx  # User predictions with exact score
│   │   │   ├── MatchDetailPage.jsx    # Match center (vote, predict, standings)
│   │   │   ├── SubscribePage.jsx      # Premium subscription plans
│   │   │   ├── NewsPage.jsx           # News list
│   │   │   ├── NewsArticlePage.jsx    # Article detail
│   │   │   ├── ContactPage.jsx        # Contact form
│   │   │   ├── LoginPage.jsx          # User login
│   │   │   ├── RegisterPage.jsx       # User registration
│   │   │   ├── LeaderboardPage.jsx    # Global leaderboard
│   │   │   ├── ProfilePage.jsx        # User profile
│   │   │   ├── FriendsPage.jsx        # Friends management
│   │   │   ├── ChatPage.jsx           # Real-time chat
│   │   │   ├── NotificationsPage.jsx  # Notifications
│   │   │   ├── SettingsPage.jsx       # User settings
│   │   │   ├── HowItWorksPage.jsx     # How it works
│   │   │   └── AboutPage.jsx          # About page
│   │   ├── components/
│   │   │   ├── layout/        # Header, Footer
│   │   │   ├── home/
│   │   │   │   └── MatchList.jsx  # Match cards with prediction UI
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── lib/               # AuthContext, FriendsContext, utils
│   │   └── services/          # API service functions
│   └── public/                # Static assets
├── memory/
│   └── PRD.md                 # Product requirements document
└── tests/                     # Integration tests
```

---

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/` | API root |
| POST | `/api/subscribe` | Subscribe to newsletter |
| POST | `/api/contact` | Submit contact form |
| GET | `/api/contact-settings` | Get contact info |
| GET | `/api/news` | List published articles |
| GET | `/api/news/{article_id}` | Get single article |
| GET | `/api/subscriptions/plans` | Get subscription plans |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Football
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/football/matches` | All matches (filterable) |
| GET | `/api/football/matches/today` | Today's matches |
| GET | `/api/football/matches/live` | Live matches |
| GET | `/api/football/matches/upcoming` | Upcoming matches |
| GET | `/api/football/matches/ended` | Ended matches (24h) |
| GET | `/api/football/matches/competition/{code}` | By competition |
| GET | `/api/football/search?q=` | Search by team name |
| GET | `/api/football/competitions` | Available competitions |
| GET | `/api/football/banners` | Active banners |
| GET | `/api/football/leaderboard` | Global leaderboard |
| WS | `/api/ws/matches` | Live match updates |

### Predictions (authenticated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predictions` | Create/update prediction |
| GET | `/api/predictions/me` | Get user predictions |
| GET | `/api/predictions/me/detailed` | Detailed with match data |
| DELETE | `/api/predictions/match/{id}` | Delete prediction |
| POST | `/api/predictions/exact-score` | Create exact score |
| PUT | `/api/predictions/exact-score/match/{id}` | Update exact score |
| DELETE | `/api/predictions/exact-score/match/{id}` | Delete exact score |
| GET | `/api/predictions/exact-score/me` | All exact scores |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET/POST/PUT/DELETE | `/api/admin/news` | News CRUD |
| GET/DELETE | `/api/admin/subscriptions` | Email subscriptions |
| GET/PUT/DELETE | `/api/admin/contact-messages` | Contact messages |
| GET/PUT | `/api/admin/contact-settings` | Contact settings |
| GET/POST/PUT/DELETE | `/api/admin/banners` | Banner management |
| GET | `/api/admin/users` | User management |
| GET | `/api/admin/analytics` | Analytics |
| GET/PUT | `/api/admin/points-config` | Points configuration |
| POST | `/api/admin/points-config/reset` | Reset points to defaults |
| POST | `/api/admin/gift-points` | Gift points to users |
| GET | `/api/admin/gift-points/log` | Gift points audit trail |
| GET | `/api/admin/system/apis` | List configured APIs |
| POST | `/api/admin/system/apis` | Add new API |
| POST | `/api/admin/system/apis/validate` | Validate API key |
| POST | `/api/admin/system/apis/{id}/activate` | Activate API (validates, clears cache, fetches data) |
| DELETE | `/api/admin/system/apis/{id}` | Delete API config |

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGO_URL` | Yes | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Yes | Database name | `guessit` |
| `CORS_ORIGINS` | Yes | Allowed origins | `*` or `http://localhost:3000` |
| `JWT_SECRET` | Yes | Session/JWT secret | Random string |
| `FOOTBALL_API_KEY` | Yes | Default football API key (seeded on first run) | Get from provider |
| `STRIPE_API_KEY` | Yes | Stripe secret key (test) | `sk_test_...` |
| `ADMIN_EMAIL` | No | Admin seed email | `admin@example.com` |
| `ADMIN_PASSWORD` | No | Admin seed password | `StrongPass123!` |
| `ADMIN_NICKNAME` | No | Admin seed nickname | `admin` |

### Frontend (`frontend/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Yes | Backend API URL | `http://localhost:8001` |

---

## Troubleshooting

### MongoDB won't connect
- Ensure MongoDB is running: `mongosh --eval "db.runCommand({ ping: 1 })"`
- Check `MONGO_URL` in `backend/.env`

### Football API returns empty matches
- **football-data.org:** Verify key at [football-data.org](https://www.football-data.org/client/login). Free tier: 10 req/min.
- **API-Football:** Verify key at [dashboard.api-football.com](https://dashboard.api-football.com). Free tier: 100 req/day.
- Check Admin Panel → System → API to see which provider is active
- Try activating a different API key if the current one is suspended or rate-limited

### API activation fails with Error 400
- The system validates the key before activation. Error 400 means the key is invalid or the account is suspended.
- Check the error message for details (e.g., "account suspended", "invalid key")
- Ensure the **Base URL** matches the provider (see table above)

### Frontend can't reach backend
- Ensure backend is running on port 8001
- Check `REACT_APP_BACKEND_URL` in `frontend/.env` matches your backend URL
- For CORS issues, set `CORS_ORIGINS=*` in `backend/.env`

### Admin login fails
- The admin account is seeded on first startup. If you changed the database, restart the backend.
- Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars

---

## Notes for Developers

- **Hot Reload:** Both backend (`--reload` flag) and frontend (`yarn start`) support hot reload.
- **Database Reset:** Drop the database to start fresh: `mongosh --eval "use guessit; db.dropDatabase()"`
- **API Docs:** FastAPI auto-generates docs at `http://localhost:8001/docs`
- **Path Aliases:** Frontend uses `@/` alias for `src/` (configured in `craco.config.js` and `jsconfig.json`)
- **Uploads:** User avatars and news images are stored in `backend/uploads/`
- **Multi-Provider:** The `football_api.py` service auto-detects the provider from the active config's `base_url`. It has separate fetch and transform functions for each provider, but exposes a unified API to the rest of the backend.
- **Caching:** Backend uses in-memory caching (3-min TTL for matches, 25s for live). Frontend uses stale-while-revalidate pattern with 5-min cache.
- **Level System:** Levels auto-recalculate whenever points change (gift, prediction, page refresh). No manual sync needed.
- **API Key Security:** API keys are never committed to git. Use `.env` files and the admin panel. The `.env.example` files contain templates without real keys.

---

## License

Proprietary - All rights reserved.
