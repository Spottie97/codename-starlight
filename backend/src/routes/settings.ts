/**
 * Settings Routes
 * Manages system configuration through the UI
 * All routes require authentication
 */

import { Router, Request, Response } from 'express';
import { 
  getPublicSettings, 
  updateSettings, 
  changePassword,
  forceCleanupStatusHistory,
  getStatusHistoryStats,
  SettingsUpdatePayload 
} from '../services/settingsService';
import { restartMonitoringScheduler } from '../services/monitoringService';

export const settingsRouter = Router();

/**
 * GET /api/settings
 * Get current system settings (public/safe values only)
 */
settingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await getPublicSettings();
    
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
    });
  }
});

/**
 * PUT /api/settings
 * Update system settings
 * 
 * Body: {
 *   n8nWebhookUrl?: string | null,
 *   n8nWebhookSecret?: string | null,
 *   probeTimeoutMs?: number,
 *   statusHistoryRetentionDays?: number,
 *   internetCheckTargets?: string,
 *   monitoringIntervalMs?: number,
 *   monitoringConcurrency?: number,
 *   enableStatusHistory?: boolean,
 *   statusHistoryCleanupEnabled?: boolean,
 * }
 */
settingsRouter.put('/', async (req: Request, res: Response) => {
  try {
    const payload: SettingsUpdatePayload = {
      n8nWebhookUrl: req.body.n8nWebhookUrl,
      n8nWebhookSecret: req.body.n8nWebhookSecret,
      probeTimeoutMs: req.body.probeTimeoutMs,
      statusHistoryRetentionDays: req.body.statusHistoryRetentionDays,
      internetCheckTargets: req.body.internetCheckTargets,
      // Performance settings
      monitoringIntervalMs: req.body.monitoringIntervalMs,
      monitoringConcurrency: req.body.monitoringConcurrency,
      enableStatusHistory: req.body.enableStatusHistory,
      statusHistoryCleanupEnabled: req.body.statusHistoryCleanupEnabled,
    };
    
    // Remove undefined values
    Object.keys(payload).forEach(key => {
      if (payload[key as keyof SettingsUpdatePayload] === undefined) {
        delete payload[key as keyof SettingsUpdatePayload];
      }
    });
    
    // Check if monitoring interval changed - need to restart scheduler
    const intervalChanged = payload.monitoringIntervalMs !== undefined;
    
    const settings = await updateSettings(payload);
    
    // Restart monitoring scheduler if interval changed
    if (intervalChanged) {
      try {
        await restartMonitoringScheduler();
        console.log('🔄 Monitoring scheduler restarted with new interval');
      } catch (err) {
        console.error('Failed to restart monitoring scheduler:', err);
      }
    }
    
    res.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/settings/change-password
 * Change the admin password
 * 
 * Body: {
 *   currentPassword: string,
 *   newPassword: string,
 * }
 */
settingsRouter.post('/change-password', async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }
    
    const result = await changePassword(currentPassword, newPassword);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
    });
  }
});

/**
 * GET /api/settings/webhook-test-events
 * Get list of available webhook event types for testing
 */
settingsRouter.get('/webhook-test-events', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      events: [
        { type: 'TEST', description: 'Test connectivity' },
        { type: 'NODE_DOWN', description: 'Node goes offline' },
        { type: 'NODE_UP', description: 'Node comes online' },
        { type: 'INTERNET_DOWN', description: 'Internet connectivity lost' },
        { type: 'INTERNET_UP', description: 'Internet connectivity restored' },
        { type: 'ISP_CHANGED', description: 'Active ISP changed' },
        { type: 'GROUP_DEGRADED', description: 'Multiple nodes in group offline' },
      ]
    }
  });
});

/**
 * GET /api/settings/status-history-stats
 * Get statistics about stored status history
 */
settingsRouter.get('/status-history-stats', async (req: Request, res: Response) => {
  try {
    const stats = await getStatusHistoryStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting status history stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status history statistics',
    });
  }
});

/**
 * POST /api/settings/cleanup-status-history
 * Manually trigger cleanup of old status history records
 */
settingsRouter.post('/cleanup-status-history', async (req: Request, res: Response) => {
  try {
    const deletedCount = await forceCleanupStatusHistory();
    
    res.json({
      success: true,
      data: {
        deletedCount,
      },
      message: `Cleaned up ${deletedCount} old status history records`,
    });
  } catch (error) {
    console.error('Error cleaning up status history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup status history',
    });
  }
});

