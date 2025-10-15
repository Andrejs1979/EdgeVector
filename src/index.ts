/**
 * EdgeVector DB - Main Entry Point
 * Edge-native database platform with schema-free documents, vectors, and real-time capabilities
 */

import { Env } from './types/env';

// Export Durable Objects
export { ShardManager } from './durable-objects/ShardManager';
export { QueryPatternAnalyzer } from './durable-objects/QueryPatternAnalyzer';
export { SSEManager } from './durable-objects/SSEManager';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'edgevector-db',
        version: '0.1.0',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // API routes will be added here
    if (url.pathname.startsWith('/graphql')) {
      return new Response('GraphQL endpoint coming soon', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
