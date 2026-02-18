# GuessIt - Football Prediction Platform

## Original Problem Statement
Clone the existing GuessIt project from https://github.com/Farhad-Iskandarov/guess.it exactly as-is with zero modifications. Then fix UI performance issues and apply visual improvements to live match cards.

## Architecture
- **Frontend**: React 19 + Tailwind CSS 3.4 + Shadcn/UI + Radix UI + Lucide React
- **Build Tool**: CRACO
- **Backend**: FastAPI (Python) + Motor (async MongoDB driver)
- **Database**: MongoDB
- **Auth**: Email/password (bcrypt) + Google OAuth (Emergent Auth) + httpOnly session cookies
- **Football Data**: Football-Data.org v4 API (free tier)
- **Real-Time**: WebSocket with 30s polling fallback

## What's Been Implemented
- [2026-02-18] Full project clone from GitHub - 100% identical copy
- [2026-02-18] Added real Football-Data.org API key - live matches loading
- [2026-02-18] Fixed banner carousel layout shaking (opacity transitions, fixed 405px height, 4.5rem padding-left)
- [2026-02-18] Fixed Grid/List toggle performance (CSS-based switch, memoized MatchRow)
- [2026-02-18] Live match card improvements:
  - Larger score font (text-2xl horizontal) with match minute above score
  - Subtle glow animation (live-glow 3s ease-in-out) instead of aggressive flash
  - Compact "Match is live" banner (w-fit, not full card width)
  - Slow icon pulse (live-pulse-icon) instead of fast animate-pulse
- [2026-02-18] Logo click behavior: Navigates to homepage + smooth scroll to top (Header + Footer)
- [2026-02-18] README updated with API token info and changelog

## Testing Results
- Iteration 7: 96.4% (initial clone)
- Iteration 8: 93% (banner + toggle fixes)
- Iteration 9: 95% (live card improvements, logo behavior) - all 15 tests passed

## Backlog
- P1: Leaderboard system, user profiles
- P2: Push notifications, friend system, advanced predictions
- P3: PWA support, newsletter, historical stats
