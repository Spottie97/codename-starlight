/**
 * Webhook Service for n8n Integration
 * Pushes network events to n8n webhook triggers for notifications (e.g., WhatsApp alerts)
 * Configuration is read from database via settingsService
 */

import crypto from 'crypto';
import { getWebhookConfig } from './settingsService';

// Event types that can be pushed to n8n
export type WebhookEventType = 
  | 'ISP_CHANGED'
  | 'NODE_DOWN'
  | 'NODE_UP'
  | 'INTERNET_DOWN'
  | 'INTERNET_UP'
  | 'GROUP_DEGRADED'
  | 'TEST';

// Base event payload
export interface WebhookEvent {
  event_type: WebhookEventType;
  timestamp: string;
  data: IspChangedData | NodeStatusData | InternetStatusData | GroupDegradedData | Record<string, unknown>;
}

// ISP Changed event data
export interface IspChangedData {
  old_isp?: string;
  new_isp: string;
  public_ip: string;
  matched_node_id?: string;
  matched_node_name?: string;
}

// Node status change event data
export interface NodeStatusData {
  node_id: string;
  node_name: string;
  node_type: string;
  group_name?: string;
  ip_address?: string;
  previous_status?: string;
  new_status: string;
  downtime_seconds?: number;
  latency?: number;
}

// Internet status change event data
export interface InternetStatusData {
  isp_name?: string;
  node_id?: string;
  node_name?: string;
  previous_status?: string;
  new_status: string;
  downtime_seconds?: number;
  latency?: number;
}

// Group degraded event data
export interface GroupDegradedData {
  group_id: string;
  group_name: string;
  total_nodes: number;
  offline_nodes: number;
  affected_node_names: string[];
}

// Configuration cache
let configCache: { url: string | null; secret: string | null } | null = null;
let configCacheTimestamp = 0;
const CONFIG_CACHE_TTL_MS = 10000; // 10 second cache for webhook config

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const DEBOUNCE_MS = 2000; // Debounce rapid events

// Event queue for batching
interface QueuedEvent {
  event: WebhookEvent;
  retries: number;
}

let eventQueue: QueuedEvent[] = [];
let debounceTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

// Track recent events to prevent duplicates
const recentEvents = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 10000; // 10 seconds

/**
 * Get cached webhook configuration
 */
async function getCachedWebhookConfig(): Promise<{ url: string | null; secret: string | null }> {
  const now = Date.now();
  
  if (configCache && (now - configCacheTimestamp) < CONFIG_CACHE_TTL_MS) {
    return configCache;
  }
  
  try {
    configCache = await getWebhookConfig();
    configCacheTimestamp = now;
    return configCache;
  } catch (error) {
    // If DB query fails, return empty config
    console.error('Failed to fetch webhook config:', error);
    return { url: null, secret: null };
  }
}

/**
 * Clear the webhook config cache
 */
export function clearWebhookConfigCache(): void {
  configCache = null;
  configCacheTimestamp = 0;
}

/**
 * Generate HMAC signature for webhook payload
 */
async function generateSignature(payload: string): Promise<string> {
  const config = await getCachedWebhookConfig();
  if (!config.secret) return '';
  return crypto.createHmac('sha256', config.secret).update(payload).digest('hex');
}

/**
 * Generate a unique key for deduplication
 */
function getEventKey(event: WebhookEvent): string {
  const data = event.data as Record<string, unknown>;
  const nodeId = data.node_id || data.matched_node_id || '';
  return `${event.event_type}:${nodeId}:${data.new_status || ''}`;
}

/**
 * Check if event is a duplicate within the time window
 */
function isDuplicateEvent(event: WebhookEvent): boolean {
  const key = getEventKey(event);
  const lastSent = recentEvents.get(key);
  const now = Date.now();
  
  if (lastSent && now - lastSent < DUPLICATE_WINDOW_MS) {
    return true;
  }
  
  // Clean up old entries
  for (const [k, timestamp] of recentEvents.entries()) {
    if (now - timestamp > DUPLICATE_WINDOW_MS) {
      recentEvents.delete(k);
    }
  }
  
  recentEvents.set(key, now);
  return false;
}

/**
 * Send webhook request to n8n
 */
