# GuessIt — Football Prediction Platform

**Predict match outcomes. Compete with fans. Track your accuracy.**

A real-time football prediction platform powered by live data from [Football-Data.org](https://www.football-data.org/), built with React 19, FastAPI, and MongoDB.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://www.python.org/)

---

> **⚠️ IMPORTANT — READ BEFORE CLONING / DEPLOYING**
>
> This project requires a **Football-Data.org API key** to display matches, scores, and live data. Without this key, the app will show **"No matches found"** on the main page.
>
> **Setup after cloning:**
>
> 1. Get a free API token at [https://www.football-data.org/client/register](https://www.football-data.org/client/register)
> 2. Add it to `/app/backend/.env`:
>    ```
>    FOOTBALL_API_KEY="your_api_token_here"
>    ```
> 3. Restart the backend: `sudo supervisorctl restart backend`
>
> The API uses the `X-Auth-Token` HTTP header internally. Free tier allows **10 requests/minute** and includes: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, World Cup, and European Championship.

---

## 📋 Table of Contents

- [Getting Started (Local Setup)](#getting-started-local-setup)
- [Features Overview](#features-overview)
- [Admin Panel](#admin-panel)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Real-Time Features](#real-time-features)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🚀 Getting Started (Local Setup)

### Prerequisites

- **Node.js** 18+ and **Yarn** (for frontend)
- **Python** 3.11+ (for backend)
- **MongoDB** 6+ (local or Atlas)
- **Football-Data.org API key** (free, [register here](https://www.football-data.org/client/register))

### 1. Clone the Repository

```bash
git clone https://github.com/Farhad-Iskandarov/guess.it.git
cd guess.it
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=guessit
CORS_ORIGINS=*
FOOTBALL_API_KEY=your_football_data_api_key_here
EOF

# Start MongoDB (if not running)
# For Mac: brew services start mongodb-community
# For Linux: sudo systemctl start mongod
# For Windows: net start MongoDB

# Run the backend server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The backend will be available at `http://localhost:8001`.  
API docs available at `http://localhost:8001/docs` (Swagger UI).

### 3. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
ENABLE_HEALTH_CHECK=false
EOF

# Start development server
yarn start
```

The frontend will be available at `http://localhost:3000`.

### 4. Create an Admin Account

```bash
# Connect to MongoDB
mongosh guessit

# Register a new account via the UI first, then promote to admin:
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

### 5. Verify Everything Works

1. Open `http://localhost:3000`
2. Register a new account or login
3. Check if matches are loading (requires FOOTBALL_API_KEY)
4. Make a prediction
5. Access Admin Panel (if you set admin role)

---

## ✨ Features Overview

### 🎯 Core Features

- **Live Match Predictions** - Predict outcomes for upcoming football matches
- **Real-Time Updates** - WebSocket-powered live scores and match status
- **Points & Levels System** - Earn +10 points for correct predictions, -5 for wrong ones
- **Global Leaderboard** - Compete with players worldwide
- **Friend System** - Add friends, compare predictions, and chat
- **Prediction Streaks** - Track your winning and losing streaks
- **Favorite Teams** - Quick access to your favorite teams' matches
- **Dark/Light Mode** - Customizable theme for comfortable viewing
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile

### 📱 User Pages

- **Home** - Browse live and upcoming matches with filters
- **How It Works** - Step-by-step guide for new users
- **Leaderboard** - Global rankings with top predictors
- **About Us** - Mission, values, and platform stats
- **News** - Latest updates and feature announcements
- **Contact** - Get support via form or contact methods
- **Profile** - View stats, predictions, and customize settings
- **My Predictions** - Track all your predictions and results
- **Friends** - Manage friend requests and friendships
- **Messages** - Real-time chat with friends

### 🛡️ Admin Panel

Comprehensive admin dashboard with 9 tabs:

#### 1. **Dashboard**
- System overview
- Recent user activity
- Quick stats

#### 2. **Users Management**
- View all users
- Ban/unban users
- Change user passwords
- View user details (stats, predictions, friends)
- **View User Predictions** with match cards and search

#### 3. **Matches Management**
- Pin/unpin matches to featured section
- Hide matches from public view
- View match predictions

#### 4. **🆕 Carousel Banners**
- **Upload banner images** from local device
- Edit existing banners (replace image, change text)
- Delete banners
- Enable/disable banner visibility
- Set display order
- Images stored at `/api/uploads/banners/`
- Supports JPG, PNG, WebP, GIF (max 5MB)

#### 5. **System Settings**
- **API Key Management** (Football-Data.org)
- Add multiple API keys
- Enable/disable keys
- Set default API key
- View API usage

#### 6. **Prediction Monitor**
- Track user prediction streaks
- View most accurate predictors

#### 7. **Favorites**
- Manage favorite users (internal admin feature)

#### 8. **Notifications**
- Send system-wide notifications
- Broadcast important announcements

#### 9. **Analytics**
- User activity charts
- Top predictors
- Points distribution
- Engagement metrics

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19
- **Routing:** React Router DOM v6
- **Styling:** Tailwind CSS + Shadcn/UI components
- **State Management:** React Context API
- **Build Tool:** CRACO (Create React App Configuration Override)
- **HTTP Client:** Fetch API
- **WebSocket:** Native WebSocket API
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI (Python)
- **Database Driver:** Motor (async MongoDB)
- **Authentication:** JWT + Session tokens
- **Password Hashing:** bcrypt
- **WebSocket:** FastAPI WebSockets
- **External API:** Football-Data.org
- **CORS:** FastAPI CORS middleware
- **Rate Limiting:** Custom implementation

### Database
- **Type:** MongoDB 6+
- **Collections:** users, predictions, user_sessions, friendships, messages, notifications, favorite_matches, carousel_banners, admin_api_configs, admin_audit_log, reported_messages, pinned_matches, hidden_matches

### Infrastructure
- **Process Manager:** Supervisor
- **Web Server:** Uvicorn (ASGI)
- **Static Files:** FastAPI StaticFiles

---

## 📁 Project Structure

```
/app/
├── backend/                      # FastAPI backend
│   ├── models/
│   │   ├── auth.py              # User & session models
│   │   └── prediction.py        # Prediction model
│   ├── routes/
│   │   ├── admin.py             # Admin panel routes (9 tabs)
│   │   ├── auth.py              # Authentication routes
│   │   ├── favorites.py         # Favorite matches
│   │   ├── football.py          # Match data & WebSocket
│   │   ├── friends.py           # Friend system & WebSocket
│   │   ├── messages.py          # Messaging & WebSocket
│   │   ├── notifications.py     # Notifications & WebSocket
│   │   ├── predictions.py       # Prediction CRUD
│   │   └── settings.py          # User settings
│   ├── services/
│   │   └── football_api.py      # Football-Data.org integration
│   ├── uploads/
│   │   ├── avatars/             # User profile pictures
│   │   └── banners/             # Carousel banner images
│   ├── server.py                # Main FastAPI app
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Environment variables
│
├── frontend/                     # React frontend
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Header, Footer
│   │   │   ├── home/            # Match cards, banners, filters
│   │   │   └── ui/              # Shadcn/UI components (46+)
│   │   ├── pages/
│   │   │   ├── HomePage.jsx     # Main matches page
│   │   │   ├── HowItWorksPage.jsx
│   │   │   ├── LeaderboardPage.jsx
│   │   │   ├── AboutPage.jsx
│   │   │   ├── NewsPage.jsx
│   │   │   ├── ContactPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── MyPredictionsPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── FriendsPage.jsx
│   │   │   ├── MessagesPage.jsx
│   │   │   ├── AdminPage.jsx    # Admin dashboard (9 tabs)
│   │   │   └── GuestProfilePage.jsx
│   │   ├── lib/
│   │   │   ├── AuthContext.jsx  # Auth state management
│   │   │   ├── ThemeContext.jsx # Dark/light mode
│   │   │   ├── FriendsContext.jsx
│   │   │   └── MessagesContext.jsx
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API clients
│   │   ├── App.js               # Main app & routing
│   │   └── index.js             # Entry point
│   ├── package.json             # Node dependencies
│   ├── tailwind.config.js       # Tailwind configuration
│   └── .env                     # Frontend environment variables
│
├── tests/                        # Test files
├── test_reports/                 # Testing reports
├── memory/                       # App memory/state
└── README.md                     # This file
```

---

## 🔐 Environment Variables

### Backend (`/app/backend/.env`)

```bash
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=guessit

# CORS (for development, use specific origins in production)
CORS_ORIGINS=*

# Football-Data.org API Key (required)
FOOTBALL_API_KEY=your_api_key_here
```

### Frontend (`/app/frontend/.env`)

```bash
# Backend API URL
REACT_APP_BACKEND_URL=http://localhost:8001

# WebSocket port (for development)
WDS_SOCKET_PORT=3000

# Health check (disable for production)
ENABLE_HEALTH_CHECK=false
```

---

## 📡 API Documentation

### Public Endpoints

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

**Matches:**
- `GET /api/football/matches` - Get matches (filters: date_from, date_to, competition, status)
- `GET /api/football/matches/today` - Get today's matches
- `GET /api/football/matches/live` - Get live matches
- `GET /api/football/matches/ended` - Get finished matches (last 24h)
- `GET /api/football/leaderboard` - Get global leaderboard
- `GET /api/football/banners` - Get active carousel banners
- `WS /api/ws/matches` - WebSocket for live match updates

**Predictions:**
- `GET /api/predictions` - Get user's predictions
- `POST /api/predictions` - Create prediction
- `GET /api/predictions/stats` - Get prediction statistics

**Friends:**
- `GET /api/friends` - Get friends list
- `POST /api/friends/request` - Send friend request
- `POST /api/friends/accept/{user_id}` - Accept friend request
- `DELETE /api/friends/{user_id}` - Remove friend
- `WS /api/ws/friends/{user_id}` - WebSocket for friend updates

**Messages:**
- `GET /api/messages/{user_id}` - Get chat messages
- `POST /api/messages/send` - Send message
- `WS /api/ws/chat/{user_id}` - WebSocket for real-time chat

**Favorites:**
- `GET /api/favorites` - Get favorite matches
- `POST /api/favorites` - Add favorite match
- `DELETE /api/favorites/{match_id}` - Remove favorite

**Settings:**
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/upload-avatar` - Upload profile picture

### Admin Endpoints (Requires `role: "admin"`)

**Users:**
- `GET /api/admin/users` - List all users (paginated)
- `GET /api/admin/users/{user_id}` - Get user details
- `GET /api/admin/users/{user_id}/predictions` - Get user predictions with match enrichment
- `POST /api/admin/users/{user_id}/ban` - Ban user
- `POST /api/admin/users/{user_id}/unban` - Unban user
- `POST /api/admin/users/{user_id}/change-password` - Change user password

**Carousel Banners:**
- `GET /api/admin/banners` - List all banners
- `POST /api/admin/banners` - Create banner (upload image)
- `PUT /api/admin/banners/{banner_id}` - Update banner
- `DELETE /api/admin/banners/{banner_id}` - Delete banner
- `POST /api/admin/banners/{banner_id}/toggle` - Enable/disable banner

**System:**
- `GET /api/admin/system/apis` - List API keys
- `POST /api/admin/system/apis` - Add API key
- `POST /api/admin/system/apis/{api_id}/toggle` - Enable/disable API
- `POST /api/admin/system/apis/{api_id}/activate` - Set as active
- `DELETE /api/admin/system/apis/{api_id}` - Delete API key

**Other Admin:**
- Matches, notifications, analytics, audit logs, etc.

---

## 🗄️ Database Schema

### Key Collections

**users**
- user_id, email, password_hash, nickname, picture
- points, level, experience
- predictions_count, correct_predictions
- role (admin/user), is_banned, is_online
- created_at, last_seen

**predictions**
- prediction_id, user_id, match_id
- prediction (home/draw/away)
- result (correct/wrong/pending)
- points_value, points_awarded_at
- created_at

**carousel_banners**
- banner_id, title, subtitle
- button_text, button_link
- image_url, order
- is_active, created_by, created_at

**admin_api_configs**
- api_id, name, base_url, api_key
- enabled, is_active
- created_at, created_by

**friendships**
- user_id, friend_id
- status (pending/accepted)
- created_at

**messages**
- sender_id, receiver_id, message
- read, delivered
- created_at

---

## ⚡ Real-Time Features

The app uses **WebSockets** for real-time updates:

1. **Live Match Updates** (`/api/ws/matches`)
   - Score changes
   - Match status (live, finished, postponed)
   - Auto-updates every 30 seconds

2. **Friend System** (`/api/ws/friends/{user_id}`)
   - Friend requests
   - Online status
   - Friend activity

3. **Real-Time Chat** (`/api/ws/chat/{user_id}`)
   - Instant messaging
   - Read receipts
   - Typing indicators

4. **Notifications** (`/api/ws/notifications/{user_id}`)
   - System notifications
   - Friend requests
   - Match results

---

## 🚢 Deployment

### Supervisor Configuration

The app uses Supervisor to manage processes:

```bash
# Check status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart all
```

### Production Checklist

- [ ] Set `CORS_ORIGINS` to specific domains
- [ ] Use strong MongoDB credentials
- [ ] Enable HTTPS
- [ ] Set `ENABLE_HEALTH_CHECK=true`
- [ ] Configure proper logging
- [ ] Set up MongoDB backups
- [ ] Monitor API rate limits (Football-Data.org)
- [ ] Use environment-specific `.env` files

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- [Football-Data.org](https://www.football-data.org/) - Match data API
- [Shadcn/UI](https://ui.shadcn.com/) - UI components
- [Lucide](https://lucide.dev/) - Icons
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://reactjs.org/) - Frontend framework

---

## 📞 Support

- **Email:** support@guessit.com
- **Issues:** [GitHub Issues](https://github.com/Farhad-Iskandarov/guess.it/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Farhad-Iskandarov/guess.it/discussions)

---

**Built with ❤️ by football fans, for football fans.**

* * *

## Getting Started (Local Setup)

[Permalink: Getting Started (Local Setup)](#getting-started-local-setup)

### Prerequisites

- **Node.js** 18+ and **Yarn** (for frontend)
- **Python** 3.11+ (for backend)
- **MongoDB** 6+ (local or Atlas)
- **Football-Data.org API key** (free, [register here](https://www.football-data.org/client/register))

### 1. Clone the Repository

```bash
git clone https://github.com/Farhad-Iskandarov/guess.it.git
cd guess.it
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=guessit
CORS_ORIGINS=*
FOOTBALL_API_KEY=your_football_data_api_key_here
EOF

# Start MongoDB (if not running)
# For Mac: brew services start mongodb-community
# For Linux: sudo systemctl start mongod
# For Windows: net start MongoDB

# Run the backend server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The backend will be available at `http://localhost:8001`.  
API docs available at `http://localhost:8001/docs` (Swagger UI).

### 3. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
ENABLE_HEALTH_CHECK=false
EOF

# Start development server
yarn start
```

The frontend will be available at `http://localhost:3000`.

### 4. Create an Admin Account

```bash
# Connect to MongoDB
mongosh guessit

# Promote a user to admin (replace email with your registered account)
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

### 5. Verify Everything Works

1. Open `http://localhost:3000`
2. Register a new account or login
3. Check if matches are loading (requires FOOTBALL_API_KEY)
4. Make a prediction
5. Access Admin Panel (if you set admin role)

* * *

## Project Overview

### User Features
- User registration & login (email + Google Auth)
- Football match browsing by league (Premier League, La Liga, UCL, Serie A, Bundesliga, Ligue 1)
- Match predictions (Home/Draw/Away)
- Points & leveling system (10+ levels)
- Friends system with real-time friend requests
- Real-time messaging between friends (WebSocket)
- User profiles with avatar upload
- Notification system (real-time via WebSocket)
- Dark/Light theme toggle
- Global match search

### Admin Panel (v2 - Enhanced)

#### 1. Hidden Admin Access
- Admin role is completely invisible to regular users
- No admin badge, role label, or exposed data in frontend responses
- Access link disguised as "Settings & Tools" in user dropdown
- Non-admin users see "Page Not Found" when accessing /admin

#### 2. User Message Review
- Eye icon next to each user in the Users section
- Admin can view all conversations of any user (read-only)
- Full chat history between any two users visible
- No separate "Moderation" section needed

#### 3. Full Admin Visibility
- Admin can see everything about any user:
  - Profile data, Points, Level
  - Predictions count (correct/wrong)
  - Friends list
  - Messages sent/received counts
  - Notifications count
  - Pending friend requests (in/out)
  - Active sessions
  - Account activity and status

#### 4. Admin Password Change
- Admin can reset any user's password
- No need for user's current password
- All user sessions invalidated after password change
- Action logged in audit log

#### 5. Advanced User Filters
- Filter by: All Users, Online, Offline, Banned
- Clear filter chip controls
- Combinable with search

#### 6. Sort by Points
- Users sorted by points (descending) by default
- Highest points appear at the top

#### 7. System - API Management
- Add new football data APIs
- Enable/Disable APIs
- Select which API is active
- Switch APIs without losing user data
- No match, prediction, or point data lost when switching

#### 8. Prediction Streak Monitoring
- View users with 10+ consecutive correct predictions
- See their upcoming match predictions
- Configurable minimum streak threshold (5, 10, 15, 20)
- Helps detect prediction patterns and trends

#### 9. Favorite Users
- Mark users as "Favorite" for quick access
- Add/remove users from favorites list
- Search and add any user
- Visible only to admin

#### Audit Logging
- All admin actions are logged
- Timestamps, admin identity, action type, target
- Searchable audit log

### Admin Panel Tabs
1. **Dashboard** - Overview stats, system status, recent admin actions
2. **Users** - User management with filters, sort, search, action icons
3. **Matches** - Match management, pin/unpin, hide, force refresh
4. **System** - API management (add/enable/disable/activate APIs)
5. **Prediction Monitor** - Streak detection and monitoring
6. **Favorites** - Admin's favorite users list
7. **Notifications** - Broadcast and targeted notifications
8. **Analytics** - Charts, top predictors, points distribution

## API Endpoints

### Auth (`/api/auth/`)
- POST `/register` - Register with email/password
- POST `/login` - Login with email/password
- GET `/me` - Get current user
- POST `/logout` - Logout
- POST `/nickname` - Set nickname
- GET `/google/init` - Start Google OAuth
- POST `/google/callback` - Handle Google OAuth callback

### Football (`/api/football/`)
- GET `/matches` - Get matches with filters
- GET `/matches/search` - Search matches
- WS `/ws/matches` - Live match updates

### Predictions (`/api/predictions/`)
- POST `` - Create/update prediction
- GET `/me` - Get user's predictions
- GET `/me/detailed` - Get detailed predictions with match data
- GET `/match/{match_id}` - Get prediction for specific match
- DELETE `/match/{match_id}` - Delete prediction

### Friends (`/api/friends/`)
- POST `/request` - Send friend request
- GET `/requests/pending` - Get pending requests
- POST `/request/{id}/accept` - Accept request
- POST `/request/{id}/decline` - Decline request
- GET `/list` - Get friends list
- DELETE `/{friend_id}` - Remove friend
- GET `/search` - Search users

### Messages (`/api/messages/`)
- POST `/send` - Send message
- GET `/conversations` - Get conversations
- GET `/history/{friend_id}` - Get chat history
- POST `/read/{friend_id}` - Mark messages read
- WS `/ws/chat` - Real-time chat
- WS `/ws/notifications` - Real-time notifications

### Admin (`/api/admin/`)
- GET `/dashboard` - Dashboard stats
- GET `/users` - List users (filters, sort, search)
- GET `/users/{id}` - Full user detail
- GET `/users/{id}/conversations` - User's conversations
- GET `/users/{id}/messages/{other_id}` - Specific conversation
- POST `/users/{id}/change-password` - Change user password
- POST `/users/{id}/ban` - Ban user
- POST `/users/{id}/unban` - Unban user
- DELETE `/users/{id}` - Delete user
- POST `/users/{id}/promote` - Promote to admin
- POST `/users/{id}/demote` - Demote from admin
- POST `/users/{id}/reset-points` - Reset points
- GET `/matches` - Admin match list
- POST `/matches/refresh` - Force refresh matches
- POST `/matches/{id}/pin` - Pin/unpin match
- GET `/system/apis` - List API configs
- POST `/system/apis` - Add API config
- POST `/system/apis/{id}/toggle` - Enable/disable API
- POST `/system/apis/{id}/activate` - Set active API
- DELETE `/system/apis/{id}` - Delete API config
- GET `/prediction-streaks` - Streak monitoring
- GET `/favorite-users` - List favorites
- POST `/favorite-users/{id}` - Add to favorites
- DELETE `/favorite-users/{id}` - Remove from favorites
- POST `/notifications/broadcast` - Broadcast notification
- POST `/notifications/send` - Send to user
- GET `/analytics` - Analytics data
- GET `/audit-log` - Audit log

## Environment Variables
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `FOOTBALL_API_KEY` - Football-Data.org API key
- `REACT_APP_BACKEND_URL` - Backend URL for frontend

## Running
- Backend: FastAPI on port 8001 (via supervisor)
- Frontend: React on port 3000 (via supervisor)
- Both managed by supervisor with hot reload
