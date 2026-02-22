# Guess.it - Sports Prediction Platform

## Original Problem Statement
Clone the project from https://github.com/Farhad-Iskandarov/guess.it and implement new features for a sports prediction platform.

## User Personas
- **Regular Users**: Predict match outcomes, earn points, compete with friends
- **Admin Users**: Manage platform settings, users, points configuration

---

## Completed Work

### December 2025 - Initial Clone & Bug Fix
- ✅ Cloned project from GitHub
- ✅ Fixed profile picture save bug
- ✅ Fixed Football API key issue (typo: letter O vs number 0)

### February 2026 - P0 & P1 Features ✅

#### P0: Admin Account Persistence
- Admin account (farhad.isgandar@gmail.com) auto-seeds on server startup
- **Files**: `backend/server.py`

#### P1: Match Card Advanced Section
- Animated expand/collapse "Advanced" section with 4 tabs
- **Files**: `frontend/src/components/home/MatchList.jsx`

#### P1: Exact Score Prediction (+50 Bonus)
- Users can predict exact final scores for bonus points
- One-time lock (cannot be changed after submission)
- **API**: POST/GET `/api/predictions/exact-score`
- **Files**: `backend/routes/predictions.py`, `backend/models/prediction.py`

#### P1: Admin Points Management
- "Points Settings" tab in admin panel
- Configurable: correct points, penalty, exact bonus, level thresholds
- **API**: GET/PUT `/api/admin/points-config`
- **Files**: `backend/routes/admin.py`, `backend/models/points_config.py`

### February 2026 - P2 Features ✅

#### P2.1: Prediction Result Notifications ✅
- In-app notifications when match finishes
- ✅ Correct prediction: "Correct! [Match] finished [score]. You earned +X points!"
- ❌ Wrong prediction: "Wrong prediction. [Match] finished [score]."
- Notifications sent when points are awarded
- **Files**: `backend/routes/predictions.py` (lines 365-430)

#### P2.2: Invite Friend to Guess ✅
- Full invitation flow from Advanced section
- Creates notification AND chat message
- Prevents duplicate invitations for same match
- **API**: 
  - POST `/api/friends/invite/match`
  - GET `/api/friends/invitations/received`
  - POST `/api/friends/invitations/{id}/dismiss`
- **Files**: `backend/routes/friends.py`, `backend/routes/messages.py`

#### P2.3: Smart Advice ✅
- Get prediction from top-performing users (10+ correct in 30 days)
- Randomly selects from qualified users
- Message format: "[User] who guessed last X matches correctly thinks [prediction]"
- **API**: GET `/api/predictions/smart-advice/{match_id}`
- **Files**: `backend/routes/predictions.py` (lines 590-665)

#### P2.4: Friends Activity on Match Card ✅
- Shows friends' profile pictures and predictions on match cards
- Only visible if users are friends
- Respects privacy settings
- **API**: GET `/api/predictions/match/{match_id}/friends-activity`
- **Files**: `backend/routes/predictions.py` (lines 670-720)

---

## Remaining P2 Tasks

### P2.5: Profile Privacy Settings (TODO)
- Add toggle in user settings
- When enabled: full profile visible
- When disabled: show only picture, points, level, friendship button, "Profile is private" text

---

## Technical Architecture

### Stack
- **Frontend**: React + Vite, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT cookies, Google OAuth
- **Real-time**: WebSockets (matches, chat, notifications)

### Key Files
- `backend/server.py` - Main server, admin seeding
- `backend/routes/predictions.py` - All prediction APIs + smart advice + friends activity
- `backend/routes/friends.py` - Friends + match invitations
- `backend/routes/admin.py` - Admin panel APIs
- `frontend/src/components/home/MatchList.jsx` - Match cards with Advanced modal
- `frontend/src/pages/AdminPage.jsx` - Admin panel with Points Settings

### Database Collections
- `users` - User accounts
- `predictions` - Match predictions
- `exact_score_predictions` - Exact score bonus predictions
- `points_config` - Admin-configured points values
- `match_invitations` - Match prediction invitations
- `notifications` - User notifications

---

## Credentials
- **Admin**: farhad.isgandar@gmail.com / Salam123?
- **Football API Key**: In `backend/.env` as FOOTBALL_API_KEY

## Test Reports
- `/app/test_reports/iteration_2.json` - P0 & P1 tests (100% pass)
- `/app/test_reports/iteration_3.json` - P2 tests (100% pass)
