# GuessIt — Football Prediction Platform

## Original Problem Statement
1. Clone https://github.com/Farhad-Iskandarov/guess.it exactly
2. Redesign Messages page with two-column layout, independent scrolling, modern UI, responsive
3. Build secure, modern, animated Admin Panel with RBAC, audit logging, 6 feature sections

## Architecture
- **Frontend**: React 19, Tailwind CSS 3.4, Shadcn/UI, Radix UI, Lucide React, CRACO
- **Backend**: Python 3.11, FastAPI, Uvicorn, Motor (async MongoDB driver)
- **Database**: MongoDB (guessit)
- **Real-Time**: WebSocket with 30s polling from Football-Data.org
- **Auth**: Email/Password (bcrypt) + Google OAuth (Emergent Auth), session cookies

## What's Been Implemented

### 2026-02-20: Project Clone
- Full clone of source repo, all dependencies installed, services running

### 2026-02-20: Messages Page Redesign
- Two-column layout (400px sidebar + flex chat area), independent scrolling
- Modern message bubbles, responsive mobile toggle, Tailwind utility classes

### 2026-02-20: Admin Panel (NEW)
**Backend** (`/app/backend/routes/admin.py`):
- 20+ endpoints with RBAC middleware (401/403 enforcement)
- Rate limiting (100 req/60s per admin)
- Input sanitization (XSS prevention)
- Audit logging (all admin actions tracked)
- Endpoints: dashboard stats, user CRUD, match management, moderation, notifications, analytics

**Frontend** (`/app/frontend/src/pages/AdminPage.jsx`):
- 6 tabs: Dashboard, Users, Matches, Moderation, Notifications, Analytics
- Animated stat cards with counters
- User management table with promote/demote/ban/delete actions
- Match management with Force Refresh, Pin/Hide
- Content moderation with message viewer, flag/delete
- Notification broadcaster (system-wide + individual)
- Analytics with 7-day bar charts, top predictors, points distribution
- Dark mode compatible, responsive sidebar

**Security**:
- Admin user: farhad.isgandarov@gmail.com (role: admin)
- Non-admin → 403 on all /api/admin/* endpoints
- Non-authenticated → 401
- Rate limiting, audit trail, server-side role validation
- All user content HTML-escaped

**Database Collections Added**:
- admin_audit_log, reported_messages, pinned_matches, hidden_matches

## API Routes
### Public
- /api/auth/*, /api/football/*, /api/predictions/*, /api/messages/*
- /api/favorites/*, /api/friends/*, /api/settings/*, /api/notifications/*

### Admin (Protected)
- GET /api/admin/dashboard
- GET/POST/DELETE /api/admin/users/*
- GET/POST/DELETE /api/admin/matches/*
- GET/DELETE /api/admin/moderation/*
- POST /api/admin/notifications/broadcast, /send
- GET /api/admin/analytics
- GET /api/admin/audit-log

## Testing Results
- Backend admin APIs: 92% pass rate
- Frontend admin UI: All 6 tabs verified via screenshots
- Security: 403/401 enforcement confirmed
- Homepage: 120 matches still loading correctly

## Prioritized Backlog
- P1: Admin session timeout (auto logout on inactivity)
- P1: CSRF token on admin routes
- P2: Export audit log to CSV
- P2: Admin settings page
- P3: Advanced match override (manual score entry)
