import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage, WSMessageType } from '../types/network';

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: WSMessage) => void;
  reconnect: () => void;
}

// Determine WebSocket URL once at module load
const WS_URL = (() => {
  if (typeof window === 'undefined') return 'ws://localhost:4000/ws';
  return window.location.port === '8080' 
    ? 'ws://localhost:4000/ws'  // Development: connect directly to backend
    : `ws://${window.location.host}/ws`;  // Production: same host
})();

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;

  // Store callbacks in refs to avoid dependency issues
  const onMessageRef = useRef(options.onMessage);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  
  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = options.onMessage;
    onConnectRef.current = options.onConnect;
    onDisconnectRef.current = options.onDisconnect;
  }, [options.onMessage, options.onConnect, options.onDisconnect]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  // Connect on mount only
  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (!isMounted || isConnectingRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      isConnectingRef.current = true;

      try {
        console.log('🔌 Connecting to WebSocket:', WS_URL);
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws.close();
            return;
          }
          console.log('✅ WebSocket connected');
          setIsConnected(true);
          reconnectAttempts.current = 0;
          isConnectingRef.current = false;
          onConnectRef.current?.();
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const message: WSMessage = JSON.parse(event.data);
            onMessageRef.current?.(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          console.log('📴 WebSocket disconnected');
          setIsConnected(false);
          isConnectingRef.current = false;
          onDisconnectRef.current?.();

          // Attempt to reconnect
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            console.log(
              `Reconnecting in ${reconnectInterval}ms... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
            );
            reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          isConnectingRef.current = false;
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        isConnectingRef.current = false;
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [reconnectInterval, maxReconnectAttempts]); // Only these stable values

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reconnectAttempts.current = 0;
    isConnectingRef.current = false;
    // Trigger reconnect by closing the socket (onclose will handle reconnect)
  }, []);

  return { isConnected, send, reconnect };
}

// Hook for subscribing to specific message types
export function useWSMessageHandler(
  messageTypes: WSMessageType[],
  handler: (message: WSMessage) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  return useCallback((message: WSMessage) => {
    if (messageTypes.includes(message.type)) {
      handlerRef.current(message);
    }
  }, [messageTypes]);
}




