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
  SettingsUpdatePayload 
} from '../services/settingsService';

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
    };
    
    // Remove undefined values
    Object.keys(payload).forEach(key => {
      if (payload[key as keyof SettingsUpdatePayload] === undefined) {
        delete payload[key as keyof SettingsUpdatePayload];
      }
    });
    
    const settings = await updateSettings(payload);
    
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

