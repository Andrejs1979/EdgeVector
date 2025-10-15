/**
 * GraphQL Yoga Server for Cloudflare Workers
 *
 * Creates a GraphQL server instance with schema, resolvers, and context
 */

import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import { typeDefs } from './schema';
import { resolvers, type Context } from './resolvers';
import type { Env } from '../types/env';
import { authenticateRequest } from '../auth/middleware';

export function createGraphQLServer(env: Env) {
  const schema = createSchema({
    typeDefs,
    resolvers,
  });

  const yoga = createYoga<Env & ExecutionContext>({
    schema: schema as any, // Type assertion needed for GraphQL Yoga + Cloudflare Workers compatibility
    graphqlEndpoint: '/graphql',
    landingPage: true, // GraphQL Playground
    cors: {
      origin: '*', // Configure properly in production
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
    },
    context: async ({ request }): Promise<Context> => {
      // Use env from closure (passed to createGraphQLServer)
      // Authenticate request using JWT middleware
      const authResult = await authenticateRequest(request, env);

      return {
        env,
        user: authResult.user || undefined,
        authenticated: authResult.authenticated,
      };
    },
    plugins: [
      // Add custom plugins here
      {
        onExecute: () => ({
          onExecuteDone: ({ result, setResult }) => {
            // Add custom headers or logging
            console.log('GraphQL execution complete');
          },
        }),
      },
    ],
  });

  return yoga;
}
