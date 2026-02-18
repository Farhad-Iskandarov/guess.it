const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Fetch matches from our backend (which proxies Football-Data.org)
 */
export const fetchMatches = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.dateFrom) searchParams.set('date_from', params.dateFrom);
  if (params.dateTo) searchParams.set('date_to', params.dateTo);
  if (params.competition) searchParams.set('competition', params.competition);
  if (params.status) searchParams.set('status', params.status);

  const url = `${API_URL}/api/football/matches?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch matches');
  return response.json();
};

/**
 * Fetch today's matches
 */
export const fetchTodayMatches = async () => {
  const response = await fetch(`${API_URL}/api/football/matches/today`);
  if (!response.ok) throw new Error('Failed to fetch today matches');
  return response.json();
};

/**
 * Fetch live matches
 */
export const fetchLiveMatches = async () => {
  const response = await fetch(`${API_URL}/api/football/matches/live`);
  if (!response.ok) throw new Error('Failed to fetch live matches');
  return response.json();
};

/**
 * Fetch upcoming matches
 */
export const fetchUpcomingMatches = async (days = 7) => {
  const response = await fetch(`${API_URL}/api/football/matches/upcoming?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch upcoming matches');
  return response.json();
};

/**
 * Fetch matches for a specific competition
 */
export const fetchCompetitionMatches = async (code) => {
  const response = await fetch(`${API_URL}/api/football/matches/competition/${code}`);
  if (!response.ok) throw new Error('Failed to fetch competition matches');
  return response.json();
};

/**
 * Fetch available competitions
 */
export const fetchCompetitions = async () => {
  const response = await fetch(`${API_URL}/api/football/competitions`);
  if (!response.ok) throw new Error('Failed to fetch competitions');
  return response.json();
};

/**
 * Search matches by team name
 */
export const searchMatches = async (query) => {
  const response = await fetch(`${API_URL}/api/football/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Failed to search matches');
  return response.json();
};
