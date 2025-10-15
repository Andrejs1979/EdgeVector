/**
 * EdgeVector DB - Main Entry Point
 * Edge-native database platform with schema-free documents, vectors, and real-time capabilities
 */

import { Env } from './types/env';
import { createGraphQLServer } from './graphql/server';
import {
  RateLimiter,
  RATE_LIMITS,
  getRateLimitIdentifier,
  addRateLimitHeaders,
  createRateLimitResponse,
} from './middleware/rateLimiter';

// Export Durable Objects
export { ShardManager } from './durable-objects/ShardManager';
export { QueryPatternAnalyzer } from './durable-objects/QueryPatternAnalyzer';
export { SSEManager } from './durable-objects/SSEManager';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint (simple, non-GraphQL)
    if (url.pathname === '/health') {
      // Apply rate limiting
      const rateLimiter = new RateLimiter(env.CACHE, RATE_LIMITS.health);
      const identifier = getRateLimitIdentifier(request);
      const rateLimit = await rateLimiter.checkLimit(identifier);

      if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit);
      }

      const response = new Response(JSON.stringify({
        status: 'ok',
        service: 'edgevector-db',
        version: '0.1.0',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

      // Add rate limit headers
      addRateLimitHeaders(response.headers, rateLimit);
      return response;
    }

    // GraphQL endpoint
    if (url.pathname.startsWith('/graphql')) {
      // Apply rate limiting before GraphQL
      const rateLimiter = new RateLimiter(env.CACHE, RATE_LIMITS.graphql);
      const identifier = getRateLimitIdentifier(request);
      const rateLimit = await rateLimiter.checkLimit(identifier, false);

      if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit);
      }

      // Execute GraphQL request
      const yoga = createGraphQLServer(env);
      const response = await yoga.fetch(request, env, ctx);

      // Add rate limit headers to response
      const newHeaders = new Headers(response.headers);
      addRateLimitHeaders(newHeaders, rateLimit);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // Root endpoint - API information
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        name: 'EdgeVector DB',
        version: '0.1.0',
        description: 'Edge-native database with schema-free documents, vectors, and real-time capabilities',
        endpoints: {
          graphql: '/graphql',
          health: '/health',
        },
        documentation: 'https://github.com/Andrejs1979/EdgeVector',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist. Try /graphql or /health',
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
