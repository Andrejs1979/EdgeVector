/**
 * MCP Tools Implementation
 *
 * Provides tools for AI agents to interact with EdgeVector DB
 */

import { MCPTool, MCPToolContext } from './types';
import { DocumentStore } from '../storage/DocumentStore';
import { VectorStore } from '../storage/VectorStore';
import { VectorSearch } from '../vector/VectorSearch';
import { EmbeddingGenerator } from '../ai/embeddings';

/**
 * Search documents tool
 *
 * Allows agents to search documents with MongoDB-style filters
 */
export const searchDocumentsTool: MCPTool = {
  name: 'search_documents',
  description: 'Search documents in a collection using MongoDB-style query filters. Supports complex queries with operators like $eq, $gt, $lt, $in, $and, $or, etc.',
  parameters: [
    {
      name: 'collection',
      type: 'string',
      description: 'The collection to search in',
      required: true,
    },
    {
      name: 'filter',
      type: 'object',
      description: 'MongoDB-style query filter (e.g., {name: "John", age: {$gt: 25}})',
      required: false,
      default: {},
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of documents to return',
      required: false,
      default: 10,
    },
    {
      name: 'skip',
      type: 'number',
      description: 'Number of documents to skip (for pagination)',
      required: false,
      default: 0,
    },
  ],
  handler: async (params: any) => {
    const context = params._context as MCPToolContext;
    if (!context || !context.env) {
      throw new Error('Context not provided');
    }

    const { collection, filter = {}, limit = 10, skip = 0 } = params;

    const store = new DocumentStore(context.env.DB, collection);
    await store.initialize();

    const result = await store.find(filter, { limit, skip });

    return {
      collection,
      count: result.count,
      documents: result.documents,
      hasMore: result.count > limit,
    };
  },
};

/**
 * Vector search tool
 *
 * Allows agents to perform semantic similarity search
 */
export const vectorSearchTool: MCPTool = {
  name: 'vector_search',
  description: 'Perform semantic similarity search using text queries or vector embeddings. Automatically generates embeddings from text and finds similar documents.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'Text query for semantic search (will be converted to vector)',
      required: true,
    },
    {
      name: 'collection',
      type: 'string',
      description: 'The collection to search in',
      required: false,
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      default: 10,
    },
    {
      name: 'metric',
      type: 'string',
      description: 'Similarity metric to use: cosine, euclidean, or dot',
      required: false,
      default: 'cosine',
    },
    {
      name: 'threshold',
      type: 'number',
      description: 'Minimum similarity threshold (0-1 for cosine)',
      required: false,
    },
  ],
  handler: async (params: any) => {
    const context = params._context as MCPToolContext;
    if (!context || !context.env) {
      throw new Error('Context not provided');
    }

    const {
      query,
      collection,
      limit = 10,
      metric = 'cosine',
      threshold,
    } = params;

    const embeddingGenerator = new EmbeddingGenerator(
      context.env.AI,
      context.env.CACHE
    );
    const vectorSearch = new VectorSearch(context.env.DB, embeddingGenerator);

    const result = await vectorSearch.searchByText(query, {
      collection,
      limit,
      metric: metric as any,
      threshold,
    });

    return {
      query,
      resultsCount: result.results.length,
      results: result.results.map((r) => ({
        documentId: r.vector.documentId,
        collection: r.vector.collection,
        score: r.score,
        distance: r.distance,
        metadata: r.vector.metadata,
      })),
      stats: result.stats,
    };
  },
};

/**
 * Store memory tool
 *
 * Allows agents to persist memories for later retrieval
 */
