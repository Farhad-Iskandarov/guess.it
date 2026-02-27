# GuessIt - Football Prediction Platform (Clone)

## Original Problem Statement
Clone the GitHub repository https://github.com/Farhad-Iskandarov/guess.it exactly as-is into the Emergent environment. No redesign, no UI changes, no framework replacements. 100% identical duplicate that is fully editable.

## Architecture
- **Frontend:** React 19, CRACO, Tailwind CSS 3, shadcn/ui (Radix), Recharts
- **Backend:** FastAPI (Python 3.11), Motor (async MongoDB driver), Pydantic v2
- **Database:** MongoDB (DB: guessit)
- **Real-time:** WebSockets (live matches, chat, notifications)
- **Auth:** Session-based (httpOnly cookies) + Google OAuth
- **Football Data:** Multi-provider (football-data.org v4 + API-Football v3)
- **Payments:** Stripe (subscription system)

## Core Requirements
- User registration & login (email + Google OAuth)
- Live football match browsing (multi-league)
- Match predictions with points system (winner + exact score)
- Global leaderboard
- Friends system, real-time messaging/chat
- In-app notifications
- User profiles with avatar/banner uploads
- Subscription plans (Standard/Champion/Elite via Stripe)
- Admin panel (users, matches, news, banners, API management, analytics)

## What's Been Implemented
- **2026-02-26:** Full project clone completed
  - Cloned all source code from GitHub repository
  - Configured backend .env (MongoDB, Stripe, admin credentials)
  - Preserved frontend .env (REACT_APP_BACKEND_URL)
  - Installed all backend (pip) and frontend (yarn) dependencies
  - Both services running via supervisor
  - Admin account seeded (admin@guessit.com / Admin123!)
  - 3 subscription plans seeded (Standard, Champion, Elite)
  - All pages verified: Homepage, Admin Login, Register, Login, Leaderboard, About, Contact, News, How It Works
  - Testing: 100% backend + 100% frontend pass rate

- **2026-02-27:** Enhanced skeleton loading animations
  - HomePage: Upgraded MatchSkeleton to mirror real match card layout (meta bar, team crests, vote buttons, action buttons, footer stats). Shows 6 skeleton cards in 2-column grid with shimmer animation
  - ProfilePage: Upgraded ProfileSkeleton with detailed header (avatar, level badge, progress bar), stats grid, two-column layout (recent activity, achievements, performance). Uses skeleton-bone shimmer class
  - MyPredictionsPage: Upgraded LoadingSkeleton with summary card skeletons, search/filter skeletons, prediction card skeletons matching real card structure
  - Added CSS: skeleton-bone/skeleton-bone-circle with shimmer gradient animation, content-fade-in with reveal animation for smooth data-to-content transition
  - Testing: 100% pass rate on all skeleton implementations

- **2026-02-27:** Fixed mobile responsive layout
  - Root cause: Multiple elements causing horizontal overflow on mobile (header items too wide, PromoBanner with hard-coded 4.5rem padding, match buttons with fixed min-widths)
  - Added overflow-x:hidden to html/body/root wrapper
  - Header: Reduced gaps and sizes for mobile (smaller theme toggle, compact Level badge)
  - PromoBanner: Responsive padding (px-4 mobile → 4.5rem desktop) and responsive height (280px → 405px)
  - Match cards: Removed fixed min-widths on mobile (flex:1 instead), restored at sm+ breakpoint
  - Score block: Responsive width (60px mobile → 80px desktop)
  - Verified: scrollWidth === clientWidth at 390px mobile (zero horizontal overflow)
  - Desktop layout completely unchanged
  - Testing: 100% backend + 100% desktop + 100% mobile

- **2026-02-27:** Fixed chat match card design for mobile
  - Root cause: MessageBubble used ChatMatchCardWrapper which rendered the full 610-line MatchCard (homepage component) inside chat bubbles — way too large
  - Replaced with compact SharedMatchCard designed for chat context:
    - Reduced padding: px-2.5/py-2 (vs px-4/py-3)
    - Smaller fonts: 8-11px (vs 12-16px)
    - Compact vote buttons: py-1.5 rounded-md (vs py-2.5 rounded-lg)
    - Compact action buttons: py-1.5 text-[9px] (vs py-2.5 text-xs)
    - Team crests: 3.5x3.5 (vs 4x4)
    - Chat bubble max-width: 80% mobile / 75% desktop (vs 85%/90%)
    - Expand/collapse with "Tap to predict" hint
  - Removed unused MatchCard import from MessagesPage
  - All interactive features preserved (voting, exact score, remove)
  - Testing: 100% backend, code-level verification of compact styling

- **2026-02-27:** Fixed desktop chat card consistency + removed About Us tech section
  - Sent match cards (right side) had invisible border/background on light theme (was border-white/10 bg-white/[0.05])
  - Both sent and received cards now use identical styling: border-border/30 bg-card/60
  - Removed all isMine text color overrides — consistent text-foreground and text-muted-foreground
  - Removed "Powered by Modern Technology" section from About Us page
  - Testing: 100% backend, About Us section removal verified, code styling verified

- **2026-02-27:** Improved chat match card interaction logic
  - Card body click now navigates to /match/:matchId (same as main page) — acts as clickable match preview
  - Added compact "Predict" pill button (text-[8px] px-2 py-0.5 rounded-full) with stopPropagation
  - Button shows "Predict" (no prediction), "Edit" (has prediction), "Close" (expanded)
  - For locked matches (LIVE/FINISHED), Predict button hidden, shows "Ended"/"Live" text instead
  - Navigation and prediction actions cleanly separated
  - Testing: 100% backend, all code-level requirements verified

- **2026-02-27:** Chat Predict button enlarged + mobile keyboard fix
  - Predict button: text-[8px] px-2 py-0.5 → text-[11px] font-bold px-4 py-1.5 with shadow-sm and bg-primary/12 default color — now feels like a primary action
  - Mobile keyboard: Send and + buttons now have onMouseDown/onTouchStart preventDefault — prevents input blur so keyboard stays open for continuous messaging
  - README.md updated with new chat features
  - Testing: 100% backend, all code-level requirements verified

## Admin Credentials
- Email: admin@guessit.com
- Password: Admin123!
- Admin URL: /itguess/admin/login

## Prioritized Backlog
- P0: Configure Football API key (matches currently empty - expected without key)
- P1: Configure Google OAuth for social login
- P2: Any user-requested modifications

## Next Tasks
- Awaiting user instructions for any modifications
