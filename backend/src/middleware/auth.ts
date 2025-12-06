import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Generate a token from password and secret
 * Uses HMAC-SHA256 for secure token generation
 */
export function generateToken(password: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(password)
    .digest('hex');
}

/**
 * Verify a token against the expected password
 */
export function verifyToken(token: string, password: string, secret: string): boolean {
  const expectedToken = generateToken(password, secret);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken)
    );
  } catch {
    return false;
  }
}

/**
 * Get auth configuration from environment
 */
function getAuthConfig() {
  const password = process.env.AUTH_ADMIN_PASSWORD;
  const secret = process.env.AUTH_SESSION_SECRET;
  
  if (!password || password === 'changeme') {
    console.warn('⚠️  WARNING: AUTH_ADMIN_PASSWORD is not set or using default value!');
  }
  
  if (!secret || secret === 'change-this-to-a-random-string-in-production') {
    console.warn('⚠️  WARNING: AUTH_SESSION_SECRET is not set or using default value!');
  }
  
  return {
    password: password || 'changeme',
    secret: secret || 'default-secret-change-in-production'
  };
}

/**
 * Express middleware to authenticate requests
 * Checks for Bearer token in Authorization header
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }
  
  // Skip auth for auth routes
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  
  // Get authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const { password, secret } = getAuthConfig();
  
  if (!verifyToken(token, password, secret)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
  
  // Token is valid, proceed
  next();
}

/**
 * Login handler - validates password and returns token
 */
export function handleLogin(req: Request, res: Response) {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Password is required'
    });
  }
  
  const config = getAuthConfig();
  
  if (password !== config.password) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid password'
    });
  }
  
  // Generate token
  const token = generateToken(password, config.secret);
  
  res.json({
    success: true,
    token
  });
}

/**
 * Verify handler - checks if token is valid
 */
export function handleVerify(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      valid: false,
      message: 'Missing or invalid authorization header'
    });
  }
  
  const token = authHeader.substring(7);
  const { password, secret } = getAuthConfig();
  
  if (!verifyToken(token, password, secret)) {
    return res.status(401).json({
      valid: false,
      message: 'Invalid token'
    });
  }
  
  res.json({
    valid: true
  });
}
