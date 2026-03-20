# GuessIt - Football Prediction Platform (Cloned Copy)

## Architecture
- **Frontend**: React 19 + CRACO + Tailwind CSS 3 + shadcn/ui + React Router 7
- **Backend**: FastAPI (Python) + Motor (async MongoDB) + WebSockets
- **Database**: MongoDB | **Payments**: Stripe | **External API**: Football Data API

## What's Been Implemented

### 2026-03-04: Full Project Clone
### 2026-03-20: Profile Avatar Fix (object-cover)
### 2026-03-20: Match Loading State Fix (fetchIdRef + retry)
### 2026-03-20: Multi-line Message Input (textarea, Shift+Enter)
### 2026-03-20: Clickable News Cards (full card navigation)
### 2026-03-20: Consistent Prediction Behavior (single-click save/remove)
### 2026-03-20: Settings Page Accordion Sections
### 2026-03-20: Exact Score Prediction Removal
- "Remove Exact Score" button in Advanced Modal when prediction is saved
- Uses deleteExactScorePrediction service, resets UI on remove

### 2026-03-20: Profile Picture Preview Modal
- Enlarged circular image in centered modal with blur backdrop
- Upload New + Remove action buttons, close via X or backdrop click
- Hover effect on avatar indicating clickability

## Prioritized Backlog
- P1: Football API key for live data
- P2: Streak achievements, celebration animations
- P3: Redis for multi-instance scaling
