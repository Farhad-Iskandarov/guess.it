import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for WebSocket-based live match updates.
 * Connects to the backend WebSocket and receives real-time match data.
 * Calls onReconnect when the connection is re-established after a drop.
 */
export function useLiveMatches(onMatchUpdate, onReconnect) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const onMatchUpdateRef = useRef(onMatchUpdate);
  const onReconnectRef = useRef(onReconnect);
  const wasConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  // Keep callback refs up to date
  useEffect(() => {
    onMatchUpdateRef.current = onMatchUpdate;
  }, [onMatchUpdate]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const connect = useCallback(() => {
    // Build WebSocket URL from the backend URL
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    let wsUrl;
    
    if (backendUrl) {
      // Convert http(s):// to ws(s)://
      wsUrl = backendUrl.replace(/^http/, 'ws') + '/api/ws/matches';
    } else {
      // Fallback for development
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/ws/matches`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
        
        // If this is a reconnection (was previously connected), trigger refresh
        if (wasConnectedRef.current && onReconnectRef.current) {
          onReconnectRef.current();
        }
        wasConnectedRef.current = true;
        
        // Send ping every 25 seconds to keep connection alive
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return; // Ignore pong responses
          
          if (onMatchUpdateRef.current) {
            onMatchUpdateRef.current(data);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
        }
        // Exponential backoff: 2s, 4s, 8s... capped at 30s
        const delay = Math.min(2000 * Math.pow(2, reconnectAttemptRef.current), 30000);
        reconnectAttemptRef.current++;
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      const delay = Math.min(2000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current++;
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
      }
    };
  }, [connect]);

  return { isConnected };
}
