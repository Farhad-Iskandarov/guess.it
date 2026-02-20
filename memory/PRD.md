# GuessIt — Football Prediction Platform (Clone)

## Original Problem Statement
Clone the existing GuessIt project from https://github.com/Farhad-Iskandarov/guess.it as an exact 100% identical duplicate, then implement 6 feature updates.

## Architecture
- **Frontend**: React 19, Tailwind CSS, Shadcn/UI, Radix UI, Lucide React, CRACO, React Router v7
- **Backend**: Python 3.11, FastAPI, Uvicorn, Motor (async MongoDB driver)
- **Database**: MongoDB (guessit)
- **Auth**: bcrypt, httpOnly session cookies, Emergent Google OAuth
- **External API**: Football-Data.org v4 (API key: configured in .env)
- **Real-Time**: WebSocket + polling fallback

## Core Requirements (Static)
1. Browse upcoming/live football matches from major leagues
2. Predict match outcomes (Home/Draw/Away)
3. Live score updates via WebSocket (30s polling)
4. User authentication (email/password + Google OAuth)
5. Points & Level system (10 levels)
6. Favorite clubs with heart toggle
7. Friends system with real-time WebSocket notifications
8. Real-time messaging between friends
9. Notification system (friend requests, messages, badges)
10. User profile & settings
11. My Predictions page
12. Dark/Light theme

## What's Been Implemented

### Session 1 — Clone (2026-02-20)
- Full project clone from GitHub
- All backend routes + WebSocket endpoints
- All frontend pages + components
- Football-Data.org API integration

### Session 2 — 6 Feature Updates (2026-02-20)

#### 1. Grid/List Animation ✅
- CSS transition animation (300ms cubic-bezier) for view switching
- Staggered card entrance with `view-transitioning` class
- Works on both Main Page and My Predictions Page
- No layout jump, smooth fade + scale

#### 2. Messages Page — Dual Scroll Areas ✅
- Left panel: conversations list scrolls independently via `.messages-sidebar-list`
- Right panel: chat messages scroll independently via `.messages-chat-messages`
- Header remains fixed at top
- Input area remains fixed at bottom
- `h-screen` layout with `overflow: hidden` on parent

#### 3. Message Delivery & Read Status ✅
- Backend: `delivered`, `delivered_at`, `read`, `read_at` fields on messages
- WebSocket events: `message_delivered`, `messages_read`, `messages_delivered`
- UI: Single check = Sent, Double check = Delivered, Colored double check = Read
- Settings: Read Receipts toggle + Delivery Status toggle
- Privacy: If disabled, sender cannot see read/delivered status

#### 4. Security Hardening ✅
- HTML tag stripping via `re.sub(r'<[^>]+>', '', text)` + `html.escape()`
- Rate limiting: 30 messages per 60 seconds per user (in-memory)
- Backend validation via Pydantic with `field_validator`
- Message length limit: 1-2000 chars
- Null byte removal
- XSS prevention: React's JSX escaping + backend sanitization
- WebSocket auth verification

#### 5. Favorite Matches ✅
- Backend: `favorite_matches` collection with CRUD endpoints
- POST/GET/DELETE `/api/favorites/matches`
- Bookmark icon on each match card (amber color when bookmarked)
- Favorite tab shows both "Favorite Clubs" and "Bookmarked Matches" sections
- Matches persist even after they end (manual removal only)

#### 6. Share Match Card in Chat ✅
- "+" button next to Send in chat input area
- Match selector modal with search functionality
- `message_type: "match_share"` with structured `match_data`
- Match card renders in chat with teams, score, status, competition
- Clickable card navigates to home page
- XSS-safe: all match data sanitized

## Testing Results
- Backend: 100% (17/17 tests passed)
- Frontend: All features verified via authenticated browser testing
- Grid/List animation: Visual confirmation of smooth transitions
- Messages dual scroll: Layout confirmed with sidebar + chat area
- Settings: 4 toggles visible and functional
- Bookmark icons: 120 visible on 120 match cards

## Database Collections
- `users`, `user_sessions`, `predictions`, `favorites`, `favorite_matches`
- `friendships`, `friend_requests`, `messages`, `notifications`

## Indexes
- `messages`: (sender_id, receiver_id, created_at), (receiver_id, read), (receiver_id, delivered)
- `notifications`: (user_id, created_at), (user_id, read)
- `favorite_matches`: (user_id, match_id) unique, (user_id, created_at)

## API Key Configuration
- FOOTBALL_API_KEY: configured in /app/backend/.env

## Prioritized Backlog
### P1 (High)
- [ ] Leaderboard System
- [ ] Push Notifications
- [ ] Match Detail Page

### P2 (Medium)
- [ ] Advanced Predictions (score, first goal scorer)
- [ ] PWA Support
- [ ] Historical Statistics

## Next Tasks
- Awaiting user feedback on implemented features
