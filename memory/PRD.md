# GuessIt - Football Prediction App PRD

## Original Problem Statement
1. Clone https://github.com/Farhad-Iskandarov/guess.it exactly as-is
2. Switch from Football-Data.org to API-Football (api-sports.io) v3
3. Admin panel: API key activation should validate, clear cache, fetch data instantly
4. Support both football-data.org AND api-sports.io providers

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Radix UI + CRACO
- **Backend**: FastAPI (Python) with Motor (async MongoDB driver)
- **Database**: MongoDB
- **External API**: Multi-provider (football-data.org v4 / api-sports.io v3)
- **Payments**: Stripe integration
- **Auth**: Email/Password + Google OAuth
- **WebSockets**: Live match updates, chat, friend notifications

## Multi-Provider API System
Both providers supported with automatic detection via base_url:

### football-data.org (v4) - Currently Active
- Base: `https://api.football-data.org/v4`
- Auth: `X-Auth-Token` header
- Endpoints: `/matches?dateFrom=X&dateTo=Y&competitions=PL,CL,...`
- dateTo is EXCLUSIVE (add 1 day to include end date)
- Free plan: 10 req/min, wider date ranges allowed

### api-sports.io (v3)
- Base: `https://v3.football.api-sports.io`
- Auth: `x-apisports-key` header
- Endpoints: `/fixtures?date=YYYY-MM-DD` or `/fixtures?live=all`
- Free plan: 100 req/day, 10 req/min, yesterday-to-tomorrow window

## What's Been Implemented

### Phase 1: Clone (2026-02-25)
- [x] Exact clone from GitHub, all 12 routes + 20 pages preserved

### Phase 2: API-Football Migration (2026-02-25)
- [x] Initial switch to api-sports.io (worked, then key got suspended)

### Phase 3: Multi-Provider Support (2026-02-25)
- [x] `football_api.py` supports both football-data.org and api-sports.io
- [x] Auto-detects provider from active config's `base_url`
- [x] Separate transform functions for each provider's response format
- [x] `validate_api_key(key, base_url)` validates against correct provider
- [x] Admin activation: validates → clears cache → resets suspension → fetches data → returns count
- [x] Seed function no longer overwrites admin-configured APIs
- [x] Fixed football-data.org exclusive dateTo (add 1 day)
- [x] 67 matches loading across PL, CL, SA, PD, BL1, FL1

## Testing Results (Iteration 4)
- Backend: 100% (all 18 API tests passing)
- Frontend: 95% (core functionality working)
- All competition filters: Working
- Today/Ended/Live: Working
- Admin API management: Working
- WebSocket live updates: Active

## Next Tasks
- User-requested modifications
- Monitor API quota usage
