/**
 * Centralized Error Handling Utility
 * - Prevents "body stream already read" errors
 * - Maps technical errors to user-friendly messages
 * - Logs real errors internally for debugging
 */

const FRIENDLY_MESSAGES = {
  prediction: {
    save: 'Could not save your prediction. Please try again.',
    remove: 'Could not remove your prediction. Please try again.',
    fetch: 'Could not load predictions. Please try again.',
    score: 'Could not save exact score. Please try again.',
    rateLimit: 'Too many predictions. Please wait a moment and try again.',
  },
  auth: {
    login: 'Login failed. Please check your credentials.',
    register: 'Registration failed. Please try again.',
    session: 'Your session has expired. Please log in again.',
    nickname: 'Could not update nickname. Please try again.',
  },
  friends: {
    search: 'Could not search users. Please try again.',
    request: 'Could not send friend request. Please try again.',
    accept: 'Could not accept request. Please try again.',
    decline: 'Could not decline request. Please try again.',
    cancel: 'Could not cancel request. Please try again.',
    remove: 'Could not remove friend. Please try again.',
    fetch: 'Could not load friends. Please try again.',
  },
  messages: {
    send: 'Could not send message. Please try again.',
    fetch: 'Could not load messages. Please try again.',
  },
  matches: {
    fetch: 'Could not load matches. Please try again.',
  },
  favorites: {
    add: 'Could not add to favorites. Please try again.',
    remove: 'Could not remove from favorites. Please try again.',
    fetch: 'Could not load favorites. Please try again.',
  },
  settings: {
    update: 'Could not update settings. Please try again.',
    upload: 'Could not upload image. Please try again.',
  },
  general: 'Something went wrong. Please try again.',
};

/**
 * Safely extract error detail from a fetch Response.
 * Reads body at most once; never throws "body stream already read".
 */
export async function extractApiError(response) {
  try {
    const data = await response.json();
    return data?.detail || null;
  } catch {
    return null;
  }
}

/**
 * Create an API error: logs the real detail internally,
 * returns a clean Error with user-friendly message.
 *
 * @param {Response} response - fetch Response object
 * @param {string}   friendlyMsg - user-facing fallback message
 * @param {string}   [context] - internal context for logging (e.g. "savePrediction")
 */
export async function createApiError(response, friendlyMsg, context) {
  const detail = await extractApiError(response);

  // Rate limit has its own message
  if (response.status === 429) {
    return new Error(FRIENDLY_MESSAGES.prediction.rateLimit);
  }

  // Log the real error internally
  if (detail) {
    console.error(`[API Error${context ? ` | ${context}` : ''}] ${response.status}: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
  }

  // For certain known backend messages, use them directly
  // (e.g. "This email is already registered. Please log in instead.")
  if (typeof detail === 'string' && isUserSafeMessage(detail)) {
    return new Error(detail);
  }

  return new Error(friendlyMsg);
}

/**
 * Check if a backend message is safe to show to users.
 * Only allow messages that are clearly written for end-users.
 */
function isUserSafeMessage(msg) {
  if (!msg || typeof msg !== 'string') return false;
  const lower = msg.toLowerCase();
  // Block technical-looking messages
  const technicalPatterns = [
    'failed to execute', 'body stream', 'json', 'traceback',
    'internal server', 'typeerror', 'referenceerror', 'syntaxerror',
    'module', 'import', 'undefined', 'null', 'nan', 'stack',
    'mongodb', 'redis', 'pymongo', 'motor', 'asyncio', 'connection refused',
  ];
  if (technicalPatterns.some(p => lower.includes(p))) return false;

  // Allow messages that sound user-friendly
  const userPatterns = [
    'already', 'please', 'not found', 'not allowed',
    'taken', 'invalid', 'expired', 'required', 'too many',
    'must be', 'cannot', 'match has', 'nickname',
  ];
  return userPatterns.some(p => lower.includes(p));
}

/**
 * Get a friendly message for a given category and action.
 */
export function getFriendlyMessage(category, action) {
  return FRIENDLY_MESSAGES[category]?.[action] || FRIENDLY_MESSAGES.general;
}

/**
 * Sanitize an error message before showing to users.
 * If it looks technical, replace with a generic message.
 */
export function sanitizeErrorMessage(error, fallback) {
  const msg = error?.message || '';
  if (isUserSafeMessage(msg)) return msg;
  // If it starts with "Failed to" from our services, it's semi-OK but let's clean it up
  if (msg.startsWith('Could not') || msg.startsWith('Please')) return msg;
  return fallback || FRIENDLY_MESSAGES.general;
}

export default FRIENDLY_MESSAGES;