async function sendWebhook(event: WebhookEvent): Promise<boolean> {
  const config = await getCachedWebhookConfig();
  
  if (!config.url) {
    console.log('⚠️  Webhook URL not configured, skipping event:', event.event_type);
    return false;
  }

  const payload = JSON.stringify(event);
  const signature = await generateSignature(payload);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Event-Type': event.event_type,
      },
      body: payload,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`❌ Webhook request failed: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`✅ Webhook sent: ${event.event_type}`);
    return true;
  } catch (error) {
    console.error('❌ Webhook request error:', error);
    return false;
  }
}

/**
 * Process the event queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing || eventQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (eventQueue.length > 0) {
    const item = eventQueue.shift();
    if (!item) continue;

    const success = await sendWebhook(item.event);

    if (!success && item.retries < MAX_RETRIES) {
      // Re-queue with incremented retry count
      item.retries++;
      eventQueue.push(item);
      
      // Exponential backoff
      const delay = RETRY_DELAY_MS * Math.pow(2, item.retries - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  isProcessing = false;
}

/**
 * Queue an event to be sent to n8n
 */
export function queueWebhookEvent(event: WebhookEvent): void {
  // Check for duplicates
  if (isDuplicateEvent(event)) {
    console.log(`⏭️  Skipping duplicate webhook event: ${event.event_type}`);
    return;
  }

  eventQueue.push({ event, retries: 0 });

  // Debounce processing to batch rapid events
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    processQueue();
  }, DEBOUNCE_MS);
}

/**
 * Send an event immediately (bypasses queue and debounce)
 */
export async function sendImmediateWebhook(event: WebhookEvent): Promise<boolean> {
  return sendWebhook(event);
}

// ============================================
// Event Helper Functions
// ============================================

/**
 * Trigger ISP_CHANGED event
 */
export function triggerIspChanged(data: IspChangedData): void {
  queueWebhookEvent({
    event_type: 'ISP_CHANGED',
    timestamp: new Date().toISOString(),
    data,
  });
}

/**
 * Trigger NODE_DOWN event
 */
export function triggerNodeDown(data: NodeStatusData): void {
  queueWebhookEvent({
    event_type: 'NODE_DOWN',
    timestamp: new Date().toISOString(),
    data: { ...data, new_status: 'OFFLINE' },
  });
}

/**
 * Trigger NODE_UP event
 */
export function triggerNodeUp(data: NodeStatusData): void {
  queueWebhookEvent({
    event_type: 'NODE_UP',
    timestamp: new Date().toISOString(),
    data: { ...data, new_status: 'ONLINE' },
  });
}

/**
 * Trigger INTERNET_DOWN event
 */
export function triggerInternetDown(data: InternetStatusData): void {
  queueWebhookEvent({
    event_type: 'INTERNET_DOWN',
    timestamp: new Date().toISOString(),
    data: { ...data, new_status: 'OFFLINE' },
  });
}

/**
 * Trigger INTERNET_UP event
 */
export function triggerInternetUp(data: InternetStatusData): void {
  queueWebhookEvent({
    event_type: 'INTERNET_UP',
    timestamp: new Date().toISOString(),
    data: { ...data, new_status: 'ONLINE' },
  });
}

/**
 * Trigger GROUP_DEGRADED event
 */
export function triggerGroupDegraded(data: GroupDegradedData): void {
  queueWebhookEvent({
    event_type: 'GROUP_DEGRADED',
    timestamp: new Date().toISOString(),
    data,
  });
}

/**
 * Send a test webhook event
 */
export async function sendTestWebhook(): Promise<{ success: boolean; message: string }> {
  const config = await getCachedWebhookConfig();
  
  if (!config.url) {
    return { success: false, message: 'Webhook URL not configured' };
  }

  const testEvent: WebhookEvent = {
    event_type: 'TEST',
    timestamp: new Date().toISOString(),
    data: {
      message: 'Test webhook from Starlight Network Monitor',
      configured_url: config.url.replace(/\/[^/]+$/, '/****'), // Mask the endpoint
    },
  };

  const success = await sendImmediateWebhook(testEvent);
  return {
    success,
    message: success ? 'Test webhook sent successfully' : 'Failed to send test webhook',
  };
}

/**
 * Get webhook configuration status
 */
export async function getWebhookStatus(): Promise<{ configured: boolean; url?: string }> {
  const config = await getCachedWebhookConfig();
  return {
    configured: !!config.url,
    url: config.url ? config.url.replace(/\/[^/]+$/, '/****') : undefined,
  };
}

/**
 * Check if webhooks are enabled
 */
export async function isWebhookEnabled(): Promise<boolean> {
  const config = await getCachedWebhookConfig();
  return !!config.url;
}

