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
      // Extract auth token from headers
      const authHeader = request.headers.get('Authorization');
      let user;

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // TODO: Verify token and extract user info
        // For now, basic validation
        if (token) {
          user = {
            id: 'user-123', // TODO: Extract from verified token
            email: 'user@example.com',
          };
        }
      }

      return {
        env,
        user,
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
