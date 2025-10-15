/**
 * Rate Limiter using Cloudflare Workers KV
 *
 * Implements token bucket algorithm for rate limiting
 */

import type { Env } from '../types/env';

export interface RateLimitConfig {
  // Maximum number of requests allowed in the window
  maxRequests: number;
  // Time window in seconds
  windowSeconds: number;
  // Optional: Different limit for authenticated users
  authenticatedMultiplier?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp
  retryAfter?: number; // Seconds to wait before retry
}

export interface RateLimitInfo {
  count: number;
  resetAt: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // GraphQL endpoint: 100 requests per minute for unauthenticated
  graphql: {
    maxRequests: 100,
    windowSeconds: 60,
    authenticatedMultiplier: 5, // 500 requests per minute for authenticated
  },
  // Authentication endpoints: 10 attempts per minute
  auth: {
    maxRequests: 10,
    windowSeconds: 60,
  },
  // Health check: 300 requests per minute
  health: {
    maxRequests: 300,
    windowSeconds: 60,
  },
} as const;

/**
 * Rate limiter class
 */
export class RateLimiter {
  constructor(
    private kv: KVNamespace,
    private config: RateLimitConfig
  ) {}

  /**
   * Check if request is allowed and update counter
   */
  async checkLimit(
    identifier: string,
    isAuthenticated: boolean = false
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;

    // Calculate effective limit based on authentication
    const effectiveLimit = isAuthenticated && this.config.authenticatedMultiplier
      ? this.config.maxRequests * this.config.authenticatedMultiplier
      : this.config.maxRequests;

    // Create key for this identifier
    const key = `ratelimit:${identifier}`;

    try {
      // Get current rate limit info
      const existing = await this.kv.get<RateLimitInfo>(key, 'json');

      let count = 1;
      let resetAt = now + windowMs;

      if (existing) {
        // Check if window has expired
        if (now >= existing.resetAt) {
          // Window expired, reset counter
          count = 1;
          resetAt = now + windowMs;
        } else {
          // Window still active, increment counter
          count = existing.count + 1;
          resetAt = existing.resetAt;
        }
      }

      // Check if limit exceeded
      const allowed = count <= effectiveLimit;
      const remaining = Math.max(0, effectiveLimit - count);

      // Update KV with new count (only if allowed or first request in window)
      if (allowed || count === 1) {
        const info: RateLimitInfo = {
          count,
          resetAt,
        };

        // Store with TTL matching the window
        // KV requires minimum TTL of 60 seconds
        const ttl = Math.ceil((resetAt - now) / 1000);
        await this.kv.put(key, JSON.stringify(info), {
          expirationTtl: Math.max(ttl, 60),
        });
      }

      return {
        allowed,
        limit: effectiveLimit,
        remaining,
        resetAt,
        retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the request but log the issue
      return {
        allowed: true,
        limit: effectiveLimit,
        remaining: effectiveLimit,
        resetAt: now + windowMs,
      };
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(identifier: string, isAuthenticated: boolean = false): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;

    const effectiveLimit = isAuthenticated && this.config.authenticatedMultiplier
      ? this.config.maxRequests * this.config.authenticatedMultiplier
      : this.config.maxRequests;

    const key = `ratelimit:${identifier}`;

    try {
      const existing = await this.kv.get<RateLimitInfo>(key, 'json');

      if (!existing || now >= existing.resetAt) {
        // No active window
        return {
          allowed: true,
          limit: effectiveLimit,
          remaining: effectiveLimit,
          resetAt: now + windowMs,
        };
      }

      const remaining = Math.max(0, effectiveLimit - existing.count);
      const allowed = existing.count < effectiveLimit;

      return {
        allowed,
        limit: effectiveLimit,
        remaining,
        resetAt: existing.resetAt,
        retryAfter: allowed ? undefined : Math.ceil((existing.resetAt - now) / 1000),
      };
    } catch (error) {
      console.error('Rate limit status error:', error);
      return {
        allowed: true,
        limit: effectiveLimit,
        remaining: effectiveLimit,
        resetAt: now + windowMs,
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `ratelimit:${identifier}`;
    await this.kv.delete(key);
  }
}

/**
 * Get identifier for rate limiting from request
 * Uses IP address, or user ID if authenticated
 */
export function getRateLimitIdentifier(
  request: Request,
  userId?: string
): string {
  // Use user ID if authenticated
  if (userId) {
    return `user:${userId}`;
  }

  // Use IP address from CF-Connecting-IP header
  const ip = request.headers.get('CF-Connecting-IP') ||
              request.headers.get('X-Forwarded-For') ||
              request.headers.get('X-Real-IP') ||
              'unknown';

  return `ip:${ip}`;
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.resetAt.toString());

  if (result.retryAfter !== undefined) {
    headers.set('Retry-After', result.retryAfter.toString());
  }
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  addRateLimitHeaders(headers, result);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
      limit: result.limit,
      resetAt: new Date(result.resetAt).toISOString(),
    }),
    {
      status: 429,
      headers,
    }
  );
}
