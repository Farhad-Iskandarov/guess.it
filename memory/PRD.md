# GuessIt - Football Prediction Platform

## Overview
GuessIt is a football prediction social platform where users vote on match outcomes for fun. This is NOT gambling - no money, no odds, no betting, no payouts. Users only vote/predict and see community voting statistics.

## Project Status: MVP COMPLETE ✅

## Tech Stack
- **Frontend**: React.js with React Router
- **Backend**: FastAPI (Python) with MongoDB
- **Styling**: Tailwind CSS with custom design tokens
- **Components**: Shadcn/UI components with custom variants
- **Authentication**: JWT sessions (HTTP-only cookies)
- **Database**: MongoDB

## Features Implemented

### 1. Dark/Light Mode Toggle ✨
- Full dark/light theme support across the entire app
- Theme toggle button in header (Sun/Moon icons)
- Theme persisted in localStorage
- Smooth transitions between themes
- Custom CSS variables for both modes
- **Banner carousel excluded from theme changes** (stays dark always)

### 2. Header Component (Authentication-Based Visibility)
- Logo: "GUESSIT" with green accent - **always visible**
- Search icon - **always visible**
- Theme toggle button (Sun/Moon) - **always visible**

**When NOT Logged In:**
- Login button - visible
- Register button (green) - visible
- Messages/Friends/Notifications icons - **hidden**
- User avatar - **hidden**

**When Logged In:**
- Messages icon with badge - visible
- Friends icon with badge - visible
- Notifications icon with badge - visible
- User avatar with dropdown menu - visible
- Login/Register buttons - **hidden**

**UX Features:**
- Tooltips on all icons (Messages, Friend Requests, Notifications)
- Badge counters only show when count > 0
- Dropdown menu: Profile, My Predictions, Settings, Log out
- Layout never shifts when auth state changes

### 3. Authentication System (Real Backend)
- **Email/Password Registration**:
  - Email validation
  - Password strength requirements (8+ chars, uppercase, lowercase, number)
  - Confirm password matching
- **Google OAuth**:
  - "Continue with Google" button
  - Emergent Auth integration
  - Profile picture import from Google
- **Unique Nickname System**:
  - Required after registration (email or Google)
  - 3-20 characters, letters/numbers/underscores only
  - Case-insensitive uniqueness check
  - Automatic suggestions when taken
- **Persistent Sessions**:
  - HTTP-only secure cookies
  - 7-day session expiry
  - Session survives page refresh
