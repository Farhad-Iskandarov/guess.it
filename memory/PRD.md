# GuessIt - Football Match Prediction Application

## Original Problem Statement
Clone the GitHub project https://github.com/Farhad-Iskandarov/guess.it completely and set it up as an identical, editable copy. The project is a football match prediction application that allows users to predict match outcomes and compete with friends.

## Project Overview
GuessIt is a football match prediction platform where users can:
- View upcoming and live football matches
- Make predictions on match outcomes (Home Win, Draw, Away Win)
- Earn points for correct predictions
- Track their prediction history and performance
- Add favorite teams
- Compete with friends

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **External API**: Football-Data.org (free tier)
- **Authentication**: Email/Password + Google OAuth (Emergent Auth)

## Core Features

### 1. Match Display
- Live matches section with real-time updates via WebSocket
- Upcoming matches for the next 7 days
- Competition filters (UCL, Premier League, La Liga, Serie A, Bundesliga, Ligue 1)
- Grid/List view toggle
- Team crests and competition emblems

### 2. User Authentication
- Email registration with password confirmation
- Google OAuth integration
- Unique nickname system (required after registration)
- Session-based authentication with httpOnly cookies

### 3. Predictions System
- Vote on match outcomes (Home/Draw/Away)
- Predictions lock 10 minutes before match start
- Points system:
  - +10 points for correct prediction
  - -5 points penalty for wrong predictions (level 5+)
- Level progression based on total points

### 4. Favorites System
- Add/remove favorite clubs
- Filter matches by favorite teams
- Quick access via Favorite tab

### 5. User Profile
- Points and level tracking
- Prediction history with results
- Performance statistics

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/nickname` - Set user nickname
- `GET /api/auth/nickname/check` - Check nickname availability
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Football
- `GET /api/football/competitions` - List available competitions
- `GET /api/football/matches` - Get matches with filters
- `GET /api/football/matches/today` - Today's matches
- `GET /api/football/matches/live` - Live matches
- `GET /api/football/matches/upcoming` - Upcoming matches
- `GET /api/football/search` - Search matches by team name
- `WS /api/ws/matches` - WebSocket for live updates

### Predictions
- `POST /api/predictions` - Create/update prediction
- `GET /api/predictions/me` - Get user's predictions
- `GET /api/predictions/me/detailed` - Get predictions with match data
- `GET /api/predictions/match/{match_id}` - Get prediction for specific match
- `DELETE /api/predictions/match/{match_id}` - Delete prediction

### Favorites
- `GET /api/favorites/clubs` - Get favorite clubs
- `POST /api/favorites/clubs` - Add favorite club
- `DELETE /api/favorites/clubs/{team_id}` - Remove favorite club

## Environment Variables

### Backend (.env)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
FOOTBALL_API_KEY=<your-api-key>
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=<backend-url>
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

## What's Been Implemented (Feb 19, 2026)

### Completed
- [x] Project cloned from GitHub repository
- [x] Backend server running with FastAPI
- [x] Frontend running with React
- [x] Football-Data.org API integration
- [x] User registration (email + Google OAuth)
- [x] User login and session management
- [x] Nickname system
- [x] Match listing with filters
- [x] Live match updates via WebSocket
- [x] Prediction creation and management
- [x] Points and level system
- [x] Favorites system
- [x] Dark/Light mode toggle
- [x] All API tests passing (56+ tests)
- [x] ESLint warnings fixed
- [x] **Profile Page** - Modern, animated user profile with stats and achievements
- [x] **Settings Page** - Comprehensive account settings (avatar, email, password, nickname)
- [x] **Real-Time Friendship System**:
  - Friends page with search, tabs (Friends/Incoming/Sent)
  - Send/Accept/Decline/Cancel friend requests
  - Remove friends
  - WebSocket notifications for real-time updates
  - Header badge showing pending request count
  - Friends section in Profile page

### Test Users Created
- testuser@example.com / TestPass123! / TestPlayer
- testuser2@example.com / TestPass123! / Player2
- uitest_76272@example.com / TestPass123! / UITest8258

## Project Health
- Backend: RUNNING (100% healthy)
- Frontend: RUNNING (100% healthy)
- Database: MongoDB RUNNING
- External API: Football-Data.org CONNECTED

## Upcoming Tasks
*No upcoming tasks - awaiting user confirmation that clone is complete*

## Future/Backlog Tasks
*All future changes pending user confirmation*

## Notes
- Football API has rate limit of 10 requests/minute on free tier
- Predictions lock 10 minutes before match kickoff
- WebSocket provides live match updates every 30 seconds
- Session tokens expire after 7 days
