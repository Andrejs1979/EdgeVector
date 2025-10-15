/**
 * Vector Search Client
 *
 * Handles vector search, embeddings, and similarity operations
 */

import { HttpClient } from '../utils/http-client';
import {
  VectorSearchOptions,
  VectorSearchResponse,
  EmbeddingResult,
  GenerateEmbeddingOptions,
  CompareSimilarityOptions,
  SimilarityResult,
  Vector,
  DeleteResult,
} from '../types';

export class VectorClient {
  constructor(private http: HttpClient) {}

  /**
   * Search by text using semantic similarity
   *
   * Automatically generates embeddings from the query text and finds similar vectors
   *
   * @param query - Text query for semantic search
   * @param options - Search options (collection, limit, metric, threshold, etc.)
   * @returns Search results with scores and distances
   *
   * @example
   * ```typescript
   * const results = await client.vectors.searchByText(
   *   'machine learning algorithms',
   *   {
   *     collection: 'articles',
   *     limit: 10,
   *     metric: 'cosine',
   *     threshold: 0.7
   *   }
   * );
   *
   * results.results.forEach(result => {
   *   console.log(`Document ${result.vector.documentId}: ${result.score}`);
   * });
   * ```
   */
  async searchByText(
    query: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResponse> {
    const gqlQuery = `
      query VectorSearchByText(
        $query: String!
        $collection: String
        $limit: Int
        $metric: SimilarityMetric
        $threshold: Float
        $modelName: String
      ) {
        vectorSearchByText(
          query: $query
          options: {
            collection: $collection
            limit: $limit
            metric: $metric
            threshold: $threshold
            modelName: $modelName
          }
        ) {
          results {
            vector {
              id
              documentId
              collection
              dimensions
              modelName
              normalized
              metadata
              createdAt
            }
            score
            distance
          }
          stats {
            totalVectors
            searchTimeMs
          }
        }
      }
    `;

    const response = await this.http.request<{
      vectorSearchByText: VectorSearchResponse;
    }>(gqlQuery, {
      query,
      ...options,
    });

    return response.vectorSearchByText;
  }

  /**
   * Search by vector embedding
   *
   * @param vector - Vector embedding to search with
   * @param options - Search options
   * @returns Search results with scores and distances
   *
   * @example
   * ```typescript
   * const embedding = [0.1, 0.2, 0.3, ...]; // 768-dimensional vector
   * const results = await client.vectors.searchByVector(embedding, {
   *   limit: 5,
   *   metric: 'cosine'
   * });
   * ```
   */
  async searchByVector(
    vector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResponse> {
    const gqlQuery = `
      query VectorSearch(
        $vector: [Float!]!
        $collection: String
        $limit: Int
        $metric: SimilarityMetric
        $threshold: Float
        $modelName: String
      ) {
        vectorSearch(
          vector: $vector
          options: {
            collection: $collection
            limit: $limit
            metric: $metric
            threshold: $threshold
            modelName: $modelName
          }
        ) {
          results {
            vector {
              id
              documentId
              collection
              dimensions
              modelName
              normalized
              metadata
              createdAt
            }
            score
            distance
          }
          stats {
            totalVectors
            searchTimeMs
          }
        }
      }
    `;

    const response = await this.http.request<{
      vectorSearch: VectorSearchResponse;
    }>(gqlQuery, {
      vector,
      ...options,
    });

    return response.vectorSearch;
  }

  /**
   * Generate embedding from text
   *
   * Uses Cloudflare Workers AI to generate vector embeddings
   *
   * @param text - Text to generate embedding for
   * @param options - Generation options (model, normalize, useCache)
   * @returns Embedding result with vector and metadata
   *
   * @example
   * ```typescript
   * const result = await client.vectors.generateEmbedding(
   *   'The quick brown fox jumps over the lazy dog',
   *   { model: 'bge-base', normalize: true }
   * );
   *
   * console.log(`Generated ${result.dimensions}-dimensional vector`);
   * console.log(`Cached: ${result.cached}`);
   * ```
   */
  async generateEmbedding(
    text: string,
    options: GenerateEmbeddingOptions = {}
  ): Promise<EmbeddingResult> {
    const query = `
      mutation GenerateEmbedding(
        $text: String!
        $model: EmbeddingModel
        $normalize: Boolean
        $useCache: Boolean
      ) {
        generateEmbedding(
          text: $text
          model: $model
          normalize: $normalize
          useCache: $useCache
        ) {
          embedding
          dimensions
          model
          cached
        }
      }
    `;

    const response = await this.http.request<{
      generateEmbedding: EmbeddingResult;
    }>(query, {
      text,
      model: options.model?.toUpperCase().replace('-', '_'),
      normalize: options.normalize,
      useCache: options.useCache,
    });

    return response.generateEmbedding;
  }

  /**
   * Generate embeddings for multiple texts in batch
   *
   * More efficient than calling generateEmbedding multiple times
   *
   * @param texts - Array of texts to generate embeddings for
   * @param options - Generation options
   * @returns Array of embedding results
   *
   * @example
   * ```typescript
   * const results = await client.vectors.generateEmbeddingBatch([
   *   'First document',
   *   'Second document',
   *   'Third document'
   * ], { model: 'bge-base' });
   *
   * console.log(`Generated ${results.length} embeddings`);
   * ```
   */
  async generateEmbeddingBatch(
    texts: string[],
    options: GenerateEmbeddingOptions = {}
  ): Promise<EmbeddingResult[]> {
    const query = `
      mutation GenerateEmbeddingBatch(
        $texts: [String!]!
        $model: EmbeddingModel
        $normalize: Boolean
        $useCache: Boolean
      ) {
        generateEmbeddingBatch(
          texts: $texts
          model: $model
          normalize: $normalize
          useCache: $useCache
        ) {
          embedding
          dimensions
          model
          cached
        }
      }
    `;

    const response = await this.http.request<{
      generateEmbeddingBatch: EmbeddingResult[];
    }>(query, {
      texts,
      model: options.model?.toUpperCase().replace('-', '_'),
      normalize: options.normalize,
      useCache: options.useCache,
    });

    return response.generateEmbeddingBatch;
  }

  /**
   * Compare similarity between two texts
   *
   * @param text1 - First text
   * @param text2 - Second text
   * @param options - Comparison options (metric, model)
   * @returns Similarity result with score
   *
   * @example
   * ```typescript
   * const result = await client.vectors.compareSimilarity(
   *   'machine learning',
   *   'artificial intelligence',
   *   { metric: 'cosine' }
   * );
   *
   * console.log(`Similarity: ${result.similarity}`);
   * ```
   */
  async compareSimilarity(
    text1: string,
    text2: string,
    options: CompareSimilarityOptions = {}
  ): Promise<SimilarityResult> {
    const query = `
      query CompareSimilarity(
        $text1: String!
        $text2: String!
        $metric: SimilarityMetric
        $model: EmbeddingModel
      ) {
        compareSimilarity(
          text1: $text1
          text2: $text2
          metric: $metric
          model: $model
        ) {
          similarity
          metric
          text1
          text2
        }
      }
    `;

    const response = await this.http.request<{
      compareSimilarity: SimilarityResult;
    }>(query, {
      text1,
      text2,
      metric: options.metric?.toUpperCase(),
      model: options.model?.toUpperCase().replace('-', '_'),
    });

    return response.compareSimilarity;
  }

  /**
   * Get vector for a specific document
   *
   * @param collection - Collection name
   * @param documentId - Document ID
   * @returns Vector or null if not found
   *
   * @example
   * ```typescript
   * const vector = await client.vectors.get('articles', 'doc123');
   * if (vector) {
   *   console.log(`Vector dimensions: ${vector.dimensions}`);
   * }
   * ```
   */
  async get(collection: string, documentId: string): Promise<Vector | null> {
    const query = `
      query GetVector($collection: String!, $documentId: String!) {
        getVector(collection: $collection, documentId: $documentId) {
          id
          documentId
          collection
          dimensions
          modelName
          normalized
          metadata
          createdAt
        }
      }
    `;

    const response = await this.http.request<{
      getVector: Vector | null;
    }>(query, { collection, documentId });

    return response.getVector;
  }

  /**
   * Add vector to a document
   *
   * @param collection - Collection name
   * @param documentId - Document ID
   * @param vector - Vector embedding
   * @param metadata - Optional metadata
   * @returns Vector ID
   *
   * @example
   * ```typescript
   * const embedding = [0.1, 0.2, ...]; // Generated embedding
   * await client.vectors.add('articles', 'doc123', embedding, {
   *   source: 'manual',
   *   model: 'bge-base-en-v1.5'
   * });
   * ```
   */
  async add(
    collection: string,
    documentId: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<string> {
    const query = `
      mutation AddVectorToDocument(
        $collection: String!
        $documentId: String!
        $vector: [Float!]!
        $metadata: JSON
      ) {
        addVectorToDocument(
          collection: $collection
          documentId: $documentId
          vector: $vector
          metadata: $metadata
        )
      }
    `;

    const response = await this.http.request<{
      addVectorToDocument: string;
    }>(query, {
      collection,
      documentId,
      vector,
      metadata,
    });

    return response.addVectorToDocument;
  }

  /**
   * Update vector for a document
   *
   * @param collection - Collection name
   * @param documentId - Document ID
   * @param vector - New vector embedding
   * @param metadata - Optional metadata
   * @returns Success boolean
   *
   * @example
   * ```typescript
   * await client.vectors.update('articles', 'doc123', newEmbedding);
   * ```
   */
  async update(
    collection: string,
    documentId: string,
    vector: number[],
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const query = `
      mutation UpdateVector(
        $collection: String!
        $documentId: String!
        $vector: [Float!]!
        $metadata: JSON
      ) {
        updateVector(
          collection: $collection
          documentId: $documentId
          vector: $vector
          metadata: $metadata
        )
      }
    `;

    const response = await this.http.request<{
      updateVector: boolean;
    }>(query, {
      collection,
      documentId,
      vector,
      metadata,
    });

    return response.updateVector;
  }

  /**
   * Delete vector for a document
   *
   * @param collection - Collection name
   * @param documentId - Document ID
   * @returns Delete result
   *
   * @example
   * ```typescript
   * await client.vectors.delete('articles', 'doc123');
   * ```
   */
  async delete(collection: string, documentId: string): Promise<DeleteResult> {
    const query = `
      mutation DeleteVector($collection: String!, $documentId: String!) {
        deleteVector(collection: $collection, documentId: $documentId) {
          deletedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      deleteVector: DeleteResult;
    }>(query, { collection, documentId });

    return response.deleteVector;
  }

  /**
   * Delete all vectors in a collection
   *
   * **Warning:** This operation is irreversible
   *
   * @param collection - Collection name
   * @returns Delete result with count
   *
   * @example
   * ```typescript
   * const result = await client.vectors.deleteCollection('old_articles');
   * console.log(`Deleted ${result.deletedCount} vectors`);
   * ```
   */
  async deleteCollection(collection: string): Promise<DeleteResult> {
    const query = `
      mutation DeleteVectorCollection($collection: String!) {
        deleteVectorCollection(collection: $collection) {
          deletedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      deleteVectorCollection: DeleteResult;
    }>(query, { collection });

    return response.deleteVectorCollection;
  }

  /**
   * Get collection statistics
   *
   * @param collection - Collection name
   * @returns Statistics about vectors in the collection
   *
   * @example
   * ```typescript
   * const stats = await client.vectors.getStats('articles');
   * console.log(`Total vectors: ${stats.totalVectors}`);
   * console.log(`Dimensions: ${stats.dimensions}`);
   * console.log(`Models: ${stats.models.join(', ')}`);
   * ```
   */
  async getStats(
    collection: string
  ): Promise<{
    collection: string;
    totalVectors: number;
    dimensions: number;
    models: string[];
  }> {
    const query = `
      query VectorCollectionStats($collection: String!) {
        vectorCollectionStats(collection: $collection) {
          collection
          totalVectors
          dimensions
          models
        }
      }
    `;

    const response = await this.http.request<{
      vectorCollectionStats: {
        collection: string;
        totalVectors: number;
        dimensions: number;
        models: string[];
      };
    }>(query, { collection });

    return response.vectorCollectionStats;
  }
}
