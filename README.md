# GuessIt - Football Prediction Platform

A social football prediction platform where fans analyze, predict, and compete with friends.

---

## Tech Stack

- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB driver), Pydantic v2
- **Database:** MongoDB
- **Real-time:** WebSockets (live matches, chat, notifications)
- **Auth:** Session-based (httpOnly cookies) + Google OAuth via Emergent Auth
- **Football Data:** football-data.org API (v4)

---

## Features

### Core Features
- User registration & login (email + Google OAuth)
- Live football match browsing (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UCL)
- Match predictions with points system
- Leaderboard (global rankings)
- Friends system (send/accept/decline requests)
- Real-time messaging & chat
- In-app notifications
- User profiles with avatar & banner uploads
- Favorite matches
- Dark/Light theme toggle

### Content Features
- **News/Blog system** (admin-managed, with article detail pages and related articles)
- **Email subscriptions** (footer newsletter signup)
- **Contact form** (saves to backend, viewable in admin)
- **Editable contact info** (admin-controlled email, location)

### Advanced Prediction Features (NEW - Feb 2026)
- **Exact Score Predictions** - Predict exact match scores for +50 bonus points
- **Advanced Match Options** - Expandable section with enhanced prediction features
- **Configurable Points System** - Admin can configure all point values dynamically

### Subscription System (NEW - Feb 2026)
- **3 Premium Plans** - Standard ($4.99/mo), Champion ($9.99/mo), Elite ($19.99/mo)
- **Stripe Payment Integration** - Secure checkout with Stripe (test mode)
- **Subscription Management** - Users can subscribe, view active plan, cancel
- **Premium Badges** - Visual subscription tier badges on user profiles
- **Admin Plan Management** - Edit prices, features, toggle plans on/off

### Chat & Social Improvements (NEW - Feb 2026)
- **Expandable Match Cards in Chat** - Clicking a shared match card expands it in-place with full prediction UI (vote, exact score) instead of redirecting
- **Invite Friend via Match Card** - Sending a guess invite from Advanced section now sends the actual match card in chat
- **Visual Prediction Types** - Green background = normal winner prediction, Orange background = exact score prediction

---

## Recent Updates (February 2026)

### Exact Score Prediction UI Fix (Latest)
- Fixed exact score prediction only updating the specific match card (not all cards)
- Added visual differentiation: Green = winner prediction, Orange = exact score prediction
- Mutual exclusivity per match: exact score locks out 1/X/2 votes and vice versa
- Remove button clears BOTH normal prediction and exact score for that match only
- Advance button disabled when normal prediction already saved (mutual exclusivity)
- GuessItButton shows "Saved" with light orange for exact score, light green for normal guess
- Backend: DELETE /api/predictions/exact-score/match/{id} endpoint for removing exact scores
- Chat expanded match cards also show amber/orange styling for locked exact scores
- +50 points auto-awarded when exact score matches final result (processed once, notifications sent)
- State persists correctly after page refresh

### Subscription System ✅
- New `/subscribe` page with 3 premium plans (Standard, Champion, Elite)
- Stripe integration for secure payment checkout
- Admin can manage plans (edit prices, features, toggle active/inactive)
- Dashboard shows subscription overview (total subscribers, revenue, per-plan stats)

### Chat Match Card Fix ✅
- Match cards shared in chat now expand in-place with smooth animation
- Full prediction UI (vote 1/X/2, exact score) works directly inside chat
- No page redirect or reload

### Invite Friend Fix ✅
- Invite from Advanced section sends actual match card in chat (not just text)
- Consistent with chat card sharing system

### P0: Admin Account Persistence ✅
- Admin account auto-seeds on server startup
- Credentials: `farhad.isgandar@gmail.com` / `Salam123?`

### P1: Advanced Section Foundation ✅
- Animated expand/collapse "Advanced" section on match cards
- Smooth transitions and modern UI

### P1: Exact Score Prediction ✅
- Users can predict exact final scores
- +50 bonus points for correct exact score predictions
- One-time lock (cannot be changed after submission)
- API: `POST /api/predictions/exact-score`

### P1: Admin Points Management ✅
- New "Points Settings" tab in admin panel
- Configurable values:
  - Correct prediction points (default: 10)
  - Wrong prediction penalty (default: 5)
  - Exact score bonus (default: 50)
  - Penalty minimum level (default: 5)
  - Level thresholds (11 levels, 0-10)
- Save and Reset to Defaults functionality

### Bug Fixes ✅
- Fixed Football API key issue (typo: letter O vs number 0)
- Fixed profile picture caching issue

---

## Admin Panel Access

The Admin Panel has a dedicated, secure login page hidden from the regular UI.

### How to access:

1. Open your browser and go to: `/itguess/admin/login`
2. Enter the admin credentials:
   - **Email:** `farhad.isgandar@gmail.com`
   - **Password:** `Salam123?`
3. Click **"Sign In to Admin Panel"**
4. You will be redirected to the Admin Dashboard

### Admin Panel Tabs:

| Tab | Description |
|---|---|
| Dashboard | Overview stats, recent activity, audit log, **subscription overview** |
| Users | Manage users (ban, promote, view) |
| Matches | Match management and live match control |
| **Points Settings** | Configure prediction points, penalties, bonuses |
| Carousel Banners | Homepage banner image management |
| News | Create, edit, delete, publish/unpublish news articles |
| **Subscription Plans** | Manage premium plans: edit prices, features, toggle active/inactive (NEW) |
| Subscribed Emails | View and manage newsletter subscriptions |
| Contact Messages | View, flag, and delete contact form submissions |
| Contact Settings | Edit support email, location info shown on Contact page |
| System | API configuration and system settings |
| Prediction Monitor | Monitor prediction streaks |
| Favorites | View user favorite matches |
| Notifications | Send notifications |
| Analytics | Platform analytics and charts |

