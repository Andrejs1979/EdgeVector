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
import { MCPServer, registerAllTools } from './mcp';

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

    // MCP endpoint - Model Context Protocol for AI agents
    if (url.pathname === '/mcp' && request.method === 'POST') {
      try {
        // Parse MCP request
        const mcpRequest = await request.json();

        // Create MCP server instance
        const mcpServer = new MCPServer({
          name: 'EdgeVector DB MCP Server',
          version: '0.1.0',
          capabilities: {
            tools: true,
            resources: false,
          },
        });

        // Register all tools
        registerAllTools(mcpServer);

        // Handle request with context
        const context = {
          env,
          user: undefined, // TODO: Add user from auth if needed
        };

        // Inject context into params for tools
        if (mcpRequest.params && mcpRequest.method === 'call_tool') {
          mcpRequest.params.arguments._context = context;
        }

        const mcpResponse = await mcpServer.handleRequest(mcpRequest, context);

        return new Response(JSON.stringify(mcpResponse), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : 'Unknown error',
          },
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
          mcp: '/mcp',
        },
        features: [
          'Schema-free document storage',
          'Vector search with semantic embeddings',
          'MongoDB-compatible query API',
          'JWT authentication',
          'Rate limiting',
          'MCP 1.0 for AI agents',
        ],
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
