const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============ In-Memory Cache ============
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for non-live data
const LIVE_CACHE_TTL = 30 * 1000; // 30 seconds for live data

function getCached(key) {
  const entry = cache[key];
  if (!entry) return null;
  const ttl = key.includes('live') ? LIVE_CACHE_TTL : CACHE_TTL;
  if (Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

// Return stale data if available (for instant display while refreshing)
function getStale(key) {
  const entry = cache[key];
  return entry ? entry.data : null;
}

/**
 * Fetch matches from our backend (which proxies Football-Data.org)
 */
export const fetchMatches = async (params = {}, { skipCache = false } = {}) => {
  const searchParams = new URLSearchParams();
  if (params.dateFrom) searchParams.set('date_from', params.dateFrom);
  if (params.dateTo) searchParams.set('date_to', params.dateTo);
  if (params.competition) searchParams.set('competition', params.competition);
  if (params.status) searchParams.set('status', params.status);

  const cacheKey = `matches_${searchParams.toString()}`;

  if (!skipCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const url = `${API_URL}/api/football/matches?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch matches');
  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Fetch today's matches
 */
export const fetchTodayMatches = async () => {
  const cacheKey = 'matches_today';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/football/matches/today`);
  if (!response.ok) throw new Error('Failed to fetch today matches');
  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Fetch live matches
 */
export const fetchLiveMatches = async () => {
  const cacheKey = 'matches_live';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/football/matches/live`);
  if (!response.ok) throw new Error('Failed to fetch live matches');
  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Fetch upcoming matches
 */
export const fetchUpcomingMatches = async (days = 7) => {
  const cacheKey = `matches_upcoming_${days}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/football/matches/upcoming?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch upcoming matches');
  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Fetch matches for a specific competition
 */
export const fetchCompetitionMatches = async (code) => {
  const cacheKey = `matches_competition_${code}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/football/matches/competition/${code}`);
  if (!response.ok) throw new Error('Failed to fetch competition matches');
  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Fetch available competitions
 */
export const fetchCompetitions = async () => {
  const cacheKey = 'competitions';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/football/competitions`);
  if (!response.ok) throw new Error('Failed to fetch competitions');
  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Search matches by team name
 */
export const searchMatches = async (query) => {
  const response = await fetch(`${API_URL}/api/football/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Failed to search matches');
  return response.json();
};

/**
 * Get stale cached data for a league (for instant page display)
 */
export const getStaleCachedMatches = (leagueId) => {
  if (leagueId === 'live') return getStale('matches_live');
  if (leagueId === 'all') return getStale('matches_');
  return getStale(`matches_competition_${leagueId}`);
};


/**
 * Fetch recently ended matches (within last 24 hours)
 */
export const fetchEndedMatches = async () => {
  const cacheKey = 'matches_ended';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/football/matches/ended`);
  if (!response.ok) throw new Error('Failed to fetch ended matches');
  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};
