// Mock data for GuessIt Football Prediction App
// All data is simulated - no real betting or money involved

export const mockMatches = [
  {
    id: 1,
    homeTeam: {
      name: "Portugal",
      shortName: "POR",
      flag: "🇵🇹",
      logo: null
    },
    awayTeam: {
      name: "Poland",
      shortName: "POL",
      flag: "🇵🇱",
      logo: null
    },
    competition: "European Championships",
    sport: "Futsal",
    dateTime: "Today, 8:30 PM",
    status: "upcoming",
    votes: {
      home: { count: 1245, percentage: 62 },
      draw: { count: 310, percentage: 15 },
      away: { count: 95, percentage: 23 }
    },
    totalVotes: 1650,
    mostPicked: "Home",
    featured: true
  },
  {
    id: 2,
    homeTeam: {
      name: "Real Madrid",
      shortName: "RMA",
      flag: null,
      logo: "⚪"
    },
    awayTeam: {
      name: "Man City",
      shortName: "MCI",
      flag: null,
      logo: "🔵"
    },
    competition: "UEFA Champions League",
    sport: "Football",
    dateTime: "Tomorrow, 9:00 PM",
    status: "upcoming",
    votes: {
      home: { count: 3120, percentage: 52 },
      draw: { count: 1865, percentage: 31 },
      away: { count: 1050, percentage: 17 }
    },
    totalVotes: 6035,
    mostPicked: "Home",
    featured: true
  },
  {
    id: 3,
    homeTeam: {
      name: "Barcelona",
      shortName: "BAR",
      flag: null,
      logo: "🔴"
    },
    awayTeam: {
      name: "Bayern Munich",
      shortName: "BAY",
      flag: null,
      logo: "🔴"
    },
    competition: "UEFA Champions League",
    sport: "Football",
    dateTime: "Tomorrow, 9:00 PM",
    status: "upcoming",
    votes: {
      home: { count: 2890, percentage: 45 },
      draw: { count: 1920, percentage: 30 },
      away: { count: 1590, percentage: 25 }
    },
    totalVotes: 6400,
    mostPicked: "Home",
    featured: false
  },
  {
    id: 4,
    homeTeam: {
      name: "Liverpool",
      shortName: "LIV",
      flag: null,
      logo: "🔴"
    },
    awayTeam: {
      name: "Arsenal",
      shortName: "ARS",
      flag: null,
      logo: "🔴"
    },
    competition: "Premier League",
    sport: "Football",
    dateTime: "Saturday, 3:00 PM",
    status: "upcoming",
    votes: {
      home: { count: 4200, percentage: 48 },
      draw: { count: 2100, percentage: 24 },
      away: { count: 2450, percentage: 28 }
    },
    totalVotes: 8750,
    mostPicked: "Home",
    featured: false
  },
  {
    id: 5,
    homeTeam: {
      name: "Atletico Madrid",
      shortName: "ATM",
      flag: null,
      logo: "🔴"
    },
    awayTeam: {
      name: "Sevilla",
      shortName: "SEV",
      flag: null,
      logo: "⚪"
    },
    competition: "La Liga",
    sport: "Football",
    dateTime: "Sunday, 8:00 PM",
    status: "upcoming",
    votes: {
      home: { count: 1890, percentage: 55 },
      draw: { count: 980, percentage: 29 },
      away: { count: 550, percentage: 16 }
    },
    totalVotes: 3420,
    mostPicked: "Home",
    featured: false
  },
  {
    id: 6,
    homeTeam: {
      name: "Brazil",
      shortName: "BRA",
      flag: "🇧🇷",
      logo: null
    },
    awayTeam: {
      name: "Argentina",
      shortName: "ARG",
      flag: "🇦🇷",
      logo: null
    },
    competition: "International Friendly",
    sport: "Football",
    dateTime: "Friday, 11:00 PM",
    status: "upcoming",
    votes: {
      home: { count: 5600, percentage: 42 },
      draw: { count: 2800, percentage: 21 },
      away: { count: 4900, percentage: 37 }
    },
    totalVotes: 13300,
    mostPicked: "Home",
    featured: false
  },
  {
    id: 7,
    homeTeam: {
      name: "Qarabag",
      shortName: "QBG",
      flag: "🇦🇿",
      logo: null
    },
    awayTeam: {
      name: "Neftchi",
      shortName: "NFT",
      flag: "🇦🇿",
      logo: null
    },
    competition: "Azerbaijan League",
    sport: "Football",
    dateTime: "Today, 6:00 PM",
    status: "live",
    votes: {
      home: { count: 890, percentage: 58 },
      draw: { count: 420, percentage: 27 },
      away: { count: 230, percentage: 15 }
    },
    totalVotes: 1540,
    mostPicked: "Home",
    featured: false
  },
  {
    id: 8,
    homeTeam: {
      name: "Inter Milan",
      shortName: "INT",
      flag: null,
      logo: "🔵"
    },
    awayTeam: {
      name: "AC Milan",
      shortName: "ACM",
      flag: null,
      logo: "🔴"
    },
    competition: "Serie A",
    sport: "Football",
    dateTime: "Sunday, 7:45 PM",
    status: "upcoming",
    votes: {
      home: { count: 3450, percentage: 46 },
      draw: { count: 1950, percentage: 26 },
      away: { count: 2100, percentage: 28 }
    },
    totalVotes: 7500,
    mostPicked: "Home",
    featured: false
  }
];

