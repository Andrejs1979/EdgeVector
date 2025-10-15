/**
 * GraphQL Resolvers for EdgeVector DB
 *
 * Connects GraphQL operations to DocumentStore
 */

import { GraphQLError } from 'graphql';
import { DocumentStore } from '../storage/DocumentStore';
import type { Env } from '../types/env';

import type { User } from '../auth/jwt';
import { generateToken, hashPassword, verifyPassword } from '../auth/jwt';
import { requireAuth } from '../auth/middleware';

export interface Context {
  env: Env;
  user?: User;
  authenticated: boolean;
}

export const resolvers = {
  Query: {
    // Get current authenticated user
    me: async (_parent: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context.user);

      // Fetch full user profile from database
      const result = await context.env.DB
        .prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
        .bind(user.id)
        .first();

      if (!result) {
        throw new GraphQLError('User not found');
      }

      return {
        id: result.id,
        email: result.email,
        name: result.name,
        createdAt: result.created_at,
      };
    },

    health: async (_parent: unknown, _args: unknown, context: Context) => {
      const collections = await context.env.DB
        .prepare('SELECT COUNT(*) as count FROM collections')
        .first();

      const documents = await context.env.DB
        .prepare('SELECT COUNT(*) as count FROM documents WHERE _deleted = FALSE')
        .first();

      return {
        status: 'ok',
        version: '0.1.0',
        environment: context.env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          collections: (collections as { count: number })?.count || 0,
          totalDocuments: (documents as { count: number })?.count || 0,
          totalSize: 0, // TODO: Calculate actual size
        },
      };
    },

    collections: async (_parent: unknown, _args: unknown, context: Context) => {
      const result = await context.env.DB
        .prepare('SELECT * FROM collections ORDER BY created_at DESC')
        .all();

      return (result.results || []).map((row: any) => ({
        id: row.id,
        name: row.collection_name,
        documentCount: row.document_count || 0,
        totalSizeBytes: row.total_size_bytes || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    collection: async (_parent: unknown, args: { name: string }, context: Context) => {
      const result = await context.env.DB
        .prepare('SELECT * FROM collections WHERE collection_name = ?')
        .bind(args.name)
        .first();

      if (!result) {
        return null;
      }

      const row = result as any;
      return {
        id: row.id,
        name: row.collection_name,
        documentCount: row.document_count || 0,
        totalSizeBytes: row.total_size_bytes || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    find: async (
      _parent: unknown,
      args: { collection: string; filter?: any; options?: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      const result = await store.find(args.filter || {}, args.options || {});

      return {
        documents: result.documents.map((doc: any) => ({
          _id: doc._id,
          data: doc,
        })),
        count: result.count,
        hasMore: args.options?.limit
          ? result.count >= args.options.limit
          : false,
      };
    },

    findOne: async (
      _parent: unknown,
      args: { collection: string; filter?: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      const doc = await store.findOne(args.filter || {});

      if (!doc) {
        return null;
      }

      return {
        _id: doc._id,
        data: doc,
      };
    },

    count: async (
      _parent: unknown,
      args: { collection: string; filter?: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.count(args.filter || {});
    },

    schemaStats: async (
      _parent: unknown,
      args: { collection: string },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.getSchemaStats();
    },
  },

  Mutation: {
    // Register a new user
    register: async (
      _parent: unknown,
      args: { input: { email: string; password: string; name?: string } },
      context: Context
    ) => {
      const { email, password, name } = args.input;

      // Validate input
      if (!email || !password) {
        throw new GraphQLError('Email and password are required');
      }

      if (password.length < 8) {
        throw new GraphQLError('Password must be at least 8 characters long');
      }

      // Check if user already exists
      const existing = await context.env.DB
        .prepare('SELECT id FROM users WHERE email = ?')
        .bind(email)
        .first();

      if (existing) {
        throw new GraphQLError('User with this email already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Generate user ID
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Insert user
      await context.env.DB
        .prepare(
          `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(userId, email, passwordHash, name || null, new Date().toISOString(), new Date().toISOString())
        .run();

      // Generate JWT token
      const secret = context.env.JWT_SECRET || 'default-secret-change-in-production';
      const token = await generateToken(
        {
          sub: userId,
          email,
          name,
        },
        secret,
        86400 // 24 hours
      );

      return {
        token,
        user: {
          id: userId,
          email,
          name,
          createdAt: new Date().toISOString(),
        },
      };
    },

    // Login user
    login: async (
      _parent: unknown,
      args: { input: { email: string; password: string } },
      context: Context
    ) => {
      const { email, password } = args.input;

      // Validate input
      if (!email || !password) {
        throw new GraphQLError('Email and password are required');
      }

      // Find user
      const user = await context.env.DB
        .prepare('SELECT id, email, name, password_hash, created_at, is_active FROM users WHERE email = ?')
        .bind(email)
        .first();

      if (!user) {
        throw new GraphQLError('Invalid email or password');
      }

      const userData = user as {
        id: string;
        email: string;
        name: string | null;
        password_hash: string;
        created_at: string;
        is_active: number;
      };

      // Check if user is active
      if (!userData.is_active) {
        throw new GraphQLError('Account is deactivated');
      }

      // Verify password
      const isValid = await verifyPassword(password, userData.password_hash);
      if (!isValid) {
        throw new GraphQLError('Invalid email or password');
      }

      // Update last login
      await context.env.DB
        .prepare('UPDATE users SET last_login = ? WHERE id = ?')
        .bind(new Date().toISOString(), userData.id)
        .run();

      // Generate JWT token
      const secret = context.env.JWT_SECRET || 'default-secret-change-in-production';
      const token = await generateToken(
        {
          sub: userData.id,
          email: userData.email,
          name: userData.name || undefined,
        },
        secret,
        86400 // 24 hours
      );

      return {
        token,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          createdAt: userData.created_at,
        },
      };
    },

    insertOne: async (
      _parent: unknown,
      args: { collection: string; document: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.insertOne(args.document);
    },

    insertMany: async (
      _parent: unknown,
      args: { collection: string; documents: any[] },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.insertMany(args.documents);
    },

    updateOne: async (
      _parent: unknown,
      args: { collection: string; filter: any; update: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.updateOne(args.filter, args.update);
    },

    updateMany: async (
      _parent: unknown,
      args: { collection: string; filter: any; update: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.updateMany(args.filter, args.update);
    },

    deleteOne: async (
      _parent: unknown,
      args: { collection: string; filter: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.deleteOne(args.filter);
    },

    deleteMany: async (
      _parent: unknown,
      args: { collection: string; filter: any },
      context: Context
    ) => {
      const store = new DocumentStore(context.env.DB, args.collection);
      await store.initialize();

      return store.deleteMany(args.filter);
    },

    createCollection: async (
      _parent: unknown,
      args: { name: string },
      context: Context
    ) => {
      await context.env.DB
        .prepare(
          `INSERT INTO collections (id, collection_name, created_at, updated_at)
           VALUES (?, ?, ?, ?)`
        )
        .bind(args.name, args.name, new Date().toISOString(), new Date().toISOString())
        .run();

      return {
        id: args.name,
        name: args.name,
        documentCount: 0,
        totalSizeBytes: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },

    dropCollection: async (
      _parent: unknown,
      args: { name: string },
      context: Context
    ) => {
      // Soft delete all documents
      await context.env.DB
        .prepare('UPDATE documents SET _deleted = TRUE WHERE _collection = ?')
        .bind(args.name)
        .run();

      // Delete collection metadata
      await context.env.DB
        .prepare('DELETE FROM collections WHERE collection_name = ?')
        .bind(args.name)
        .run();

      return true;
    },
  },

  // Custom scalar resolvers
  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => {
      // Parse AST to JavaScript value
      return ast.value;
    },
  },

  DateTime: {
    serialize: (value: Date | string) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    },
    parseValue: (value: string) => new Date(value),
    parseLiteral: (ast: any) => new Date(ast.value),
  },

  // Nested resolvers
  Collection: {
    schemaStats: async (parent: any, _args: unknown, context: Context) => {
      const store = new DocumentStore(context.env.DB, parent.name);
      await store.initialize();
      return store.getSchemaStats();
    },
  },
};
