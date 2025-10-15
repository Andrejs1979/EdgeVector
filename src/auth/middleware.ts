/**
 * Authentication Middleware
 *
 * Handles JWT token validation and user authentication
 */

import { verifyToken, extractUser, type User, type JWTPayload } from './jwt';
import type { Env } from '../types/env';

export interface AuthResult {
  user: User | null;
  authenticated: boolean;
  error?: string;
}

/**
 * Extract and validate JWT from Authorization header
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return {
      user: null,
      authenticated: false,
    };
  }

  // Check for Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      authenticated: false,
      error: 'Invalid authorization header format. Use: Bearer <token>',
    };
  }

  const token = authHeader.substring(7);

  if (!token) {
    return {
      user: null,
      authenticated: false,
      error: 'Missing token',
    };
  }

  // Get JWT secret from environment
  const secret = env.JWT_SECRET || 'default-secret-change-in-production';

  // Verify token
  const payload: JWTPayload | null = await verifyToken(token, secret);

  if (!payload) {
    return {
      user: null,
      authenticated: false,
      error: 'Invalid or expired token',
    };
  }

  // Extract user from payload
  const user = extractUser(payload);

  return {
    user,
    authenticated: true,
  };
}

/**
 * Require authentication for a resolver
 */
export function requireAuth(user: User | undefined): User {
  if (!user) {
    throw new Error('Authentication required. Please provide a valid token.');
  }
  return user;
}

/**
 * Check if user has required role
 * (For future implementation when roles are added)
 */
export function requireRole(user: User | undefined, requiredRole: string): User {
  const authenticatedUser = requireAuth(user);

  // TODO: Check user roles from database or token
  // For now, just return the user
  // In production, you'd check: if (!user.roles.includes(requiredRole))

  return authenticatedUser;
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 */
export function optionalAuth(user: User | undefined): User | null {
  return user || null;
}
