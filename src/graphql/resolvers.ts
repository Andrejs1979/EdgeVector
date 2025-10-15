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

// Vector operations
import { VectorStore } from '../storage/VectorStore';
import { VectorSearch } from '../vector/VectorSearch';
import { EmbeddingGenerator, type EmbeddingModel } from '../ai/embeddings';
import type { SimilarityMetric } from '../vector/similarity';

export interface Context {
  env: Env;
  user?: User;
  authenticated: boolean;
}

// Helper function to convert GraphQL SimilarityMetric enum to TypeScript type
function toSimilarityMetric(metric?: string): SimilarityMetric {
  switch (metric) {
    case 'COSINE':
      return 'cosine';
    case 'EUCLIDEAN':
      return 'euclidean';
    case 'DOT':
      return 'dot';
    default:
      return 'cosine'; // Default
  }
}

// Helper function to convert GraphQL EmbeddingModel enum to TypeScript type
function toEmbeddingModel(model?: string): EmbeddingModel {
  switch (model) {
    case 'BGE_SMALL':
      return '@cf/baai/bge-small-en-v1.5';
    case 'BGE_BASE':
      return '@cf/baai/bge-base-en-v1.5';
    case 'BGE_LARGE':
      return '@cf/baai/bge-large-en-v1.5';
    default:
      return '@cf/baai/bge-base-en-v1.5'; // Default
  }
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

    // Vector search operations
    vectorSearch: async (
      _parent: unknown,
      args: { vector: number[]; options?: any },
      context: Context
    ) => {
      const embeddingGenerator = new EmbeddingGenerator(context.env.AI, context.env.CACHE);
      const vectorSearch = new VectorSearch(context.env.DB, embeddingGenerator);

      const options = args.options || {};
      const searchOptions = {
        limit: options.limit,
        metric: toSimilarityMetric(options.metric),
        collection: options.collection,
        modelName: options.modelName,
        threshold: options.threshold,
        includeSelf: options.includeSelf,
        metadataFilter: options.metadataFilter,
      };

      const result = await vectorSearch.search(args.vector, searchOptions);

      return {
        results: result.results.map((r) => ({
          vector: {
            id: r.vector.id,
            documentId: r.vector.documentId,
            collection: r.vector.collection,
            dimensions: r.vector.dimensions,
            model: r.vector.modelName,
            normalized: r.vector.normalized,
            metadata: r.vector.metadata,
            createdAt: r.vector.createdAt,
            updatedAt: r.vector.updatedAt,
          },
          score: r.score,
          distance: r.distance,
        })),
        stats: result.stats,
      };
    },

    vectorSearchByText: async (
      _parent: unknown,
      args: { text: string; embeddingModel?: string; options?: any },
      context: Context
    ) => {
      const embeddingGenerator = new EmbeddingGenerator(context.env.AI, context.env.CACHE);
      const vectorSearch = new VectorSearch(context.env.DB, embeddingGenerator);

      const options = args.options || {};
      const searchOptions = {
        limit: options.limit,
        metric: toSimilarityMetric(options.metric),
        collection: options.collection,
        modelName: options.modelName,
        threshold: options.threshold,
        includeSelf: options.includeSelf,
        metadataFilter: options.metadataFilter,
        embeddingModel: toEmbeddingModel(args.embeddingModel),
      };

      const result = await vectorSearch.searchByText(args.text, searchOptions);

      return {
        results: result.results.map((r) => ({
          vector: {
            id: r.vector.id,
            documentId: r.vector.documentId,
            collection: r.vector.collection,
            dimensions: r.vector.dimensions,
            model: r.vector.modelName,
            normalized: r.vector.normalized,
            metadata: r.vector.metadata,
            createdAt: r.vector.createdAt,
            updatedAt: r.vector.updatedAt,
          },
          score: r.score,
          distance: r.distance,
        })),
        stats: result.stats,
      };
    },

    getVector: async (
      _parent: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const vectorStore = new VectorStore(context.env.DB);
      const vector = await vectorStore.find(args.documentId);

      if (!vector) {
        return null;
      }

      return {
        id: vector.id,
        documentId: vector.documentId,
        collection: vector.collection,
        dimensions: vector.dimensions,
        model: vector.modelName,
        normalized: vector.normalized,
        metadata: vector.metadata,
        createdAt: vector.createdAt,
        updatedAt: vector.updatedAt,
      };
    },

    vectorCollectionStats: async (
      _parent: unknown,
      args: { collection: string },
      context: Context
    ) => {
      const embeddingGenerator = new EmbeddingGenerator(context.env.AI, context.env.CACHE);
      const vectorSearch = new VectorSearch(context.env.DB, embeddingGenerator);

      return vectorSearch.getCollectionStats(args.collection);
    },

    compareSimilarity: async (
      _parent: unknown,
      args: { textA: string; textB: string; embeddingModel?: string },
      context: Context
    ) => {
      const embeddingGenerator = new EmbeddingGenerator(context.env.AI, context.env.CACHE);
      const model = toEmbeddingModel(args.embeddingModel);

      return embeddingGenerator.compareSimilarity(args.textA, args.textB, { model });
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

    // Vector mutation operations
    generateEmbedding: async (
      _parent: unknown,
      args: { text: string; embeddingModel?: string; normalize?: boolean },
      context: Context
    ) => {
      const embeddingGenerator = new EmbeddingGenerator(context.env.AI, context.env.CACHE);
      const model = toEmbeddingModel(args.embeddingModel);

      return embeddingGenerator.generateEmbeddingResult(args.text, {
        model,
        normalize: args.normalize !== false,
        useCache: true,
      });
    },

    generateEmbeddingBatch: async (
      _parent: unknown,
      args: { texts: string[]; embeddingModel?: string },
      context: Context
    ) => {
      const embeddingGenerator = new EmbeddingGenerator(context.env.AI, context.env.CACHE);
      const model = toEmbeddingModel(args.embeddingModel);

      const results = [];
      for (const text of args.texts) {
        const result = await embeddingGenerator.generateEmbeddingResult(text, {
          model,
          normalize: true,
          useCache: true,
        });
        results.push(result);
      }

      return results;
    },

    addVectorToDocument: async (
      _parent: unknown,
      args: { input: any },
      context: Context
    ) => {
      const vectorStore = new VectorStore(context.env.DB);
      const { documentId, vector, modelName, metadata, normalized } = args.input;

      const result = await vectorStore.insert({
        documentId,
        collection: '', // Will be extracted from document
        vector,
        modelName,
        metadata,
        normalized: normalized !== false,
      });

      return {
        id: result.id,
        documentId: result.documentId,
        collection: result.collection,
        dimensions: result.dimensions,
        model: result.modelName,
        normalized: result.normalized,
        metadata: result.metadata,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },

    updateVector: async (
      _parent: unknown,
      args: { documentId: string; vector: number[]; modelName?: string; metadata?: any },
      context: Context
    ) => {
      const vectorStore = new VectorStore(context.env.DB);

      const result = await vectorStore.updateByDocumentId(args.documentId, {
        vector: args.vector,
        modelName: args.modelName,
        metadata: args.metadata,
      });

      return {
        id: result.id,
        documentId: result.documentId,
        collection: result.collection,
        dimensions: result.dimensions,
        model: result.modelName,
        normalized: result.normalized,
        metadata: result.metadata,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    },

    deleteVector: async (
      _parent: unknown,
      args: { documentId: string },
      context: Context
    ) => {
      const vectorStore = new VectorStore(context.env.DB);
      return vectorStore.deleteByDocumentId(args.documentId);
    },

    deleteVectorCollection: async (
      _parent: unknown,
      args: { collection: string },
      context: Context
    ) => {
      const vectorStore = new VectorStore(context.env.DB);
      return vectorStore.deleteCollection(args.collection);
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