export const storeMemoryTool: MCPTool = {
  name: 'store_memory',
  description: 'Store a memory (text or structured data) for later retrieval. Automatically generates vector embeddings for semantic search. Useful for remembering context, facts, or conversation history.',
  parameters: [
    {
      name: 'memory',
      type: 'string',
      description: 'The memory text to store',
      required: true,
    },
    {
      name: 'metadata',
      type: 'object',
      description: 'Additional metadata (tags, category, importance, etc.)',
      required: false,
      default: {},
    },
    {
      name: 'collection',
      type: 'string',
      description: 'Collection to store the memory in (default: "agent_memories")',
      required: false,
      default: 'agent_memories',
    },
  ],
  handler: async (params: any) => {
    const context = params._context as MCPToolContext;
    if (!context || !context.env) {
      throw new Error('Context not provided');
    }

    const {
      memory,
      metadata = {},
      collection = 'agent_memories',
    } = params;

    // Store document
    const store = new DocumentStore(context.env.DB, collection);
    await store.initialize();

    const doc = {
      memory,
      timestamp: new Date().toISOString(),
      userId: context.user?.id,
      ...metadata,
    };

    const insertResult = await store.insertOne(doc);

    // Generate and store vector embedding
    const embeddingGenerator = new EmbeddingGenerator(
      context.env.AI,
      context.env.CACHE
    );
    const embedding = await embeddingGenerator.generateEmbedding(memory, {
      normalize: true,
      useCache: true,
    });

    const vectorStore = new VectorStore(context.env.DB);
    await vectorStore.insert({
      documentId: insertResult._id,
      collection,
      vector: embedding,
      modelName: '@cf/baai/bge-base-en-v1.5',
      metadata: {
        type: 'memory',
        ...metadata,
      },
      normalized: true,
    });

    return {
      success: true,
      memoryId: insertResult._id,
      collection,
      message: 'Memory stored successfully',
    };
  },
};

/**
 * Retrieve memory tool
 *
 * Allows agents to retrieve relevant memories based on context
 */
export const retrieveMemoryTool: MCPTool = {
  name: 'retrieve_memory',
  description: 'Retrieve relevant memories based on a query. Uses semantic search to find memories similar to the given context. Returns the most relevant stored memories.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'Query text to find relevant memories',
      required: true,
    },
    {
      name: 'collection',
      type: 'string',
      description: 'Collection to search in (default: "agent_memories")',
      required: false,
      default: 'agent_memories',
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of memories to retrieve',
      required: false,
      default: 5,
    },
    {
      name: 'threshold',
      type: 'number',
      description: 'Minimum similarity threshold (0-1)',
      required: false,
      default: 0.7,
    },
  ],
  handler: async (params: any) => {
    const context = params._context as MCPToolContext;
    if (!context || !context.env) {
      throw new Error('Context not provided');
    }

    const {
      query,
      collection = 'agent_memories',
      limit = 5,
      threshold = 0.7,
    } = params;

    // Perform vector search
    const embeddingGenerator = new EmbeddingGenerator(
      context.env.AI,
      context.env.CACHE
    );
    const vectorSearch = new VectorSearch(context.env.DB, embeddingGenerator);

    const searchResult = await vectorSearch.searchByText(query, {
      collection,
      limit,
      threshold,
      metric: 'cosine',
    });

    // Fetch full documents
    const store = new DocumentStore(context.env.DB, collection);
    await store.initialize();

    const memories = [];
    for (const result of searchResult.results) {
      const doc = await store.findOne({ _id: result.vector.documentId });
      if (doc) {
        memories.push({
          memoryId: doc._id,
          memory: doc.memory,
          metadata: doc.metadata || {},
          similarity: result.score,
          timestamp: doc.timestamp,
        });
      }
    }

    return {
      query,
      memoriesFound: memories.length,
      memories,
      stats: searchResult.stats,
    };
  },
};

/**
 * Get all available MCP tools
 */
export function getAllTools(): MCPTool[] {
  return [
    searchDocumentsTool,
    vectorSearchTool,
    storeMemoryTool,
    retrieveMemoryTool,
  ];
}

/**
 * Register all tools with MCP server
 */
export function registerAllTools(server: any): void {
  const tools = getAllTools();
  for (const tool of tools) {
    server.registerTool(tool);
  }
}
