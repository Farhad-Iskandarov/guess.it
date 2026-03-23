import { createApiError } from '@/utils/errorHandler';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============ In-Memory Prediction Cache ============
const predictionCache = {};
const PREDICTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = predictionCache[key];
  if (entry && Date.now() - entry.timestamp < PREDICTION_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  predictionCache[key] = { data, timestamp: Date.now() };
}

function invalidateCache(key) {
  if (key) {
    delete predictionCache[key];
  } else {
    Object.keys(predictionCache).forEach(k => delete predictionCache[k]);
  }
}

/**
 * Save or update a prediction
 */
export const savePrediction = async (matchId, prediction) => {
  const response = await fetch(`${API_URL}/api/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ match_id: matchId, prediction }),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Could not save your prediction. Please try again.', 'savePrediction');
  }

  invalidateCache();
  return await response.json();
};

/**
 * Get all predictions for current user (with cache)
 */
export const getMyPredictions = async () => {
  const cacheKey = 'my_predictions';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/predictions/me`, {
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { predictions: [], total: 0 };
    }
    throw await createApiError(response, 'Could not load predictions. Please try again.', 'getMyPredictions');
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Get detailed predictions for current user (with cache)
 */
export const getMyDetailedPredictions = async () => {
  const cacheKey = 'my_detailed_predictions';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/predictions/me/detailed`, {
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { predictions: [], total: 0, summary: {} };
    }
    throw await createApiError(response, 'Could not load predictions. Please try again.', 'getMyDetailedPredictions');
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};

/**
 * Get prediction for a specific match
 */
export const getPredictionForMatch = async (matchId) => {
  const response = await fetch(`${API_URL}/api/predictions/match/${matchId}`, {
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await createApiError(response, 'Could not load prediction. Please try again.', 'getPredictionForMatch');
  }

  return await response.json();
};

/**
 * Delete a prediction
 */
export const deletePrediction = async (matchId) => {
  const response = await fetch(`${API_URL}/api/predictions/match/${matchId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw await createApiError(response, 'Could not remove your prediction. Please try again.', 'deletePrediction');
  }

  invalidateCache();
  return await response.json();
};

// ==================== Exact Score Predictions ====================

/**
 * Save an exact score prediction (can only be done once per match)
 */
export const saveExactScorePrediction = async (matchId, homeScore, awayScore) => {
  const response = await fetch(`${API_URL}/api/predictions/exact-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ 
      match_id: matchId, 
      home_score: homeScore, 
      away_score: awayScore 
    }),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Could not save exact score. Please try again.', 'saveExactScorePrediction');
  }

  invalidateCache();
  return await response.json();
};

/**
 * Get exact score prediction for a specific match
 */
export const getExactScorePrediction = async (matchId) => {
  const response = await fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, {
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await createApiError(response, 'Could not load exact score prediction. Please try again.', 'getExactScorePrediction');
  }

  return await response.json();
};

/**
 * Delete exact score prediction for a match
 */
export const deleteExactScorePrediction = async (matchId) => {
  const response = await fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw await createApiError(response, 'Could not remove exact score prediction. Please try again.', 'deleteExactScorePrediction');
  }

  invalidateCache();
  return await response.json();
};

/**
 * Update an exact score prediction (only before match starts)
 */
export const updateExactScorePrediction = async (matchId, homeScore, awayScore) => {
  const response = await fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore
    }),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Could not update exact score. Please try again.', 'updateExactScorePrediction');
  }

  invalidateCache();
  return await response.json();
};

/**
 * Get all exact score predictions for current user
 */
export const getMyExactScorePredictions = async () => {
  const cacheKey = 'my_exact_score_predictions';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_URL}/api/predictions/exact-score/me`, {
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { exact_score_predictions: [], total: 0 };
    }
    throw await createApiError(response, 'Could not load exact score predictions. Please try again.', 'getMyExactScorePredictions');
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return data;
};
