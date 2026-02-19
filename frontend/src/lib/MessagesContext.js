/**
 * Messages Context
 * Global state for real-time messaging, notifications, and unread counts
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { playSoundForEvent } from './notificationSounds';
import {
  getConversations,
  getUnreadCount,
  getNotificationUnreadCount,
  connectChatWS,
  disconnectChatWS,
  connectNotifWS,
  disconnectNotifWS
} from '@/services/messages';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const MessagesContext = createContext(null);

export const MessagesProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Listeners that other components can register to receive real-time chat messages
  const chatListenersRef = useRef([]);
  const notifListenersRef = useRef([]);
  const mountedRef = useRef(true);
  const soundEnabledRef = useRef(true);

  // Keep ref in sync for callbacks
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // Fetch sound preference
  const fetchSoundPreference = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const resp = await fetch(`${API_URL}/api/settings/notification-sound`, { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        setSoundEnabled(data.data?.notification_sound ?? true);
      }
    } catch {}
  }, [isAuthenticated]);

  // Fetch unread counts on mount
  const fetchUnreadCounts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [msgData, notifData] = await Promise.all([
        getUnreadCount(),
        getNotificationUnreadCount()
      ]);
      if (mountedRef.current) {
        setUnreadMessages(msgData.count || 0);
        setUnreadNotifications(notifData.count || 0);
      }
    } catch (e) {
      console.error('Failed to fetch unread counts:', e);
    }
  }, [isAuthenticated]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getConversations();
      if (mountedRef.current) {
        setConversations(data.conversations || []);
        setUnreadMessages(data.total_unread || 0);
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
  }, [isAuthenticated]);

  // Register a chat message listener
  const addChatListener = useCallback((fn) => {
    chatListenersRef.current.push(fn);
    return () => {
      chatListenersRef.current = chatListenersRef.current.filter(f => f !== fn);
    };
  }, []);

  // Register a notification listener
  const addNotifListener = useCallback((fn) => {
    notifListenersRef.current.push(fn);
    return () => {
      notifListenersRef.current = notifListenersRef.current.filter(f => f !== fn);
    };
  }, []);

  // Handle incoming chat WS messages
  const handleChatMessage = useCallback((data) => {
    if (data.type === 'new_message') {
      // Play sound
      if (soundEnabledRef.current) playSoundForEvent('new_message');
      // Increment unread
      setUnreadMessages(prev => prev + 1);
      // Update conversation list
      setConversations(prev => {
        const idx = prev.findIndex(c => c.user_id === data.message.sender_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            unread_count: (updated[idx].unread_count || 0) + 1,
            last_message: {
              message: data.message.message.substring(0, 80),
              created_at: data.message.created_at,
              is_mine: false
            }
          };
          // Move to top
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
          return updated;
        }
        return prev;
      });
    }
    // Notify all listeners
    chatListenersRef.current.forEach(fn => fn(data));
  }, []);

  // Handle incoming notification WS messages
  const handleNotifMessage = useCallback((data) => {
    if (data.type === 'notification') {
      setUnreadNotifications(prev => prev + 1);
      // Play sound based on notification type
      if (soundEnabledRef.current && data.notification?.type) {
        playSoundForEvent(data.notification.type);
      }
    } else if (data.type === 'new_message_notification') {
      // Sound already handled by chat WS
    }
    notifListenersRef.current.forEach(fn => fn(data));
  }, []);

  // Mark conversation as read (called by chat page)
  const markConversationRead = useCallback((friendId, count) => {
    setUnreadMessages(prev => Math.max(0, prev - (count || 0)));
    setConversations(prev =>
      prev.map(c =>
        c.user_id === friendId ? { ...c, unread_count: 0 } : c
      )
    );
  }, []);

  // Connect WebSockets
  useEffect(() => {
    mountedRef.current = true;

    if (isAuthenticated && user?.user_id) {
      connectChatWS(user.user_id, handleChatMessage);
      connectNotifWS(user.user_id, handleNotifMessage);
      fetchUnreadCounts();
      fetchConversations();
      fetchSoundPreference();
    } else {
      disconnectChatWS();
      disconnectNotifWS();
      setUnreadMessages(0);
      setUnreadNotifications(0);
      setConversations([]);
    }

    return () => {
      mountedRef.current = false;
      disconnectChatWS();
      disconnectNotifWS();
    };
  }, [isAuthenticated, user?.user_id, handleChatMessage, handleNotifMessage, fetchUnreadCounts, fetchConversations, fetchSoundPreference]);

  const value = {
    unreadMessages,
    unreadNotifications,
    conversations,
    soundEnabled,
    setSoundEnabled,
    fetchConversations,
    fetchUnreadCounts,
    addChatListener,
    addNotifListener,
    markConversationRead,
    setUnreadNotifications
  };

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};
