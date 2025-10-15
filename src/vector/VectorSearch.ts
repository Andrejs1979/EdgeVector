/**
 * VectorSearch Engine
 *
 * Implements brute-force k-NN (k-Nearest Neighbors) search for MVP.
 * Sufficient for <10k vectors with <100ms search time.
 * Future: Will add ANN (Approximate Nearest Neighbor) algorithms like HNSW or IVF.
 */

import { D1Database } from '@cloudflare/workers-types';
import { VectorStore, Vector } from '../storage/VectorStore';
import {
  SimilarityMetric,
  calculateSimilarity,
  topKSimilar,
} from './similarity';
import { validateDimensions } from './utils';

export interface VectorSearchOptions {
  /**
   * Number of results to return (default: 10)
   */
  limit?: number;

  /**
   * Similarity metric to use (default: 'cosine')
   */
  metric?: SimilarityMetric;

  /**
   * Filter results by collection
   */
  collection?: string;

  /**
   * Filter results by model name
   */
  modelName?: string;

  /**
   * Filter results by dimensions
   */
  dimensions?: number;

  /**
   * Minimum similarity threshold
   * - For cosine/dot: higher is more similar
   * - For euclidean: lower is more similar
   */
  threshold?: number;

  /**
   * Include the query vector itself in results (default: false)
   */
  includeSelf?: boolean;

  /**
   * Metadata filter (exact match on metadata fields)
   */
  metadataFilter?: Record<string, any>;
}

export interface VectorSearchResult {
  vector: Vector;
  score: number;
  distance?: number;
}

export interface VectorSearchStats {
  queryTime: number;
  vectorsScanned: number;
  vectorsFiltered: number;
  resultsReturned: number;
  cacheHit: boolean;
}

/**
 * VectorSearch class for semantic similarity search
 */
export class VectorSearch {
  private vectorStore: VectorStore;

  constructor(private db: D1Database) {
    this.vectorStore = new VectorStore(db);
  }

