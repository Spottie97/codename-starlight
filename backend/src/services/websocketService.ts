import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { WSMessage } from '../types';

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('📡 WebSocket client connected');
    clients.add(ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'PING',
      payload: { message: 'Connected to Starlight Network Monitor' },
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('📡 WebSocket client disconnected');
      clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Heartbeat to keep connections alive
  setInterval(() => {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    });
  }, 30000);
}

/**
 * Handle incoming client messages
 */
function handleClientMessage(ws: WebSocket, message: any): void {
  switch (message.type) {
    case 'PING':
      ws.send(JSON.stringify({
        type: 'PING',
        payload: { pong: true },
        timestamp: new Date().toISOString(),
      }));
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastMessage(message: WSMessage): void {
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Send message to a specific client
 */
export function sendToClient(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Get the number of connected clients
 */
export function getConnectedClientsCount(): number {
  return clients.size;
}




