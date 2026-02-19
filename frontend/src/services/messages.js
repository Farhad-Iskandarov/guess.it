/**
 * Messages API Service
 * Real-time messaging between friends
 */

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ==================== REST API ====================

export const getConversations = async () => {
  const response = await fetch(`${API_URL}/api/messages/conversations`, {
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch conversations');
  return await response.json();
};

export const getChatHistory = async (friendId, { limit = 50, before } = {}) => {
  let url = `${API_URL}/api/messages/history/${friendId}?limit=${limit}`;
  if (before) url += `&before=${encodeURIComponent(before)}`;
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch chat history');
  return await response.json();
};

export const sendMessage = async (receiverId, message) => {
  const response = await fetch(`${API_URL}/api/messages/send`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiver_id: receiverId, message })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Failed to send message');
  return data;
};

export const markMessagesRead = async (friendId) => {
  const response = await fetch(`${API_URL}/api/messages/read/${friendId}`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to mark messages read');
  return await response.json();
};

export const getUnreadCount = async () => {
  const response = await fetch(`${API_URL}/api/messages/unread-count`, {
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch unread count');
  return await response.json();
};

// ==================== Notifications API ====================

export const getNotifications = async (limit = 30, offset = 0) => {
  const response = await fetch(
    `${API_URL}/api/notifications?limit=${limit}&offset=${offset}`,
    { credentials: 'include' }
  );
  if (!response.ok) throw new Error('Failed to fetch notifications');
  return await response.json();
};

export const getNotificationUnreadCount = async () => {
  const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to fetch notification count');
  return await response.json();
};

export const markNotificationRead = async (notificationId) => {
  const response = await fetch(`${API_URL}/api/notifications/read/${notificationId}`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to mark notification read');
  return await response.json();
};

export const markAllNotificationsRead = async () => {
  const response = await fetch(`${API_URL}/api/notifications/read-all`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Failed to mark all read');
  return await response.json();
};

// ==================== WebSocket: Chat ====================

let chatWS = null;
let chatReconnectTimer = null;
let chatPingInterval = null;

export const connectChatWS = (userId, onMessage) => {
  if (!userId) return null;
  disconnectChatWS();

  const wsUrl = API_URL.replace(/^http/, 'ws') + `/api/ws/chat/${userId}`;

  try {
    chatWS = new WebSocket(wsUrl);

    chatWS.onopen = () => {
      console.log('[ChatWS] Connected');
      // Ping every 25s to keep alive
      chatPingInterval = setInterval(() => {
        if (chatWS?.readyState === WebSocket.OPEN) {
          chatWS.send('ping');
        }
      }, 25000);
    };

    chatWS.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'pong') {
          onMessage(data);
        }
      } catch (e) {
        console.error('[ChatWS] Parse error:', e);
      }
    };

    chatWS.onclose = (event) => {
      console.log('[ChatWS] Closed:', event.code);
      if (chatPingInterval) clearInterval(chatPingInterval);
      chatWS = null;
      // Auto-reconnect unless intentionally closed
      if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
        chatReconnectTimer = setTimeout(() => {
          console.log('[ChatWS] Reconnecting...');
          connectChatWS(userId, onMessage);
        }, 3000);
      }
    };

    chatWS.onerror = () => {};

    return chatWS;
  } catch {
    return null;
  }
};

export const disconnectChatWS = () => {
  if (chatReconnectTimer) { clearTimeout(chatReconnectTimer); chatReconnectTimer = null; }
  if (chatPingInterval) { clearInterval(chatPingInterval); chatPingInterval = null; }
  if (chatWS) { chatWS.close(1000); chatWS = null; }
};

// ==================== WebSocket: Notifications ====================

let notifWS = null;
let notifReconnectTimer = null;
let notifPingInterval = null;

export const connectNotifWS = (userId, onMessage) => {
  if (!userId) return null;
  disconnectNotifWS();

  const wsUrl = API_URL.replace(/^http/, 'ws') + `/api/ws/notifications/${userId}`;

  try {
    notifWS = new WebSocket(wsUrl);

    notifWS.onopen = () => {
      console.log('[NotifWS] Connected');
      notifPingInterval = setInterval(() => {
        if (notifWS?.readyState === WebSocket.OPEN) {
          notifWS.send('ping');
        }
      }, 25000);
    };

    notifWS.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'pong') {
          onMessage(data);
        }
      } catch (e) {
        console.error('[NotifWS] Parse error:', e);
      }
    };

    notifWS.onclose = (event) => {
      console.log('[NotifWS] Closed:', event.code);
      if (notifPingInterval) clearInterval(notifPingInterval);
      notifWS = null;
      if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
        notifReconnectTimer = setTimeout(() => {
          console.log('[NotifWS] Reconnecting...');
          connectNotifWS(userId, onMessage);
        }, 3000);
      }
    };

    notifWS.onerror = () => {};

    return notifWS;
  } catch {
    return null;
  }
};

export const disconnectNotifWS = () => {
  if (notifReconnectTimer) { clearTimeout(notifReconnectTimer); notifReconnectTimer = null; }
  if (notifPingInterval) { clearInterval(notifPingInterval); notifPingInterval = null; }
  if (notifWS) { notifWS.close(1000); notifWS = null; }
};
