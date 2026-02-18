const API_URL = process.env.REACT_APP_BACKEND_URL || '';

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

  return await response.json();
};

/**
 * Get all predictions for current user
 */
export const getMyPredictions = async () => {
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

  return await response.json();
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

  return await response.json();
};
