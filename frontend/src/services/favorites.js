import { createApiError } from '@/utils/errorHandler';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

let favoritesCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

function invalidateCache() {
  favoritesCache = null;
  cacheTimestamp = 0;
}

export const getFavoriteClubs = async () => {
  if (favoritesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return favoritesCache;
  }
  const response = await fetch(`${API_URL}/api/favorites/clubs`, {
    credentials: 'include',
  });
  if (!response.ok) {
    if (response.status === 401) return { favorites: [] };
    throw await createApiError(response, 'Could not load favorites. Please try again.', 'getFavoriteClubs');
  }
  const data = await response.json();
  favoritesCache = data;
  cacheTimestamp = Date.now();
  return data;
};

export const addFavoriteClub = async (teamId, teamName, teamCrest) => {
  const response = await fetch(`${API_URL}/api/favorites/clubs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ team_id: teamId, team_name: teamName, team_crest: teamCrest }),
  });
  if (!response.ok) {
    throw await createApiError(response, 'Could not add to favorites. Please try again.', 'addFavoriteClub');
  }
  invalidateCache();
  return await response.json();
};

export const removeFavoriteClub = async (teamId) => {
  const response = await fetch(`${API_URL}/api/favorites/clubs/${teamId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw await createApiError(response, 'Could not remove from favorites. Please try again.', 'removeFavoriteClub');
  }
  invalidateCache();
  return await response.json();
};
