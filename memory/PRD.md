# GuessIt - Football Prediction App (Cloned Project)

## Original Problem Statement
Create a full copy (duplicate) of existing project from GitHub: https://github.com/Farhad-Iskandarov/guess.it  
Rules: No redesign, no UI/layout/component/color/structure changes. Preserve all pages, routes, logic, database schema, and integrations. Result must be 100% identical clone.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui (Radix) + react-router-dom v7
- **Backend**: FastAPI (Python) with motor (async MongoDB driver)
- **Database**: MongoDB
- **Build Tool**: CRACO (Create React App Configuration Override)

## Core Features (from original project)
- Football match prediction platform
- User auth (register/login/JWT + Google OAuth)
- Admin panel with match management
- Live match polling from Football API
- Subscription plans (Stripe integration)
- Leaderboards and user profiles
- Friends system with real-time messaging (WebSockets)
- News & banner management
- Favorites & notification system
- Dark/Light theme toggle
- Guest profiles
- Exact score predictions

## User Personas
- Football fans who predict match outcomes
- Admin who manages matches, news, banners
- Premium subscribers with enhanced features

## What's Been Implemented (2026-02-25)
- [x] Exact clone of GitHub repo to /app environment
- [x] All backend dependencies installed (FastAPI, motor, bcrypt, stripe, emergentintegrations, etc.)
- [x] All frontend dependencies installed (React 19, Radix UI, recharts, react-router-dom v7, etc.)
- [x] Backend running on port 8001 with MongoDB connection
- [x] Frontend compiled and serving on port 3000
- [x] Admin account seeded (farhad.isgandar@gmail.com / Salam123?)
- [x] Subscription plans seeded
- [x] All pages and routes preserved (Home, Login, Register, Profile, Settings, Friends, Messages, Admin, How It Works, Leaderboard, About, News, Contact, Subscribe)
- [x] All WebSocket endpoints preserved (/ws/matches, /ws/friends, /ws/chat, /ws/notifications)
- [x] Fixed compilation error: MessagesPage.jsx had duplicate ConversationItem - renamed first instance to SharedMatchCard and added missing useState hooks
- [x] Testing passed: 100% backend, 100% frontend

## Pages & Routes
- `/` - Homepage with banners, match tabs, league filters
- `/login` - Login page
- `/register` - Registration page
- `/choose-nickname` - Nickname selection after OAuth
- `/auth/callback` - OAuth callback
- `/my-predictions` - User predictions (protected)
- `/profile` - User profile (protected)
- `/settings` - User settings (protected)
- `/friends` - Friends management (protected)
- `/messages` - Chat/messaging (protected)
- `/profile/:userId` - Guest profile view (protected)
- `/itguess/admin/login` - Admin login
- `/admin` - Admin dashboard (admin-only)
- `/how-it-works` - How it works (public)
- `/leaderboard` - Leaderboard (public)
- `/about` - About page (public)
- `/news` - News listing (public)
- `/news/:articleId` - News article (public)
- `/contact` - Contact page (public)
- `/subscribe` - Subscription plans (protected)
- `/subscribe/success` - Subscription success (protected)

## API Endpoints
- Auth: /api/auth/register, /api/auth/login, /api/auth/session, /api/auth/logout
- Predictions: /api/predictions, /api/predictions/exact-score
- Football: /api/football/matches, /api/football/match/:id
- Favorites: /api/favorites
- Settings: /api/settings
- Friends: /api/friends
- Messages: /api/messages
- Notifications: /api/notifications
- Admin: /api/admin
- Public: /api/public
- Subscriptions: /api/subscriptions

## Environment Variables Needed
- `MONGO_URL` - MongoDB connection (configured)
- `DB_NAME` - Database name (configured)
- `CORS_ORIGINS` - CORS origins (configured)
- `FOOTBALL_API_KEY` - Football data API key (NOT configured - needed for match data)
- `FOOTBALL_API_BASE_URL` - Football API base URL (has default)
- `STRIPE_API_KEY` - Stripe payment key (NOT configured - needed for subscriptions)
- `ADMIN_EMAIL` - Admin email (has default: farhad.isgandar@gmail.com)
- `ADMIN_PASSWORD` - Admin password (has default: Salam123?)

