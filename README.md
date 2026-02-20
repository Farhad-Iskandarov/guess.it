# GUESSIT - Football Match Prediction Platform

## Overview
GUESSIT is a full-stack football match prediction platform where users predict match outcomes, compete with friends, and earn points through accurate predictions.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, Radix UI, React Router DOM, Craco
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **External API**: Football-Data.org API for live match data
- **Auth**: Email/Password + Google OAuth (Emergent Auth)

## Features

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
