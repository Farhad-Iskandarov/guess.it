# 🏆 GuessIt - Football Prediction Platform

<div align="center">

![GuessIt Logo](https://img.shields.io/badge/GuessIt-Football%20Predictions-22c55e?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyeiIvPjwvc3ZnPg==)

[![React](https://img.shields.io/badge/React-19.0.0-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](LICENSE)

**A social football prediction platform where users vote on match outcomes for fun.**

⚠️ **NOT gambling** - No money, no odds, no betting, no payouts.

[Live Demo](https://guess-it-predict.preview.emergentagent.com) · [Report Bug](#) · [Request Feature](#)

</div>

---

## 📌 Project Overview

**GuessIt** is a modern, responsive football prediction platform that allows users to:

- 🎯 **Vote** on match outcomes (Home/Draw/Away)
- 📊 **View community statistics** and voting trends
- 🌍 **Filter matches** by league, time, and status
- 🌙 **Toggle between dark/light themes**
- 📱 **Use on any device** with full responsiveness

The platform is built as a **frontend prototype** with mock data, designed to demonstrate UI/UX capabilities and can be extended with a real backend.

### Key Features

| Feature | Description |
|---------|-------------|
| 🎨 **Dark/Light Mode** | Full theme support with smooth transitions |
| 🏟️ **Match Predictions** | Vote on 1/X/2 outcomes with live stats |
| 🎠 **Hero Carousel** | Auto-advancing promotional banner |
| 🔔 **Notification System** | Badge indicators for messages/friends/alerts |
| 📱 **Responsive Design** | Mobile-first approach, works on all devices |
| 💾 **Local Persistence** | Votes and theme saved to localStorage |

---

## 🏗 Project Structure

```
/app
├── frontend/                    # React Frontend Application
│   ├── public/
│   │   └── index.html          # HTML entry point
│   ├── src/
│   │   ├── components/
│   │   │   ├── home/           # Home page components
│   │   │   │   ├── PromoBanner.jsx      # Hero carousel (theme-independent)
│   │   │   │   ├── TabsSection.jsx      # Navigation tabs
│   │   │   │   ├── LeagueFilters.jsx    # League filter chips
│   │   │   │   ├── TopMatchesCards.jsx  # Featured match cards
│   │   │   │   ├── MatchCard.jsx        # Individual match card
│   │   │   │   └── MatchList.jsx        # Full match list
│   │   │   ├── layout/
│   │   │   │   └── Header.jsx           # App header with auth modal
│   │   │   └── ui/                      # Shadcn UI components
│   │   │       ├── button.jsx
│   │   │       ├── avatar.jsx
│   │   │       ├── dialog.jsx
│   │   │       ├── card.jsx
│   │   │       └── ...
│   │   ├── data/
│   │   │   └── mockData.js     # Mock matches, users, and slides
│   │   ├── hooks/
│   │   │   ├── useLocalStorage.js  # localStorage hook
│   │   │   └── use-toast.js        # Toast notifications
│   │   ├── lib/
│   │   │   ├── ThemeContext.js     # Dark/Light mode context
│   │   │   └── utils.js            # Utility functions (cn)
│   │   ├── pages/
│   │   │   └── HomePage.jsx    # Main home page
│   │   ├── App.js              # Root component
│   │   ├── App.css             # Global styles
│   │   └── index.css           # Tailwind + CSS variables
│   ├── package.json
│   └── tailwind.config.js
├── backend/                     # FastAPI Backend (for future use)
│   ├── server.py
│   └── requirements.txt
├── memory/
│   └── PRD.md                  # Product Requirements Document
└── README.md                   # This file
```

### Component Architecture

```
App.js
└── ThemeProvider (Context)
    └── BrowserRouter
        └── HomePage
            ├── Header
            │   ├── Logo
            │   ├── NavigationIcons (Messages, Friends, Notifications)
            │   ├── ThemeToggle
            │   ├── UserAvatar
            │   └── AuthRequiredModal
            ├── PromoBanner (Theme-Independent)
            │   ├── SlideContent
            │   ├── NavButtons
            │   └── DotIndicators
            ├── TabsSection
            ├── LeagueFilters
            ├── TopMatchesCards
            └── MatchList
                └── MatchRow[]
```

---

## 🛠 Technologies Used

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.0.0 | UI Framework |
| **React Router** | 7.5.1 | Client-side routing |
| **Tailwind CSS** | 3.4.17 | Utility-first styling |
| **Shadcn/UI** | Latest | Accessible UI components |
| **Radix UI** | Various | Headless UI primitives |
| **Lucide React** | 0.507.0 | Icon library |
| **Framer Motion** | - | Animations (available) |
| **Sonner** | 2.0.3 | Toast notifications |
| **Axios** | 1.8.4 | HTTP client |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.115.12 | REST API Framework |
| **MongoDB** | - | Document database |
| **Motor** | - | Async MongoDB driver |
| **Pydantic** | 2.x | Data validation |
| **Passlib** | - | Password hashing (bcrypt) |
| **HTTPX** | - | Async HTTP client |

### Authentication

| Method | Description |
|--------|-------------|
| **Email/Password** | Traditional registration with password requirements |
| **Google OAuth** | Via Emergent Auth service |
| **Sessions** | HTTP-only cookies with 7-day expiry |
| **Nicknames** | Unique username system with validation |

### Build Tools

| Tool | Purpose |
|------|---------|
| **CRACO** | Create React App Configuration Override |
| **PostCSS** | CSS processing |
| **Autoprefixer** | CSS vendor prefixing |
| **ESLint** | Code linting |

### State Management

- **React Context API** - Theme and Auth management
- **React Hooks** - Local component state
- **localStorage** - Theme persistence

---

## ⚙ How To Run Locally

### Prerequisites

- **Node.js** >= 18.0.0
- **Yarn** >= 1.22.0
- **Git**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Farhad-Iskandarov/NovaTech.git
cd NovaTech

# 2. Navigate to frontend
cd frontend

# 3. Install dependencies
yarn install

# 4. Create environment file
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env

# 5. Start development server
yarn start
```

### Available Scripts

```bash
# Development
yarn start          # Start dev server on http://localhost:3000

# Production Build
yarn build          # Create optimized production build

# Testing
yarn test           # Run test suite

# Linting
yarn lint           # Check for code issues
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `http://localhost:8001` |
| `WDS_SOCKET_PORT` | WebSocket port | `443` |

---

## 🌙 Feature Documentation

### Dark/Light Mode System

The theme system is implemented using React Context API with localStorage persistence.

**Architecture:**

```javascript
// ThemeContext.js
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('guessit-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('guessit-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**Usage in Components:**

```javascript
import { useTheme } from '@/lib/ThemeContext';

const Component = () => {
  const { theme, toggleTheme, isDark } = useTheme();
  return <button onClick={toggleTheme}>Toggle Theme</button>;
};
```

**CSS Variables (index.css):**

```css
:root {
  /* Light mode variables */
  --background: 210 20% 98%;
  --foreground: 222 47% 11%;
  --primary: 142 70% 40%;
}

.dark {
  /* Dark mode variables */
  --background: 0 0% 8%;
  --foreground: 0 0% 98%;
  --primary: 142 70% 45%;
}
```

### Banner Carousel (Theme-Independent)

The promotional banner is **excluded from theme changes** to maintain visual consistency.

**Key Implementation:**

```jsx
// Fixed colors that don't use CSS variables
<h1 className="text-white">...</h1>  // Not text-foreground
<span className="text-[#facc15]">...</span>  // Fixed yellow
<div style={{
  backgroundImage: `linear-gradient(rgba(20, 20, 20, 0.95)...)`
}}>
```

### Header Authentication Logic

The header displays different elements based on authentication state.

**When NOT Logged In (isAuthenticated = false):**
| Element | Visibility |
|---------|------------|
| Logo | ✅ Visible |
| Search | ✅ Visible |
| Messages | ❌ Hidden |
| Friends | ❌ Hidden |
| Notifications | ❌ Hidden |
| Theme Toggle | ✅ Visible |
| Login Button | ✅ Visible |
| Register Button | ✅ Visible |
| User Avatar | ❌ Hidden |

**When Logged In (isAuthenticated = true):**
| Element | Visibility |
|---------|------------|
| Logo | ✅ Visible |
| Search | ✅ Visible |
| Messages | ✅ Visible (with badge) |
| Friends | ✅ Visible (with badge) |
| Notifications | ✅ Visible (with badge) |
| Theme Toggle | ✅ Visible |
| Login Button | ❌ Hidden |
| Register Button | ❌ Hidden |
| User Avatar | ✅ Visible (with dropdown) |

**Icon Features:**
- All icons have tooltips on hover
- Badge counters only appear when count > 0
- Avatar opens dropdown menu with Profile, Settings, Logout options

```javascript
// Dynamic header rendering
{isAuthenticated ? (
  <>
    <HeaderIconButton icon={Mail} badge={notifications.messages} tooltip="Messages" />
    <HeaderIconButton icon={Users} badge={notifications.friends} tooltip="Friend Requests" />
    <HeaderIconButton icon={Bell} badge={notifications.alerts} tooltip="Notifications" />
    <UserDropdownMenu user={user} onLogout={handleLogout} />
  </>
) : (
  <div className="flex gap-2">
    <Button onClick={onLogin}>Login</Button>
    <Button variant="default" onClick={onLogin}>Register</Button>
  </div>
)}
```

### Voting System

```javascript
// useLocalStorage hook for vote persistence
const { votes, addVote, hasVoted, getVote } = useVotes();

// Adding a vote
const handleVote = (matchId, prediction) => {
  addVote(matchId, prediction);
  toast.success('Vote submitted!');
};
```

---

## 🚀 Performance Strategy

### Optimization Techniques

| Technique | Implementation |
|-----------|---------------|
| **Memoization** | `React.memo()` on components, `useCallback` for handlers |
| **Code Splitting** | Lazy loading ready (can add `React.lazy()`) |
| **Virtualization** | Ready for `react-window` for large lists |
| **Image Optimization** | Lazy loading, proper sizing |
| **Bundle Size** | Tree-shaking, minimal dependencies |

### Component Memoization Example

```javascript
// PromoBanner.jsx
const SlideContent = memo(({ slide }) => (
  <div>...</div>
));

const NavButton = memo(({ direction, onClick }) => (
  <button>...</button>
));

export default memo(PromoBanner);
```

### Event Handler Optimization

```javascript
// Using useCallback to prevent unnecessary re-renders
const handleVote = useCallback((matchId, prediction) => {
  addVote(matchId, prediction);
}, [addVote]);

const toggleTheme = useCallback(() => {
  setTheme(prev => prev === 'light' ? 'dark' : 'light');
}, []);
```

### Rendering Efficiency

- **CSS Transitions** instead of JavaScript animations
- **will-change** CSS property for animated elements
- **Passive event listeners** for scroll events
- **Debounced** user inputs where applicable

---

## 🔐 Security Measures

### Input Validation

```javascript
// Validate vote types
const setTheme = (newTheme) => {
  if (['light', 'dark'].includes(newTheme)) {
    setThemeState(newTheme);
  }
};

// Sanitize user inputs
const sanitizeInput = (input) => {
  return input.replace(/<[^>]*>/g, '');
};
```

### XSS Prevention

- No `dangerouslySetInnerHTML` usage
- All user content rendered through React's built-in escaping
- Content Security Policy ready

### Authentication Security (Future)

- JWT tokens stored in httpOnly cookies
- CSRF protection ready
- Rate limiting on API endpoints
- Input sanitization on all forms

### localStorage Security

```javascript
// Only non-sensitive data stored locally
localStorage.setItem('guessit-theme', 'dark');  // OK
localStorage.setItem('guessit_votes', JSON.stringify(votes));  // OK
// Never store: passwords, tokens, PII
```

---

## 📦 Scalability Plan

### Current Architecture Benefits

| Aspect | Implementation |
|--------|---------------|
| **Modular Components** | Each component is self-contained |
| **Context-based State** | Easy to add more contexts |
| **API-ready** | Axios configured, endpoints ready |
| **Type Safety Ready** | Can add TypeScript incrementally |

### Future Scaling Path

```
Phase 1 (Current): Frontend Prototype
├── Mock data
├── localStorage persistence
└── Client-side routing

Phase 2: Backend Integration
├── FastAPI backend
├── MongoDB database
├── JWT authentication
└── Real-time updates (WebSocket)

Phase 3: Production Scale
├── CDN for static assets
├── Redis for caching
├── Load balancing
├── Horizontal scaling
└── Microservices (if needed)
```

### Database Design (Future)

```javascript
// Matches Collection
{
  _id: ObjectId,
  homeTeam: { name, shortName, flag },
  awayTeam: { name, shortName, flag },
  competition: String,
  dateTime: Date,
  votes: {
    home: { count: Number, percentage: Number },
    draw: { count: Number, percentage: Number },
    away: { count: Number, percentage: Number }
  },
  totalVotes: Number,
  status: 'upcoming' | 'live' | 'finished'
}

// Users Collection
{
  _id: ObjectId,
  email: String,
  passwordHash: String,
  votes: [{ matchId, prediction, timestamp }],
  stats: { correct: Number, total: Number }
}
```

### API Design (Future)

```javascript
// RESTful Endpoints
GET    /api/matches              // List matches
GET    /api/matches/:id          // Get match details
POST   /api/matches/:id/vote     // Submit vote
GET    /api/users/me             // Get current user
GET    /api/leaderboard          // Get rankings
```

---

## 🧪 Testing Strategy

### Unit Tests (Jest)

```javascript
// Example test structure
describe('VoteButton', () => {
  it('renders correct label for home vote', () => {...});
  it('shows active state when selected', () => {...});
  it('calls onClick with correct type', () => {...});
});
```

### Integration Tests (React Testing Library)

```javascript
describe('HomePage', () => {
  it('renders all main sections', () => {...});
  it('filters matches by league', () => {...});
  it('submits vote and shows toast', () => {...});
});
```

### E2E Tests (Playwright)

```javascript
test('complete voting flow', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="vote-home"]');
  await expect(page.locator('.toast')).toBeVisible();
});
```

---

## 📄 API Reference

### Health Check

```http
GET /api/health
Response: {"status": "healthy", "timestamp": "..."}
```

### Authentication

```http
# Register with email/password
POST /api/auth/register
Body: {"email": "...", "password": "...", "confirm_password": "..."}
Response: {"user": {...}, "requires_nickname": true}

# Login with email/password
POST /api/auth/login
Body: {"email": "...", "password": "..."}
Response: {"user": {...}, "requires_nickname": false}

# Google OAuth callback
POST /api/auth/google/callback
Body: {"session_id": "..."}
Response: {"user": {...}, "requires_nickname": true/false}

# Set unique nickname
POST /api/auth/nickname
Body: {"nickname": "..."}
Response: {"user": {...}, "requires_nickname": false}

# Check nickname availability
GET /api/auth/nickname/check?nickname=...
Response: {"available": true/false, "message": "...", "suggestions": [...]}

# Get current user
GET /api/auth/me
Response: {"user_id": "...", "email": "...", "nickname": "...", ...}

# Logout
POST /api/auth/logout
Response: {"message": "Logged out successfully"}
```

### Predictions

```http
# Create/Update prediction
POST /api/predictions
Body: {"match_id": 1, "prediction": "home|draw|away"}
Response: {"prediction_id": "...", "match_id": 1, "prediction": "home", "is_new": true/false}

# Get all user predictions
GET /api/predictions/me
Response: {"predictions": [...], "total": 5}

# Get prediction for specific match
GET /api/predictions/match/{match_id}
Response: {"prediction_id": "...", "match_id": 1, "prediction": "home", ...}

# Delete prediction
DELETE /api/predictions/match/{match_id}
Response: {"message": "Prediction deleted successfully"}
```

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Nickname Requirements
- 3-20 characters
- Letters, numbers, underscores only
- No spaces
- Case-insensitive uniqueness

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is **private** - All rights reserved.

---

## 👨‍💻 Author

**Farhad Iskandarov**

- GitHub: [@Farhad-Iskandarov](https://github.com/Farhad-Iskandarov)

---

## 🙏 Acknowledgments

- [Shadcn/UI](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Lucide](https://lucide.dev/) - Icon library
- [Radix UI](https://www.radix-ui.com/) - Accessible primitives

---

<div align="center">

**Built with ❤️ using React and Tailwind CSS**

</div>
