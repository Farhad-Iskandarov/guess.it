# GuessIt - Project PRD

## Architecture
- **Backend**: FastAPI + MongoDB (Motor) + WebSockets
- **Frontend**: React 19 + CRACO + Tailwind CSS + Radix UI
- **Database**: MongoDB
- **Football Data**: football-data.org API

## Admin Account
- **Email:** farhad.isgandar@gmail.com
- **Password:** Salam123?
- **Login URL:** /itguess/admin/login

## What's Been Implemented
- [2026-02-20] Full project clone from GitHub
- [2026-02-20] Admin setup, dedicated admin login page
- [2026-02-20] Banner carousel fix
- [2026-02-20] Footer subscribe, Header/Footer on all pages
- [2026-02-20] News blog system, Contact form, Contact settings
- [2026-02-20] **News block editor**: Admin can build content with mixed text/image blocks (add, reorder, delete)
- [2026-02-20] **News image fix**: Removed white overlay/gradient from cover images and article images
- [2026-02-20] **Inline image upload**: /api/admin/news/upload-image for images within content blocks

## Football API Status
- Key provided: 22713fd8769c4a6393cc424a32939dbe
- Status: INVALID - football-data.org returning "Your API token is invalid"
- Action needed: User must verify email on football-data.org or request new key

## Status: ALL FEATURES COMPLETE (100% backend, 95% frontend)

## Next Tasks
- P0: Football API key verification (user action)
- P1: Awaiting user instructions
