/**
 * Friends API Service
 * Real-time friendship system
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ==================== Cache ====================
let friendsCache = null;
let pendingCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

const invalidateCache = () => {
  friendsCache = null;
  pendingCache = null;
  cacheTimestamp = 0;
};

// ==================== API Functions ====================

/**
 * Search users by nickname
 */
export const searchUsers = async (query) => {
  if (!query || query.length < 2) return { users: [], total: 0 };
  
  const response = await fetch(
    `${API_URL}/api/friends/search?q=${encodeURIComponent(query)}`,
    { credentials: 'include' }
  );
  
  if (!response.ok) {
    throw new Error('Failed to search users');
  }
  
  return await response.json();
};

/**
 * Send friend request by nickname
 */
export const sendFriendRequest = async (nickname) => {
  const response = await fetch(`${API_URL}/api/friends/request`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to send friend request');
  }
  
  invalidateCache();
  return data;
};

/**
 * Get pending friend requests (incoming and outgoing)
 */
export const getPendingRequests = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && pendingCache && (now - cacheTimestamp) < CACHE_TTL) {
    return pendingCache;
  }
  
  const response = await fetch(`${API_URL}/api/friends/requests/pending`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch pending requests');
  }
  
  const data = await response.json();
  pendingCache = data;
  cacheTimestamp = now;
  return data;
};

/**
 * Get pending request count (for badge)
 */
export const getPendingCount = async () => {
  const response = await fetch(`${API_URL}/api/friends/requests/count`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch pending count');
  }
  
  return await response.json();
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (requestId) => {
  const response = await fetch(`${API_URL}/api/friends/request/${requestId}/accept`, {
    method: 'POST',
    credentials: 'include'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to accept request');
  }
  
  invalidateCache();
  return data;
};

/**
 * Decline friend request
 */
export const declineFriendRequest = async (requestId) => {
  const response = await fetch(`${API_URL}/api/friends/request/${requestId}/decline`, {
    method: 'POST',
    credentials: 'include'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to decline request');
  }
  
  invalidateCache();
  return data;
};

/**
 * Cancel sent friend request
 */
export const cancelFriendRequest = async (requestId) => {
  const response = await fetch(`${API_URL}/api/friends/request/${requestId}/cancel`, {
    method: 'POST',
    credentials: 'include'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to cancel request');
  }
  
  invalidateCache();
  return data;
};

/**
 * Get friends list
 */
export const getFriendsList = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && friendsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return friendsCache;
  }
  
  const response = await fetch(`${API_URL}/api/friends/list`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch friends list');
  }
  
  const data = await response.json();
  friendsCache = data;
  cacheTimestamp = now;
  return data;
};

/**
 * Remove friend
 */
export const removeFriend = async (friendUserId) => {
  const response = await fetch(`${API_URL}/api/friends/${friendUserId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to remove friend');
  }
  
  invalidateCache();
  return data;
};

// ==================== WebSocket Connection ====================

let wsConnection = null;
let wsReconnectTimeout = null;
const WS_RECONNECT_DELAY = 5000;

/**
 * Connect to friend notifications WebSocket
 */
export const connectFriendWS = (userId, onMessage) => {
  if (!userId) return null;
  
  // Close existing connection
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  
  // Clear any pending reconnect
  if (wsReconnectTimeout) {
    clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = null;
  }
  
  const wsUrl = API_URL.replace(/^http/, 'ws') + `/api/ws/friends/${userId}`;
  
  try {
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
      console.log('[FriendWS] Connected');
    };
    
    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'pong') {
          console.log('[FriendWS] Received:', data.type);
          onMessage(data);
        }
      } catch (e) {
        console.error('[FriendWS] Parse error:', e);
      }
    };
    
    wsConnection.onclose = (event) => {
      console.log('[FriendWS] Closed:', event.code, event.reason);
      wsConnection = null;
      
      // Reconnect after delay (unless intentionally closed)
      if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
        wsReconnectTimeout = setTimeout(() => {
          console.log('[FriendWS] Reconnecting...');
          connectFriendWS(userId, onMessage);
        }, WS_RECONNECT_DELAY);
      }
    };
    
    wsConnection.onerror = (error) => {
      console.error('[FriendWS] Error:', error);
    };
    
    // Send ping every 30 seconds to keep alive
    const pingInterval = setInterval(() => {
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send('ping');
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    return wsConnection;
  } catch (error) {
    console.error('[FriendWS] Connection error:', error);
    return null;
  }
};

/**
 * Disconnect friend WebSocket
 */
export const disconnectFriendWS = () => {
  if (wsReconnectTimeout) {
    clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = null;
  }
  
  if (wsConnection) {
    wsConnection.close(1000, 'User disconnected');
    wsConnection = null;
  }
};

// Export cache invalidation for external use
export { invalidateCache as invalidateFriendsCache };
