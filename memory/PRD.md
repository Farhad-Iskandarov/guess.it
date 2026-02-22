# GuessIt - Football Prediction Platform

## Original Problem Statement
Clone https://github.com/Farhad-Iskandarov/guess.it and implement multiple features and fixes.

## Architecture
- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB), Pydantic v2
- **Database:** MongoDB (local)
- **Payment:** Stripe (via emergentintegrations library)
- **Real-time:** WebSockets (live matches, chat, notifications)
- **Auth:** Session-based (httpOnly cookies) + Google OAuth

## What's Been Implemented

### Session 1: Project Clone
- Full project cloned from GitHub

### Session 2: 5 Feature Implementation
1. Chat Match Card Fix — expand in-place, no redirect
2. Invite Friend Fix — sends actual match card via chat
3. Subscription System — 3 plans + Stripe
4. Admin Subscription Plans Tab
5. Admin Dashboard subscription overview

### Session 3: Exact Score Prediction UI Fix (v1)
- Green/orange visual differentiation
- Per-card exact score tracking

### Session 4: Critical Prediction Logic Fix (Latest)
**Mutual Exclusivity Per Match:**
- If exact score locked → 1/X/2 vote buttons disabled, GuessIt shows "Saved" amber
- If winner prediction saved → Advance button disabled, exact score unavailable in modal
- Only affects THAT specific match card — no global side effects

**Remove Button Clears Everything:**
- Deletes normal prediction AND exact score prediction for that match
- New backend: DELETE /api/predictions/exact-score/match/{id}
- Resets card background, button state, re-enables all options

**Exact Score Reward (+50 pts):**
- Auto-processed when match finishes (prediction_processor.py)
- +50 points for correct exact score, 0 for wrong
- Notifications sent: "Exact score correct! +50 points!"
- Processed once only (no duplicates)

**Visual States Per Card:**
- Default: neutral background, "GUESS IT" button
- Winner prediction (1/X/2): green background, green "Saved" button
- Exact score: orange/amber background, amber "Saved" button
- Both cleared: back to default

## Key Files
- `/app/frontend/src/components/home/MatchList.jsx` — Core prediction UI logic
- `/app/frontend/src/pages/MessagesPage.jsx` — Chat expandable match cards
- `/app/frontend/src/pages/SubscriptionPage.jsx` — Premium subscription page
- `/app/frontend/src/pages/AdminPage.jsx` — Admin panel with subscription management
- `/app/backend/routes/predictions.py` — Prediction CRUD + exact score delete
- `/app/backend/routes/subscriptions.py` — Stripe checkout + plans
- `/app/backend/services/prediction_processor.py` — Auto-award exact score points

## Admin Access
- URL: `/itguess/admin/login`
- Email: `farhad.isgandar@gmail.com`
- Password: `Salam123?`

## Prioritized Backlog
- P0: None (all requested features working)
- P1: Stripe live keys
- P1: Subscription benefits enforcement
- P2: Subscription analytics charts
- P2: Referral/promo code system