  /**
   * Search for similar vectors using query vector
   */
  async search(
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<{
    results: VectorSearchResult[];
    stats: VectorSearchStats;
  }> {
    const startTime = Date.now();

    // Validate query vector
    validateDimensions(queryVector, undefined, 4096);

    // Set defaults
    const {
      limit = 10,
      metric = 'cosine',
      collection,
      modelName,
      dimensions,
      threshold,
      includeSelf = false,
      metadataFilter,
    } = options;

    // Get vectors to search through
    let vectors: Vector[];

    if (collection) {
      vectors = await this.vectorStore.getAllVectors(collection);
    } else {
      vectors = await this.vectorStore.query({
        modelName,
        dimensions: dimensions || queryVector.length,
      });
    }

    const vectorsScanned = vectors.length;

    // Apply dimension filter
    vectors = vectors.filter((v) => v.dimensions === queryVector.length);

    // Apply metadata filter
    if (metadataFilter) {
      vectors = vectors.filter((v) => {
        if (!v.metadata) return false;

        return Object.entries(metadataFilter).every(
          ([key, value]) => v.metadata![key] === value
        );
      });
    }

    const vectorsFiltered = vectors.length;

    // Perform brute-force k-NN search
    const searchResults = this.bruteForceKNN(
      queryVector,
      vectors,
      limit,
      metric,
      threshold
    );

    // Filter out self if needed (exact matches)
    let results = searchResults;
    if (!includeSelf) {
      results = results.filter((r) => {
        // Check if vectors are identical
        return !this.vectorsAreIdentical(queryVector, r.vector.vector);
      });
    }

    const queryTime = Date.now() - startTime;

    return {
      results,
      stats: {
        queryTime,
        vectorsScanned,
        vectorsFiltered,
        resultsReturned: results.length,
        cacheHit: false,
      },
    };
  }

  /**
   * Search using text by generating embeddings (requires Workers AI)
   * This will be implemented in the embeddings module
   */
  async searchByText(
    text: string,
    options: VectorSearchOptions = {}
  ): Promise<{
    results: VectorSearchResult[];
    stats: VectorSearchStats;
  }> {
    throw new Error(
      'searchByText requires Workers AI integration - implement in embeddings module'
    );
  }

  /**
   * Brute-force k-NN search implementation
   * Complexity: O(n*d) where n = number of vectors, d = dimensions
   */
  private bruteForceKNN(
    queryVector: number[],
    vectors: Vector[],
    k: number,
    metric: SimilarityMetric,
    threshold?: number
  ): VectorSearchResult[] {
    // Calculate similarities for all vectors
    const similarities = vectors.map((vector) => {
      const score = calculateSimilarity(queryVector, vector.vector, metric);
      return {
        vector,
        score,
      };
    });

    // Apply threshold filter if specified
    let filtered = similarities;
    if (threshold !== undefined) {
      if (metric === 'euclidean') {
        // For distance: lower is better, filter <= threshold
        filtered = similarities.filter((s) => s.score <= threshold);
      } else {
        // For similarity: higher is better, filter >= threshold
        filtered = similarities.filter((s) => s.score >= threshold);
      }
    }

    // Sort by similarity
    if (metric === 'euclidean') {
      // Distance: lower is better (ascending)
      filtered.sort((a, b) => a.score - b.score);
    } else {
      // Similarity: higher is better (descending)
      filtered.sort((a, b) => b.score - a.score);
    }

    // Take top-k
    const topK = filtered.slice(0, k);

    // Format results
    return topK.map((item) => ({
      vector: item.vector,
      score: item.score,
      distance: metric === 'euclidean' ? item.score : undefined,
    }));
  }

  /**
   * Check if two vectors are identical
   */
  private vectorsAreIdentical(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;

    const tolerance = 1e-6;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > tolerance) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find vectors within a similarity threshold
   */
  async findSimilar(
    queryVector: number[],
    threshold: number,
    options: Omit<VectorSearchOptions, 'threshold'> = {}
  ): Promise<{
    results: VectorSearchResult[];
    stats: VectorSearchStats;
  }> {
    return this.search(queryVector, {
      ...options,
      threshold,
      limit: 1000, // Large limit for radius search
    });
  }

  /**
   * Compare two vectors directly
   */
  async compareVectors(
    vectorA: number[],
    vectorB: number[],
    metric: SimilarityMetric = 'cosine'
  ): Promise<number> {
    validateDimensions(vectorA);
    validateDimensions(vectorB);

    if (vectorA.length !== vectorB.length) {
      throw new Error(
        `Vector dimension mismatch: ${vectorA.length} vs ${vectorB.length}`
      );
    }

    return calculateSimilarity(vectorA, vectorB, metric);
  }

  /**
   * Find vectors most similar to a document
   */
  async findSimilarToDocument(
    documentId: string,
    options: VectorSearchOptions = {}
  ): Promise<{
    results: VectorSearchResult[];
    stats: VectorSearchStats;
  }> {
    // Get the document's vector
    const vector = await this.vectorStore.find(documentId);

    if (!vector) {
      throw new Error(`No vector found for document: ${documentId}`);
    }

    // Search for similar vectors
    return this.search(vector.vector, {
      ...options,
      includeSelf: false, // Exclude the document itself
    });
  }

  /**
   * Batch search for multiple query vectors
   */
  async batchSearch(
    queryVectors: number[][],
    options: VectorSearchOptions = {}
  ): Promise<
    Array<{
      results: VectorSearchResult[];
      stats: VectorSearchStats;
    }>
  > {
    const promises = queryVectors.map((qv) => this.search(qv, options));
    return Promise.all(promises);
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collection: string): Promise<{
    totalVectors: number;
    dimensions: number[];
    modelNames: string[];
    avgVectorSize: number;
  }> {
    const vectors = await this.vectorStore.getAllVectors(collection);

    const dimensions = [...new Set(vectors.map((v) => v.dimensions))];
    const modelNames = [
      ...new Set(
        vectors.map((v) => v.modelName).filter((m): m is string => !!m)
      ),
    ];

    const avgVectorSize =
      vectors.length > 0
        ? vectors.reduce((sum, v) => sum + v.dimensions * 4, 0) /
          vectors.length
        : 0;

    return {
      totalVectors: vectors.length,
      dimensions,
      modelNames,
      avgVectorSize,
    };
  }

  /**
   * Analyze query performance
   */
  async analyzePerformance(
    collection: string,
    sampleSize: number = 10
  ): Promise<{
    avgQueryTime: number;
    minQueryTime: number;
    maxQueryTime: number;
    vectorCount: number;
  }> {
    const vectors = await this.vectorStore.getAllVectors(collection);

    if (vectors.length === 0) {
      return {
        avgQueryTime: 0,
        minQueryTime: 0,
        maxQueryTime: 0,
        vectorCount: 0,
      };
    }

    // Take sample vectors for testing
    const samples = vectors.slice(0, Math.min(sampleSize, vectors.length));
    const queryTimes: number[] = [];

    for (const sample of samples) {
      const result = await this.search(sample.vector, {
        collection,
        limit: 10,
      });
      queryTimes.push(result.stats.queryTime);
    }

    return {
      avgQueryTime:
        queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length,
      minQueryTime: Math.min(...queryTimes),
      maxQueryTime: Math.max(...queryTimes),
      vectorCount: vectors.length,
    };
  }

  /**
   * Record search statistics
   */
  private async recordStats(
    collection: string,
    dimensions: number,
    metric: SimilarityMetric,
    k: number,
    searchTime: number,
    vectorsScanned: number,
    cacheHit: boolean
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO vector_search_stats (
          collection, query_vector_dims, similarity_metric,
          k_neighbors, search_time_ms, vectors_scanned, cache_hit, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        collection,
        dimensions,
        metric,
        k,
        searchTime,
        vectorsScanned,
        cacheHit ? 1 : 0,
        new Date().toISOString()
      )
      .run();
  }

  /**
   * Get search statistics for a collection
   */
  async getSearchStats(collection: string): Promise<{
    totalSearches: number;
    avgSearchTime: number;
    avgVectorsScanned: number;
    cacheHitRate: number;
  }> {
    const result = await this.db
      .prepare(
        `SELECT
          COUNT(*) as total_searches,
          AVG(search_time_ms) as avg_search_time,
          AVG(vectors_scanned) as avg_vectors_scanned,
          AVG(CASE WHEN cache_hit = 1 THEN 1.0 ELSE 0.0 END) as cache_hit_rate
        FROM vector_search_stats
        WHERE collection = ?`
      )
      .bind(collection)
      .first<{
        total_searches: number;
        avg_search_time: number;
        avg_vectors_scanned: number;
        cache_hit_rate: number;
      }>();

    return {
      totalSearches: result?.total_searches || 0,
      avgSearchTime: result?.avg_search_time || 0,
      avgVectorsScanned: result?.avg_vectors_scanned || 0,
      cacheHitRate: result?.cache_hit_rate || 0,
    };
  }
}
