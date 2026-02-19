# GuessIt — Football Prediction Platform

## Architecture
React 19 + FastAPI + MongoDB + Football-Data.org API + WebSocket

## What's Been Implemented
- Session 1: Project Clone
- Session 2: 6 Improvements (login error, caching, optimistic UI, points placeholder, league name, red/green styling)
- Session 3: Live Matches section, prediction caching, mobile toggle hidden
- Session 4: Clickable summary filters, navigation fix, saved card highlight
- Session 5: **Full Points & Level System** — +10 pts correct, -5 pts wrong (level 5+), levels 0-10 with thresholds, persistent MongoDB storage, anti-duplicate protection, header/dropdown/page UI, clickable Points filter

## Points & Level System
- Levels: 0→100→120→200→330→500→580→650→780→900→1000
- Deduction only at level 5+ (500+ pts), -5 per wrong prediction
- Server-side calculation in /me/detailed endpoint
- points_awarded flag prevents double rewards
- Stored in users.points, users.level, predictions.points_awarded/points_value

## Backlog
- P2: Leaderboard, user profiles, push notifications, friend system, PWA