export const mockLeagues = [
  { id: "today", name: "Today", active: false },
  { id: "live", name: "Live", active: false },
  { id: "upcoming", name: "Upcoming", active: false },
  { id: "ucl", name: "UCL", active: true },
  { id: "premier-league", name: "Premier League", active: false },
  { id: "la-liga", name: "La Liga", active: false },
  { id: "serie-a", name: "Serie A", active: false },
  { id: "international", name: "International", active: false },
  { id: "azerbaijan-league", name: "Azerbaijan League", active: false }
];

export const mockTabs = [
  { id: "top-matches", name: "Top Matches", icon: "fire" },
  { id: "popular", name: "Popular", active: true },
  { id: "top-live", name: "Top Live" },
  { id: "soon", name: "Soon" }
];

export const mockUser = {
  id: 1,
  name: "John Doe",
  avatar: null,
  notifications: {
    messages: 10,
    friends: 3,
    alerts: 5
  }
};

export const mockBannerSlides = [
  {
    id: 1,
    headline: "Predict Football",
    highlightedText: "Matches!",
    subtitle: "Join football fans in predicting match outcomes and events.",
    ctaText: "Get Started",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
    badge: "Guessd.app"
  },
  {
    id: 2,
    headline: "Win Bragging",
    highlightedText: "Rights!",
    subtitle: "Compete with friends and show off your prediction skills.",
    ctaText: "Join Now",
    image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80",
    badge: "Free to Play"
  },
  {
    id: 3,
    headline: "Track Your",
    highlightedText: "Stats!",
    subtitle: "See your prediction accuracy and climb the leaderboards.",
    ctaText: "View Stats",
    image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80",
    badge: "Leaderboards"
  }
];

// Team logo mapping using country flags or team colors
export const teamLogos = {
  "Portugal": "🇵🇹",
  "Poland": "🇵🇱",
  "Real Madrid": "⚪",
  "Man City": "🔵",
  "Barcelona": "🔴",
  "Bayern Munich": "🔴",
  "Liverpool": "🔴",
  "Arsenal": "🔴",
  "Atletico Madrid": "🔴",
  "Sevilla": "⚪",
  "Brazil": "🇧🇷",
  "Argentina": "🇦🇷",
  "Qarabag": "🇦🇿",
  "Neftchi": "🇦🇿",
  "Inter Milan": "🔵",
  "AC Milan": "🔴"
};
