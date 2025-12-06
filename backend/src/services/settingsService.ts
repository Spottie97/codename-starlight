/**
 * Settings Service
 * Manages system configuration stored in the database
 * Replaces environment variable-based configuration for UI management
 */

import crypto from 'crypto';
import { prisma } from '../db';

// Settings cache to avoid frequent DB queries
let settingsCache: SystemSettingsData | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5000; // 5 second cache

// Settings data interface (matches Prisma model)
export interface SystemSettingsData {
  id: string;
  isSetupComplete: boolean;
  adminPasswordHash: string | null;
  sessionSecret: string | null;
  n8nWebhookUrl: string | null;
  n8nWebhookSecret: string | null;
  probeTimeoutMs: number;
  statusHistoryRetentionDays: number;
  internetCheckTargets: string;
  // Performance settings
  monitoringIntervalMs: number;
  monitoringConcurrency: number;
  enableStatusHistory: boolean;
  statusHistoryCleanupEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Public settings (safe to expose to frontend)
export interface PublicSettings {
  isSetupComplete: boolean;
  n8nWebhookUrl: string | null;
  n8nWebhookConfigured: boolean;
  probeTimeoutMs: number;
  statusHistoryRetentionDays: number;
  internetCheckTargets: string;
  // Performance settings
  monitoringIntervalMs: number;
  monitoringConcurrency: number;
  enableStatusHistory: boolean;
  statusHistoryCleanupEnabled: boolean;
}

// Settings update payload
export interface SettingsUpdatePayload {
  n8nWebhookUrl?: string | null;
  n8nWebhookSecret?: string | null;
  probeTimeoutMs?: number;
  statusHistoryRetentionDays?: number;
  internetCheckTargets?: string;
  // Performance settings
  monitoringIntervalMs?: number;
  monitoringConcurrency?: number;
  enableStatusHistory?: boolean;
  statusHistoryCleanupEnabled?: boolean;
}

/**
 * Generate a secure random string
 */
function generateSecureSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a password using bcrypt-like PBKDF2
 * Using PBKDF2 instead of bcrypt for native Node.js support
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  
  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
  } catch {
    return false;
  }
}

/**
 * Clear the settings cache
 */
export function clearSettingsCache(): void {
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Get or create the system settings record
 * This ensures there's always a settings record in the database
 */
export async function getOrCreateSettings(): Promise<SystemSettingsData> {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return settingsCache;
  }
  
  // Try to get existing settings
  let settings = await prisma.systemSettings.findUnique({
    where: { id: 'system' }
  });
  
  // Create default settings if they don't exist
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        id: 'system',
        isSetupComplete: false,
        sessionSecret: generateSecureSecret(),
      }
    });
    console.log('🔧 Created default system settings');
  }
  
  // Ensure session secret exists (for existing records without it)
  if (!settings.sessionSecret) {
    settings = await prisma.systemSettings.update({
      where: { id: 'system' },
      data: { sessionSecret: generateSecureSecret() }
    });
    console.log('🔑 Generated session secret');
  }
  
  // Update cache
  settingsCache = settings;
  cacheTimestamp = now;
  
  return settings;
}

/**
 * Check if initial setup has been completed
 * Setup is only complete if BOTH the flag is set AND a password hash exists
 */
export async function isSetupComplete(): Promise<boolean> {
  const settings = await getOrCreateSettings();
  // Must have both the flag AND an actual password configured
  return settings.isSetupComplete && !!settings.adminPasswordHash;
}

/**
 * Initialize the system with admin password (first-time setup)
 * Only works if setup hasn't been completed yet
 */
export async function initializeSystem(password: string): Promise<{ success: boolean; error?: string }> {
  const settings = await getOrCreateSettings();
  
  if (settings.isSetupComplete) {
    return { success: false, error: 'System is already configured' };
  }
  
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  
  const passwordHash = hashPassword(password);
  
  await prisma.systemSettings.update({
    where: { id: 'system' },
    data: {
      adminPasswordHash: passwordHash,
      isSetupComplete: true,
    }
  });
  
  clearSettingsCache();
  console.log('✅ System initialized successfully');
  
  return { success: true };
}

