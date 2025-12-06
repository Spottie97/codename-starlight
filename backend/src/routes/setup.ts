/**
 * Setup Routes
 * Handles first-time system setup
 * These routes do NOT require authentication
 */

import { Router, Request, Response } from 'express';
import { isSetupComplete, initializeSystem } from '../services/settingsService';

export const setupRouter = Router();

/**
 * GET /api/setup/status
 * Check if system setup has been completed
 * No authentication required
 */
setupRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const setupComplete = await isSetupComplete();
    
    res.json({
      success: true,
      data: {
        isSetupComplete: setupComplete,
      }
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check setup status',
    });
  }
});

/**
 * POST /api/setup/initialize
 * Initialize the system with admin password
 * Only works if setup hasn't been completed
 * No authentication required (first-time setup)
 * 
 * Body: { password: string }
 */
setupRouter.post('/initialize', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }
    
    const result = await initializeSystem(password);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json({
      success: true,
      message: 'System initialized successfully',
    });
  } catch (error) {
    console.error('Error initializing system:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize system',
    });
  }
});

