import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { WSMessage } from '../types';

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

// Throttling configuration
const STATUS_UPDATE_THROTTLE_MS = 500; // Minimum time between status broadcasts
const STATUS_UPDATE_BATCH_MS = 200; // Batch status updates within this window

// Throttling state
let lastStatusBroadcast = 0;
let pendingStatusUpdates: Map<string, any> = new Map(); // node id -> latest status
let statusBatchTimeout: NodeJS.Timeout | null = null;

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
 * Queue a status update for batched/throttled broadcast
 * Multiple status updates within the batch window are combined
 * @param nodeId - The node ID being updated
 * @param statusPayload - The status update payload
 */
export function queueStatusUpdate(nodeId: string, statusPayload: any): void {
  // Store the latest status for this node (overwrites previous if in same batch)
  pendingStatusUpdates.set(nodeId, statusPayload);
  
  // If no batch timeout is set, schedule one
  if (!statusBatchTimeout) {
    const timeSinceLastBroadcast = Date.now() - lastStatusBroadcast;
    const delay = Math.max(
      STATUS_UPDATE_BATCH_MS,
      STATUS_UPDATE_THROTTLE_MS - timeSinceLastBroadcast
    );
    
    statusBatchTimeout = setTimeout(flushStatusUpdates, delay);
  }
}

/**
 * Flush all pending status updates as a batch
 */
function flushStatusUpdates(): void {
  statusBatchTimeout = null;
  
  if (pendingStatusUpdates.size === 0) return;
  
  // If only one update, send normally
  if (pendingStatusUpdates.size === 1) {
    const entry = pendingStatusUpdates.entries().next().value;
    if (entry) {
      const [, payload] = entry;
      broadcastMessage({
        type: 'NODE_STATUS_UPDATE',
        payload,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    // Multiple updates - send as batch
    const updates = Array.from(pendingStatusUpdates.values());
    broadcastMessage({
      type: 'BATCH_STATUS_UPDATE',
      payload: { updates },
      timestamp: new Date().toISOString(),
    });
  }
  
  pendingStatusUpdates.clear();
  lastStatusBroadcast = Date.now();
}

/**
 * Broadcast a status update immediately (bypasses throttling)
 * Use for critical/urgent updates only
 */
export function broadcastStatusImmediate(message: WSMessage): void {
  // Flush any pending updates first
  if (statusBatchTimeout) {
    clearTimeout(statusBatchTimeout);
    flushStatusUpdates();
  }
  
  broadcastMessage(message);
  lastStatusBroadcast = Date.now();
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

/**
 * Get throttle statistics for debugging
 */
export function getThrottleStats(): { pendingUpdates: number; clientCount: number } {
  return {
    pendingUpdates: pendingStatusUpdates.size,
    clientCount: clients.size,
  };
}