/**
 * Get public settings (safe for frontend)
 * Includes fallback defaults for fields that may not exist in older database schemas
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  const settings = await getOrCreateSettings();
  
  return {
    isSetupComplete: settings.isSetupComplete,
    n8nWebhookUrl: settings.n8nWebhookUrl,
    n8nWebhookConfigured: !!settings.n8nWebhookUrl,
    probeTimeoutMs: settings.probeTimeoutMs ?? 5000,
    statusHistoryRetentionDays: settings.statusHistoryRetentionDays ?? 30,
    internetCheckTargets: settings.internetCheckTargets ?? '8.8.8.8,1.1.1.1,208.67.222.222',
    // Performance settings (with fallback defaults for older schemas)
    monitoringIntervalMs: (settings as any).monitoringIntervalMs ?? 60000,
    monitoringConcurrency: (settings as any).monitoringConcurrency ?? 10,
    enableStatusHistory: (settings as any).enableStatusHistory ?? true,
    statusHistoryCleanupEnabled: (settings as any).statusHistoryCleanupEnabled ?? true,
  };
}

/**
 * Update settings
 */
export async function updateSettings(payload: SettingsUpdatePayload): Promise<PublicSettings> {
  // Validate inputs
  if (payload.probeTimeoutMs !== undefined && payload.probeTimeoutMs < 1000) {
    throw new Error('Probe timeout must be at least 1000ms');
  }
  
  if (payload.statusHistoryRetentionDays !== undefined && payload.statusHistoryRetentionDays < 1) {
    throw new Error('Status history retention must be at least 1 day');
  }
  
  if (payload.n8nWebhookUrl !== undefined && payload.n8nWebhookUrl) {
    try {
      new URL(payload.n8nWebhookUrl);
    } catch {
      throw new Error('Invalid webhook URL');
    }
  }
  
  // Validate performance settings
  if (payload.monitoringIntervalMs !== undefined && payload.monitoringIntervalMs < 10000) {
    throw new Error('Monitoring interval must be at least 10 seconds (10000ms)');
  }
  
  if (payload.monitoringConcurrency !== undefined && (payload.monitoringConcurrency < 1 || payload.monitoringConcurrency > 50)) {
    throw new Error('Monitoring concurrency must be between 1 and 50');
  }
  
  await prisma.systemSettings.update({
    where: { id: 'system' },
    data: {
      ...(payload.n8nWebhookUrl !== undefined && { n8nWebhookUrl: payload.n8nWebhookUrl || null }),
      ...(payload.n8nWebhookSecret !== undefined && { n8nWebhookSecret: payload.n8nWebhookSecret || null }),
      ...(payload.probeTimeoutMs !== undefined && { probeTimeoutMs: payload.probeTimeoutMs }),
      ...(payload.statusHistoryRetentionDays !== undefined && { statusHistoryRetentionDays: payload.statusHistoryRetentionDays }),
      ...(payload.internetCheckTargets !== undefined && { internetCheckTargets: payload.internetCheckTargets }),
      // Performance settings
      ...(payload.monitoringIntervalMs !== undefined && { monitoringIntervalMs: payload.monitoringIntervalMs }),
      ...(payload.monitoringConcurrency !== undefined && { monitoringConcurrency: payload.monitoringConcurrency }),
      ...(payload.enableStatusHistory !== undefined && { enableStatusHistory: payload.enableStatusHistory }),
      ...(payload.statusHistoryCleanupEnabled !== undefined && { statusHistoryCleanupEnabled: payload.statusHistoryCleanupEnabled }),
    }
  });
  
  clearSettingsCache();
  console.log('⚙️ Settings updated');
  
  return getPublicSettings();
}

/**
 * Change admin password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const settings = await getOrCreateSettings();
  
  if (!settings.isSetupComplete || !settings.adminPasswordHash) {
    return { success: false, error: 'System is not configured' };
  }
  
  // Verify current password
  if (!verifyPassword(currentPassword, settings.adminPasswordHash)) {
    return { success: false, error: 'Current password is incorrect' };
  }
  
  // Validate new password
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters' };
  }
  
  const newPasswordHash = hashPassword(newPassword);
  
  // Also regenerate session secret to invalidate existing sessions
  await prisma.systemSettings.update({
    where: { id: 'system' },
    data: {
      adminPasswordHash: newPasswordHash,
      sessionSecret: generateSecureSecret(),
    }
  });
  
  clearSettingsCache();
  console.log('🔐 Admin password changed');
  
  return { success: true };
}

/**
 * Get auth configuration for middleware
 * Used internally by auth system
 */
