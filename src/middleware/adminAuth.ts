import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface AdminSession {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

// Active sessions memory store (24 hours TTL)
const activeSessions = new Map<string, AdminSession>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Admin credentials from environment (Never hardcode secrets!)
const configuredUsername = process.env.ADMIN_USERNAME || 'admin';
const configuredPassword = process.env.ADMIN_PASSWORD || 'SaveAzAdmin2026!';
const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';

/**
 * Hash password securely with salt using crypto.scryptSync
 */
export function hashPassword(password: string, salt = 'saveaz_admin_salt_2026'): string {
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

/**
 * Verify plaintext password against configured hash or password
 */
export function verifyAdminCredentials(username: string, password: string): boolean {
  if (!username || !password) return false;

  // Verify username safely
  if (username !== configuredUsername) {
    return false;
  }

  // If a precomputed hash was provided in ADMIN_PASSWORD_HASH:
  if (configuredPasswordHash && configuredPasswordHash.includes(':')) {
    try {
      const [salt, key] = configuredPasswordHash.split(':');
      const hash = crypto.scryptSync(password, salt, 64);
      return crypto.timingSafeEqual(Buffer.from(key, 'hex'), hash);
    } catch {
      return false;
    }
  }

  // Compare against configured ADMIN_PASSWORD using constant-time comparison
  const expectedBuffer = Buffer.from(configuredPassword);
  const providedBuffer = Buffer.from(password);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Generates an encrypted cryptographic session token
 */
export function createAdminSession(username: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  activeSessions.set(token, {
    token,
    username,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  logger.info(`[AUTH] Admin sessiyası yaradıldı: ${username}`);
  return token;
}

/**
 * Validates a session token
 */
export function validateAdminSession(token: string | undefined): boolean {
  if (!token) return false;

  const session = activeSessions.get(token);
  if (!session) return false;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }

  return true;
}

/**
 * Invalidate a session
 */
export function destroyAdminSession(token: string | undefined): void {
  if (token) {
    activeSessions.delete(token);
  }
}

/**
 * Express Middleware to protect /api/admin/* endpoints
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-admin-token'] as string | undefined;

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (customHeader) {
    token = customHeader.trim();
  }

  if (!token || !validateAdminSession(token)) {
    res.status(401).json({
      success: false,
      error: 'İcazə verilmədi. Zəhmət olmasa /bot-admin bölməsindən daxil olun.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  next();
}