- **Security**:
  - bcrypt password hashing
  - Generic error messages (doesn't reveal if email exists)
  - CSRF protection via cookies

### 4. Promo Banner Carousel (Theme-Independent)
- **Fixed dark design in both light/dark modes**
- White text for headline, yellow for accent
- Fixed dark gradient overlay
- Auto-advancing slides (5-second intervals)
- Yellow "Get Started" CTA button
- Memoized components for performance

### 5. Primary Tabs
- Top Matches (with fire emoji)
- Popular (active by default with underline)
- Top Live
- Soon
- "View All" link

### 6. League Filter Chips
- Today, Live, Upcoming
- UCL (default active)
- Premier League, La Liga, Serie A
- International, Azerbaijan League
- Green highlight for active filter

### 7. Top Matches Cards (Featured)
- Two side-by-side cards on desktop
- Portugal vs Poland
- Real Madrid vs Man City
- Team flags/logos
- Vote buttons (1, X, 2) with counts and percentages
- Total votes and "Most picked" indicator

### 8. Full Match List
- Multiple match rows with all data
- Vote buttons with visual feedback
- Green highlight for most-voted option
- Extra highlight ring for user's selection
- Filtering by league/time

### 9. Match Card Action Buttons ✅ (NEW - Dec 2025)

#### GUESS IT Button
- **State-Based Display**:
  - `GUESS IT` - No selection or selection differs from saved
  - `Saved` - Current selection matches saved prediction (green checkmark)
  - `Update` - Saved prediction exists but user changed selection (refresh icon)
  - `Saving...` - Loading state during API call
- **Logic**:
  - Tracks `savedPrediction` (from database) and `currentSelection` (user's click)
  - Dynamically switches text based on state comparison
  - Prevents duplicate saves (shows toast "Prediction already saved")
- **UX**:
  - Loading spinner prevents rapid submissions
  - Disabled when no selection
  - "Your pick: 1/X/2" shown in footer when saved

#### Advance Button (NEW)
- Amber/gold gradient styling with sparkle icon
- Placeholder for future advanced prediction features
- Shows "Coming Soon!" toast when clicked
- Will support: score predictions, detailed analysis

#### Refresh Button (NEW)
- Outline style with rotation icon
- Clears current selection without touching saved prediction
- Shows toast "Selection cleared"
- Disabled when no selection exists

### 10. Prediction Flow
1. User selects option (1/X/2) - highlights with green border
2. User clicks "GUESS IT"
3. If logged in: Saves to database, shows success toast, button shows "Saved"
4. If not logged in: Shows auth modal with Sign In / Create Account options
5. If user changes selection after saving: Button reverts to "GUESS IT" (or "Update")
6. User can save the new selection by clicking "GUESS IT" again

### 11. Pending Predictions (Guest Flow)
- Stored in sessionStorage before auth
- Automatically saved after login
- Seamless UX for converting guests to users

### 12. Footer Component ✅ (NEW - Dec 2025)

#### Structure (4 Sections):
1. **Brand Section**
   - GUESSIT logo (same as header)
   - Platform description
   - Tagline: "Predict. Compete. Win bragging rights."

2. **Platform Links**
   - Home, Matches, Leaderboard, Community, How It Works
   - Icons for each link

3. **Company/Legal**
   - About Us, Terms of Service, Privacy Policy, Contact
   - **Important Disclaimer**: "GuessIt is not a gambling platform. No real money is involved."

4. **Connect Section**
   - Social icons (Twitter, Instagram, Facebook) - placeholders
   - Newsletter signup (coming soon)

#### Bottom Bar:
- Copyright: © 2026 GuessIt. All rights reserved.
- Quick links: Terms | Privacy | Cookies

#### Behavior:
- Sticky footer (stays at bottom even with short content)
- Uses `flex-col` + `flex-1` + `mt-auto` pattern
- Responsive: stacks vertically on mobile
- Auth pages use minimal footer (copyright + terms/privacy only)

## Performance Optimizations

### Memoization
- `React.memo()` on PromoBanner, Header, VoteButton, GuessItButton, and child components
- `useCallback` for event handlers
- Prevents unnecessary re-renders

### Code Structure
- Modular component architecture
- Lazy loading ready
- Tree-shaking enabled
- Minimal bundle size

## Design System

### Theme Support
The app supports both light and dark modes with smooth transitions:

**Dark Mode (Default):**
- Background: `0 0% 8%` (Near black)
- Cards: `0 0% 14%` (Dark gray)
- Text: `0 0% 98%` (White)

**Light Mode:**
- Background: `210 20% 98%` (Off white)
- Cards: `0 0% 100%` (Pure white)
- Text: `222 47% 11%` (Dark blue-gray)

**Banner (Fixed - No Theme Changes):**
- Background: Dark gradient overlay (always)
- Headline: White text (always)
- Accent: Yellow #facc15 (always)

### Color Palette (HSL format)
- Primary: `142 70% 45%` (Green accent)
- CTA: `45 100% 50%` (Yellow for buttons)
- Destructive: `0 85% 55%` (Red notifications)
- Amber: `45 100% 50%` (Advance button accent)

### Typography
- Font: Inter (Google Fonts)
- Headings: Bold, 3xl-5xl
- Body: Medium, base-lg
- Labels: Medium, sm

## File Structure
```
/app
├── backend/
│   ├── models/
│   │   ├── auth.py           # User models
│   │   └── prediction.py     # Prediction models
│   ├── routes/
│   │   ├── auth.py           # Auth endpoints
│   │   └── predictions.py    # Prediction endpoints
│   ├── server.py             # FastAPI app
│   └── requirements.txt
├── frontend/src/
│   ├── components/
│   │   ├── home/
│   │   │   ├── PromoBanner.jsx     # Theme-independent carousel
│   │   │   ├── TabsSection.jsx
│   │   │   ├── LeagueFilters.jsx
│   │   │   ├── TopMatchesCards.jsx # Compact action buttons
│   │   │   └── MatchList.jsx       # Full action buttons
│   │   ├── layout/
│   │   │   └── Header.jsx
│   │   └── ui/ (Shadcn components)
│   ├── data/
│   │   └── mockData.js
│   ├── hooks/
│   │   └── useLocalStorage.js
│   ├── lib/
│   │   ├── AuthContext.js
│   │   ├── ThemeContext.js
│   │   └── utils.js
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── ChooseNicknamePage.jsx
│   │   └── AuthCallback.jsx
│   ├── services/
│   │   └── predictions.js
│   ├── App.js
│   ├── App.css
│   └── index.css
└── memory/
    └── PRD.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Email/password registration
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/nickname` - Set unique nickname
- `GET /api/auth/nickname/check` - Check nickname availability
- `GET /api/auth/google` - Initiate Google OAuth
- `POST /api/auth/google/callback` - Handle Google callback

### Predictions
- `POST /api/predictions` - Save/update prediction
- `GET /api/predictions/me` - Get user's predictions
- `GET /api/predictions/match/:matchId` - Get prediction for specific match
- `DELETE /api/predictions/match/:matchId` - Delete prediction

## Database Schema

### users
```json
{
  "_id": "ObjectId",
  "user_id": "UUID",
  "email": "string",
  "hashed_password": "string",
  "name": "string (nickname)",
  "google_id": "string (optional)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### predictions
```json
{
  "_id": "ObjectId",
  "prediction_id": "UUID",
  "user_id": "UUID",
  "match_id": "string",
  "prediction": "string (home/draw/away)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## Responsive Design
- Desktop: Full layout with side-by-side cards
- Mobile: Stacked layout, optimized touch targets
- Breakpoints: sm (640px), md (768px), lg (1024px)

## Security
- Input validation for theme values
- No XSS vulnerabilities
- Safe localStorage usage
- HTTP-only cookies for sessions
- bcrypt password hashing
- Protected routes with auth context

## Test Credentials
- Email: `testuser123@example.com`
- Password: `Password123`
- Nickname: `TestPlayer123`

## Next Steps (Future Enhancements)
1. ✅ ~~User authentication system (backend)~~ DONE
2. ✅ ~~GUESS IT button state management~~ DONE
3. ✅ ~~Advance and Refresh buttons~~ DONE
4. 🔲 Real-time voting updates (WebSocket)
5. 🔲 Points system for correct predictions
6. 🔲 Lock predictions before match starts
7. 🔲 Score prediction (via Advance button)
8. 🔲 Leaderboards and statistics
9. 🔲 Social features (friends, sharing)
10. 🔲 Push notifications
