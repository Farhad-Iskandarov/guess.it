/**
 * Friends Context
 * Global state for friend requests and real-time notifications
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  getPendingCount,
  getPendingRequests,
  getFriendsList,
  connectFriendWS,
  disconnectFriendWS,
  invalidateFriendsCache
} from '@/services/friends';

const FriendsContext = createContext(null);

export const FriendsProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState({ incoming: [], outgoing: [] });
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const wsRef = useRef(null);
  const mountedRef = useRef(true);

  // Fetch pending count
  const fetchPendingCount = useCallback(async () => {
    if (!isAuthenticated) {
      setPendingCount(0);
      return;
    }
    
    try {
      const data = await getPendingCount();
      if (mountedRef.current) {
        setPendingCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
    }
  }, [isAuthenticated]);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setPendingRequests({ incoming: [], outgoing: [] });
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await getPendingRequests(forceRefresh);
      if (mountedRef.current) {
        setPendingRequests({
          incoming: data.incoming || [],
          outgoing: data.outgoing || []
        });
        setPendingCount(data.incoming_count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Fetch friends list
  const fetchFriends = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setFriends([]);
      return;
    }
    
    try {
      const data = await getFriendsList(forceRefresh);
      if (mountedRef.current) {
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  }, [isAuthenticated]);

  // Handle WebSocket messages
  const handleWSMessage = useCallback((data) => {
    console.log('[FriendsContext] WS message:', data.type);
    
    switch (data.type) {
      case 'friend_request_received':
        // New incoming request
        setPendingRequests(prev => ({
          ...prev,
          incoming: [data.request, ...prev.incoming]
        }));
        setPendingCount(prev => prev + 1);
        break;
        
      case 'friend_request_accepted':
        // Someone accepted our request - add to friends
        if (data.friend) {
          setFriends(prev => {
            // Avoid duplicates
            if (prev.find(f => f.user_id === data.friend.user_id)) {
              return prev;
            }
            return [...prev, data.friend];
          });
        }
        // Remove from outgoing requests
        invalidateFriendsCache();
        fetchPendingRequests(true);
        break;
        
      case 'friend_added':
        // We accepted a request - add to friends
        if (data.friend) {
          setFriends(prev => {
            if (prev.find(f => f.user_id === data.friend.user_id)) {
              return prev;
            }
            return [...prev, data.friend];
          });
        }
        break;
        
      case 'friend_request_declined':
      case 'friend_request_cancelled':
        // Request was declined/cancelled - update pending
        setPendingRequests(prev => ({
          incoming: prev.incoming.filter(r => r.request_id !== data.request_id),
          outgoing: prev.outgoing.filter(r => r.request_id !== data.request_id)
        }));
        if (data.type === 'friend_request_declined' || data.type === 'friend_request_cancelled') {
          // If it was an incoming request that was declined/cancelled
          fetchPendingCount();
        }
        break;
        
      case 'friend_removed':
        // Friend was removed
        setFriends(prev => prev.filter(f => f.user_id !== data.friend_id));
        break;
        
      default:
        console.log('[FriendsContext] Unknown message type:', data.type);
    }
  }, [fetchPendingRequests, fetchPendingCount]);

  // Connect/disconnect WebSocket based on auth state
  useEffect(() => {
    mountedRef.current = true;
    
    if (isAuthenticated && user?.user_id) {
      // Connect WebSocket
      wsRef.current = connectFriendWS(user.user_id, handleWSMessage);
      
      // Initial fetch
      fetchPendingCount();
      fetchFriends();
    } else {
      // Disconnect and reset
      disconnectFriendWS();
      setPendingCount(0);
      setPendingRequests({ incoming: [], outgoing: [] });
      setFriends([]);
    }
    
    return () => {
      mountedRef.current = false;
      disconnectFriendWS();
    };
  }, [isAuthenticated, user?.user_id, handleWSMessage, fetchPendingCount, fetchFriends]);

  // Refresh all friend data
  const refresh = useCallback(async () => {
    invalidateFriendsCache();
    await Promise.all([
      fetchPendingCount(),
      fetchPendingRequests(true),
      fetchFriends(true)
    ]);
  }, [fetchPendingCount, fetchPendingRequests, fetchFriends]);

  // Add friend locally (after accepting request)
  const addFriendLocal = useCallback((friend) => {
    setFriends(prev => {
      if (prev.find(f => f.user_id === friend.user_id)) {
        return prev;
      }
      return [...prev, friend];
    });
  }, []);

  // Remove friend locally
  const removeFriendLocal = useCallback((friendUserId) => {
    setFriends(prev => prev.filter(f => f.user_id !== friendUserId));
  }, []);

  // Update pending count manually
  const decrementPendingCount = useCallback(() => {
    setPendingCount(prev => Math.max(0, prev - 1));
  }, []);

  const value = {
    pendingCount,
    pendingRequests,
    friends,
    isLoading,
    fetchPendingCount,
    fetchPendingRequests,
    fetchFriends,
    refresh,
    addFriendLocal,
    removeFriendLocal,
    decrementPendingCount
  };

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
};

export default FriendsContext;
