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

- User registration & login (email + Google OAuth)
- Live football match browsing (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UCL)
- Match predictions with points system
- Leaderboard (global rankings)
- Friends system (send/accept/decline requests)
- Real-time messaging & chat
- In-app notifications
- User profiles with avatar & banner uploads
- Favorite matches
- **News/Blog system** (admin-managed, with article detail pages and related articles)
- **Email subscriptions** (footer newsletter signup)
- **Contact form** (saves to backend, viewable in admin)
- **Editable contact info** (admin-controlled email, location)
- Admin panel (user management, match management, analytics, API config, banners, news, subscriptions, contact messages, contact settings, audit log)
- Dark/Light theme toggle
- Consistent header/footer across all pages

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
| Dashboard | Overview stats, recent activity, audit log |
| Users | Manage users (ban, promote, view) |
| Matches | Match management and live match control |
| Carousel Banners | Homepage banner image management |
| **News** | Create, edit, delete, publish/unpublish news articles |
| **Subscribed Emails** | View and manage newsletter subscriptions |
| **Contact Messages** | View, flag, and delete contact form submissions |
| **Contact Settings** | Edit support email, location info shown on Contact page |
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
│   ├── server.py              # Main FastAPI app, WebSocket endpoints
│   ├── .env                   # Environment variables
│   ├── requirements.txt       # Python dependencies
│   ├── models/                # Pydantic models
│   ├── routes/
│   │   ├── auth.py            # Register, Login, Google OAuth, Nickname
│   │   ├── admin.py           # Admin panel (all management endpoints)
│   │   ├── public.py          # Subscribe, Contact, Contact Settings, News (public)
│   │   ├── predictions.py     # Match predictions
│   │   ├── football.py        # Football API, live polling, banners
│   │   ├── favorites.py       # Favorite matches
│   │   ├── friends.py         # Friend requests & friendships
│   │   ├── messages.py        # Real-time chat messaging
│   │   ├── notifications.py   # In-app notifications
│   │   └── settings.py        # User settings
│   ├── services/
│   │   └── football_api.py    # Football-data.org API service
│   └── uploads/               # User avatars, banners, news images
├── frontend/
│   ├── src/
│   │   ├── App.js             # Routes, AdminRoute, PublicLayout
│   │   ├── pages/
│   │   │   ├── AdminLoginPage.jsx    # Dedicated admin login
│   │   │   ├── AdminPage.jsx         # Admin dashboard (all tabs)
│   │   │   ├── HomePage.jsx          # Main page with matches
│   │   │   ├── NewsPage.jsx          # Dynamic news list
│   │   │   ├── NewsArticlePage.jsx   # Individual news article view
│   │   │   ├── ContactPage.jsx       # Contact form + dynamic info
│   │   │   ├── LoginPage.jsx         # Regular user login
│   │   │   └── ...                   # Other pages
│   │   ├── components/
│   │   │   ├── layout/        # Header, Footer (with working subscribe)
│   │   │   ├── home/          # MatchCard, PromoBanner, etc.
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── lib/               # AuthContext, FriendsContext, etc.
│   │   └── services/          # API service functions
│   └── .env                   # Frontend env
└── memory/
    └── PRD.md                 # Product requirements document
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

### Football
- `GET /api/football/matches` — Get matches
- `GET /api/football/banners` — Get active banners
- `WS /api/ws/matches` — Live match updates
