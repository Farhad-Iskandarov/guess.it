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
    // Invalidate all prediction caches
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
    const error = await response.json();
    throw new Error(error.detail || 'Failed to save prediction');
  }

  // Invalidate caches on mutation
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
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch predictions');
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
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch predictions');
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
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch prediction');
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
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete prediction');
  }

  // Invalidate caches on mutation
  invalidateCache();
  return await response.json();
};
