import { Router } from 'express';
import { handleLogin, handleVerify } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate with admin password
 * Body: { password: string }
 * Returns: { success: true, token: string } or error
 */
router.post('/login', handleLogin);

/**
 * GET /api/auth/verify
 * Verify if current token is valid
 * Headers: Authorization: Bearer <token>
 * Returns: { valid: true } or error
 */
router.get('/verify', handleVerify);

export const authRouter = router;
