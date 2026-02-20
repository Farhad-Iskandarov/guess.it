/**
 * Messages Context
 * Global state for real-time messaging, notifications, unread counts,
 * delivery/read status tracking
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
  const chatListenersRef = useRef([]);
  const notifListenersRef = useRef([]);
  const mountedRef = useRef(true);
  const soundEnabledRef = useRef(true);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

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

  const addChatListener = useCallback((fn) => {
    chatListenersRef.current.push(fn);
    return () => {
      chatListenersRef.current = chatListenersRef.current.filter(f => f !== fn);
    };
  }, []);

  const addNotifListener = useCallback((fn) => {
    notifListenersRef.current.push(fn);
    return () => {
      notifListenersRef.current = notifListenersRef.current.filter(f => f !== fn);
    };
  }, []);

  const handleChatMessage = useCallback((data) => {
    if (data.type === 'new_message') {
      if (soundEnabledRef.current) playSoundForEvent('new_message');
      setUnreadMessages(prev => prev + 1);
      setConversations(prev => {
        const idx = prev.findIndex(c => c.user_id === data.message.sender_id);
        if (idx >= 0) {
          const updated = [...prev];
          const msgText = data.message.message_type === 'match_share' ? 'Shared a match' : data.message.message?.substring(0, 80);
          updated[idx] = {
            ...updated[idx],
            unread_count: (updated[idx].unread_count || 0) + 1,
            last_message: {
              message: msgText,
              created_at: data.message.created_at,
              is_mine: false,
              message_type: data.message.message_type || 'text'
            }
          };
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
          return updated;
        }
        return prev;
      });
    }
    // Forward all events (new_message, message_delivered, messages_read, messages_delivered) to listeners
    chatListenersRef.current.forEach(fn => fn(data));
  }, []);

  const handleNotifMessage = useCallback((data) => {
    if (data.type === 'notification') {
      setUnreadNotifications(prev => prev + 1);
      if (soundEnabledRef.current && data.notification?.type) {
        playSoundForEvent(data.notification.type);
      }
    }
    notifListenersRef.current.forEach(fn => fn(data));
  }, []);

  const markConversationRead = useCallback((friendId, count) => {
    setUnreadMessages(prev => Math.max(0, prev - (count || 0)));
    setConversations(prev =>
      prev.map(c =>
        c.user_id === friendId ? { ...c, unread_count: 0 } : c
      )
    );
  }, []);

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