---

## Project Structure

```
/app
├── backend/
│   ├── server.py              # Main FastAPI app, WebSocket endpoints, Admin seeding
│   ├── .env                   # Environment variables
│   ├── requirements.txt       # Python dependencies
│   ├── models/
│   │   ├── auth.py            # User models
│   │   ├── prediction.py      # Prediction + ExactScore models
│   │   └── points_config.py   # Points configuration model (NEW)
│   ├── routes/
│   │   ├── auth.py            # Register, Login, Google OAuth, Nickname
│   │   ├── admin.py           # Admin panel (all management + points config)
│   │   ├── public.py          # Subscribe, Contact, Contact Settings, News (public)
│   │   ├── predictions.py     # Match predictions + exact score predictions
│   │   ├── football.py        # Football API, live polling, banners
│   │   ├── favorites.py       # Favorite matches
│   │   ├── friends.py         # Friend requests & friendships
│   │   ├── messages.py        # Real-time chat messaging
│   │   ├── notifications.py   # In-app notifications
│   │   └── settings.py        # User settings
│   ├── services/
│   │   └── football_api.py    # Football-data.org API service
│   ├── tests/
│   │   └── test_p0_p1_features.py  # P0/P1 feature tests
│   └── uploads/               # User avatars, banners, news images
├── frontend/
│   ├── src/
│   │   ├── App.js             # Routes, AdminRoute, PublicLayout
│   │   ├── pages/
│   │   │   ├── AdminLoginPage.jsx    # Dedicated admin login
│   │   │   ├── AdminPage.jsx         # Admin dashboard (all tabs + Points Settings)
│   │   │   ├── HomePage.jsx          # Main page with matches
│   │   │   ├── NewsPage.jsx          # Dynamic news list
│   │   │   ├── NewsArticlePage.jsx   # Individual news article view
│   │   │   ├── ContactPage.jsx       # Contact form + dynamic info
│   │   │   ├── LoginPage.jsx         # Regular user login
│   │   │   └── ...                   # Other pages
│   │   ├── components/
│   │   │   ├── layout/        # Header, Footer (with working subscribe)
│   │   │   ├── home/          
│   │   │   │   ├── MatchList.jsx     # Match cards with Advanced modal (NEW)
│   │   │   │   └── MatchCard.jsx     # Alternative match card component
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── lib/               # AuthContext, FriendsContext, etc.
│   │   └── services/
│   │       ├── predictions.js  # Prediction API + exact score functions (NEW)
│   │       └── ...            # Other services
│   └── .env                   # Frontend env
├── memory/
│   └── PRD.md                 # Product requirements document
└── test_reports/
    ├── iteration_1.json       # Initial test results
    └── iteration_2.json       # P0/P1 test results (100% pass)
```

---

## API Endpoints

### Public
- `POST /api/subscribe` — Subscribe to newsletter
- `POST /api/contact` — Submit contact form
- `GET /api/contact-settings` — Get public contact info
- `GET /api/news` — List published news articles
- `GET /api/news/{article_id}` — Get single article + related

### Auth
- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user
- `POST /api/auth/logout` — Logout

### Predictions
- `POST /api/predictions` — Create/update prediction
- `GET /api/predictions/me` — Get user's predictions
- `GET /api/predictions/me/detailed` — Get detailed predictions with match data
- `DELETE /api/predictions/match/{match_id}` — Delete prediction
- **`POST /api/predictions/exact-score`** — Create exact score prediction (NEW)
- **`GET /api/predictions/exact-score/match/{match_id}`** — Get exact score for match (NEW)
- **`GET /api/predictions/exact-score/me`** — Get all exact score predictions (NEW)

### Admin (requires `role: admin`)
- `GET /api/admin/dashboard` — Dashboard stats
- `GET/POST/PUT/DELETE /api/admin/news` — News CRUD
- `PUT /api/admin/news/{id}/toggle` — Publish/unpublish
- `GET/DELETE /api/admin/subscriptions` — Subscription management
- `GET/PUT/DELETE /api/admin/contact-messages` — Contact messages
- `GET/PUT /api/admin/contact-settings` — Contact settings
- `GET/POST/PUT/DELETE /api/admin/banners` — Banner management
- `GET /api/admin/users` — User management
- `GET /api/admin/analytics` — Analytics
- **`GET /api/admin/points-config`** — Get points configuration (NEW)
- **`PUT /api/admin/points-config`** — Update points configuration (NEW)
- **`POST /api/admin/points-config/reset`** — Reset to defaults (NEW)

### Football
- `GET /api/football/matches` — Get matches
- `GET /api/football/banners` — Get active banners
- `WS /api/ws/matches` — Live match updates

---

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
SECRET_KEY=your-secret-key
FOOTBALL_API_KEY=your-football-data-api-key
ALLOWED_ORIGINS=*
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-app.preview.emergentagent.com
```

---

## Running the Application

### Development
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
yarn install
yarn start
```

### Production
The application is deployed on Emergent Platform with:
- Backend on port 8001 (supervised)
- Frontend on port 3000 (supervised)
- MongoDB local instance
- Nginx reverse proxy

---

## Upcoming Features (P2)

1. **Prediction Result Notifications** - Notify users when their predictions resolve
2. **Invite Friend to Guess** - Share matches with friends via notifications & chat
3. **Friends Activity on Match Card** - See which friends predicted on a match
4. **Profile Privacy Settings** - Control profile visibility
5. **Smart Advice** - Get prediction tips from top performers

---

## License

Proprietary - All rights reserved.
