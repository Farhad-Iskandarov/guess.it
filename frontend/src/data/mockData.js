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
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&h=800&fit=crop&q=80",
    score: "0-2",
    homeCrest: "https://crests.football-data.org/58.png",
    awayCrest: "https://crests.football-data.org/57.png",
    details: ["47' L. Trossard", "77' T. Partey"],
    badge: null,
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=600&h=800&fit=crop&q=80",
    score: "1-2",
    homeCrest: "https://crests.football-data.org/77.png",
    awayCrest: "https://crests.football-data.org/81.png",
    details: ["11' Borja V.", "34' R. Araujo", "89' F. de Jong"],
    badge: null,
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&h=800&fit=crop&q=80",
    score: "3-1",
    homeCrest: "https://crests.football-data.org/5.png",
    awayCrest: "https://crests.football-data.org/524.png",
    details: ["12' Vinicius Jr.", "55' Bellingham", "78' Rodrygo"],
    badge: null,
  },
  {
    id: 4,
    image: "https://images.unsplash.com/photo-1551384732-fb4f003640e4?w=600&h=800&fit=crop&q=80",
    score: "2-0",
    homeCrest: "https://crests.football-data.org/64.png",
    awayCrest: "https://crests.football-data.org/73.png",
    details: ["23' Salah", "67' Diaz"],
    badge: null,
  },
  {
    id: 5,
    image: "https://images.unsplash.com/photo-1600985366045-c20ec2d3298a?w=600&h=800&fit=crop&q=80",
    score: "1-1",
    homeCrest: "https://crests.football-data.org/108.png",
    awayCrest: "https://crests.football-data.org/113.png",
    details: ["32' Lautaro", "88' Leao"],
    badge: null,
  },
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