export async function getAuthConfig(): Promise<{ passwordHash: string | null; sessionSecret: string }> {
  const settings = await getOrCreateSettings();
  
  return {
    passwordHash: settings.adminPasswordHash,
    sessionSecret: settings.sessionSecret || generateSecureSecret(),
  };
}

/**
 * Get webhook configuration
 * Used by webhook service
 */
export async function getWebhookConfig(): Promise<{ url: string | null; secret: string | null }> {
  const settings = await getOrCreateSettings();
  
  return {
    url: settings.n8nWebhookUrl,
    secret: settings.n8nWebhookSecret,
  };
}

/**
 * Get monitoring configuration
 * Used by monitoring service
 */
export async function getMonitoringConfig(): Promise<{
  probeTimeoutMs: number;
  statusHistoryRetentionDays: number;
  internetCheckTargets: string[];
}> {
  const settings = await getOrCreateSettings();
  
  const targets = settings.internetCheckTargets ?? '8.8.8.8,1.1.1.1,208.67.222.222';
  
  return {
    probeTimeoutMs: settings.probeTimeoutMs ?? 5000,
    statusHistoryRetentionDays: settings.statusHistoryRetentionDays ?? 30,
    internetCheckTargets: targets.split(',').map(ip => ip.trim()).filter(Boolean),
  };
}

/**
 * Get performance configuration
 * Used by monitoring service for interval and concurrency settings
 * Includes fallback defaults for fields that may not exist in older database schemas
 */
export async function getPerformanceConfig(): Promise<{
  monitoringIntervalMs: number;
  monitoringConcurrency: number;
  enableStatusHistory: boolean;
  statusHistoryCleanupEnabled: boolean;
  statusHistoryRetentionDays: number;
}> {
  const settings = await getOrCreateSettings();
  
  return {
    monitoringIntervalMs: (settings as any).monitoringIntervalMs ?? 60000,
    monitoringConcurrency: (settings as any).monitoringConcurrency ?? 10,
    enableStatusHistory: (settings as any).enableStatusHistory ?? true,
    statusHistoryCleanupEnabled: (settings as any).statusHistoryCleanupEnabled ?? true,
    statusHistoryRetentionDays: settings.statusHistoryRetentionDays ?? 30,
  };
}

/**
 * Cleanup old status history records
 * Deletes records older than the retention period
 * @returns Number of records deleted
 */
export async function cleanupStatusHistory(): Promise<number> {
  const settings = await getOrCreateSettings();
  
  if (!settings.statusHistoryCleanupEnabled) {
    console.log('📊 Status history cleanup is disabled');
    return 0;
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - settings.statusHistoryRetentionDays);
  
  const result = await prisma.probeStatus.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });
  
  if (result.count > 0) {
    console.log(`🗑️ Cleaned up ${result.count} old status history records`);
  }
  
  return result.count;
}

/**
 * Force cleanup status history (ignores enabled/disabled setting)
 * Used for manual cleanup triggered by user
 * @returns Number of records deleted
 */
export async function forceCleanupStatusHistory(): Promise<number> {
  const settings = await getOrCreateSettings();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - settings.statusHistoryRetentionDays);
  
  const result = await prisma.probeStatus.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  });
  
  console.log(`🗑️ Force cleaned up ${result.count} old status history records`);
  
  return result.count;
}

/**
 * Get status history statistics
 * Returns count and date range of stored history
 */
export async function getStatusHistoryStats(): Promise<{
  totalRecords: number;
  oldestRecord: Date | null;
  newestRecord: Date | null;
}> {
  const [count, oldest, newest] = await Promise.all([
    prisma.probeStatus.count(),
    prisma.probeStatus.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    }),
    prisma.probeStatus.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
  ]);
  
  return {
    totalRecords: count,
    oldestRecord: oldest?.timestamp || null,
    newestRecord: newest?.timestamp || null,
  };
}