## Prioritized Backlog
- P0: User provides FOOTBALL_API_KEY for match data loading
- P0: User provides STRIPE_API_KEY for subscription payments
- P1: Any feature additions or modifications requested by user
- P2: Performance optimizations, additional testing

### Chat Match Card Design Consistency Fix (2026-02-25)
- [x] Fixed: Match cards sent via Main Page → Advance → Invite Friend were rendering with the OLD `SharedMatchCard` inline design in chat
- [x] Replaced `SharedMatchCard` with `ChatMatchCardWrapper` in `MessageBubble` component
- [x] `ChatMatchCardWrapper` uses the same `MatchCard` component as the main page — consistent design across all match share paths
- [x] Adjusted bubble container: match shares no longer constrained by colored chat bubble background, MatchCard renders with its own proper card styling
- [x] Both paths now identical: Chat + button ✅ and Main Page → Advance → Invite Friend ✅
- [x] Testing passed: 100% backend, 100% frontend

### Chat Match Card — Guess It & Remove Buttons (2026-02-25)
- [x] Added "Guess It" and "Remove" buttons to the MAIN visible area of chat match cards (not inside Advance)
- [x] Guess It: confirms the selected vote prediction via POST /api/predictions
- [x] Remove: deletes both winner prediction (DELETE /api/predictions/match/{id}) and exact score (DELETE /api/predictions/exact-score/match/{id})
- [x] Status indicator below buttons shows current Pick (1/X/2) and Exact score when predictions exist
- [x] Buttons properly disabled when no vote selected or no prediction to remove
- [x] Works for both chat paths: + button and Main Page → Advance → Invite Friend
- [x] Testing passed: 100% backend, 100% frontend

### Vote Button Pre-Selection Fix (2026-02-25)
- [x] Fixed: "1" vote button had green/active background even with 0 votes, looking pre-selected
- [x] Root cause: `getMostPicked()` in MatchCard.jsx returned `'home'` when all votes were 0 (because `0 >= 0` is true)
- [x] Fix: Added `if (match.totalVotes === 0) return null;` check — no button gets green highlight when nobody has voted
- [x] Green highlight now only appears when: user selects a vote, or there are actual votes with a winner
- [x] Testing passed: 100% backend, 100% frontend (968 buttons validated)

### Remove Invite Duplicate-Blocking (2026-02-25)
- [x] Backend friends.py: Removed match_invitations duplicate check — allows unlimited sends of same match card
- [x] Frontend MatchList.jsx: Removed invitedFriends blocking + toast — button shows "Sent!" briefly then resets to "Invite" after 1.5s
- [x] Frontend MatchCard.jsx: Same reset pattern — sentTo clears after 1.5s so button is re-clickable
- [x] Each send creates a new invitation record + new chat message
- [x] Testing passed: 100% backend, 85% frontend (low-priority pre-existing auth timing issue unrelated to this change)

### Match Detail Page (2026-02-26)
- [x] Created `/match/:matchId` route with full match center design (mini ESPN-style)
- [x] Match header: Back button, status badge (Upcoming/LIVE/FT), competition name, date/time
- [x] Large team logos (70-90px responsive), team names, VS indicator or score display
- [x] Vote buttons (1/X/2) with vote counts, percentages, progress bars
- [x] Action buttons: Guess It, Remove (visible in main section)
- [x] Lock Exact Score section with home/away score inputs
- [x] Advance section: Invite Friend + Share Match Link (smooth expand/collapse)
- [x] League Standings table: Top 10 teams, home/away teams highlighted in primary color, columns: Position, Team, P, W, D, L, GD, Pts
- [x] Mobile-optimized: responsive logos, stacked buttons, horizontal scroll for standings
- [x] Sign-in prompt for unauthenticated users
- [x] Disabled prediction buttons for finished/live matches
- [x] Backend: Added GET /api/football/match/{match_id} + GET /api/football/standings/{competition_code}
- [x] Match cards on homepage now clickable (both grid and list views) — navigate to /match/:matchId
- [x] Testing passed: 100% backend, 95% frontend

## Next Tasks
- Awaiting user confirmation and next set of changes/updates
