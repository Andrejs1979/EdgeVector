/**
 * Embedding Generation using Cloudflare Workers AI
 *
 * Provides text-to-vector embedding generation using Cloudflare's AI models.
 * Supports multiple BGE models with different dimension sizes and performance characteristics.
 */

import { Ai } from '@cloudflare/workers-types/experimental';
import { KVNamespace } from '@cloudflare/workers-types';
import { normalize, validateDimensions } from '../vector/utils';

export type EmbeddingModel =
  | '@cf/baai/bge-base-en-v1.5' // 768 dimensions - Default, balanced
  | '@cf/baai/bge-small-en-v1.5' // 384 dimensions - Faster, less accurate
  | '@cf/baai/bge-large-en-v1.5'; // 1024 dimensions - Slower, more accurate

export interface EmbeddingOptions {
  /**
   * Model to use for embedding generation
   * Default: '@cf/baai/bge-base-en-v1.5'
   */
  model?: EmbeddingModel;

  /**
   * Normalize the output vector (L2 norm)
   * Default: true
   */
  normalize?: boolean;

  /**
   * Use KV cache for this embedding
   * Default: true
   */
  useCache?: boolean;

  /**
   * Cache TTL in seconds
   * Default: 86400 (24 hours)
   */
  cacheTTL?: number;
}

export interface BatchEmbeddingOptions extends EmbeddingOptions {
  /**
   * Batch size for processing
   * Default: 10
   */
  batchSize?: number;

  /**
   * Delay between batches in ms to avoid rate limits
   * Default: 100
   */
  batchDelay?: number;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
  model: string;
  cached: boolean;
  processingTime: number;
}

/**
 * Get model dimensions
 */
function getModelDimensions(model: EmbeddingModel): number {
  switch (model) {
    case '@cf/baai/bge-small-en-v1.5':
      return 384;
    case '@cf/baai/bge-base-en-v1.5':
      return 768;
    case '@cf/baai/bge-large-en-v1.5':
      return 1024;
    default:
      throw new Error(`Unknown model: ${model}`);
  }
}

/**
 * Generate cache key for embedding
 */
function getCacheKey(text: string, model: EmbeddingModel): string {
  // Use simple hash for cache key
  const hash = simpleHash(text + model);
  return `embedding:${model}:${hash}`;
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * EmbeddingGenerator class
 */
export class EmbeddingGenerator {
  private defaultModel: EmbeddingModel = '@cf/baai/bge-base-en-v1.5';

  constructor(
    private ai: Ai,
    private kv?: KVNamespace
  ) {}

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    const startTime = Date.now();

    const {
      model = this.defaultModel,
      normalize: shouldNormalize = true,
      useCache = true,
      cacheTTL = 86400,
    } = options;

    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    if (text.length > 10000) {
      throw new Error('Text too long (max 10000 characters)');
    }

    // Check cache if enabled
    if (useCache && this.kv) {
      const cached = await this.getCachedEmbedding(text, model);
      if (cached) {
        console.log(`Cache hit for embedding: ${text.substring(0, 50)}...`);
        return cached;
      }
    }

    // Generate embedding using Workers AI
    const result = await this.ai.run(model, {
      text,
    });

    // Extract embedding from result
    let embedding: number[];

    if (Array.isArray(result.data)) {
      // Handle array format
      if (Array.isArray(result.data[0])) {
        embedding = result.data[0]; // Batch format [[...]]
      } else {
        embedding = result.data; // Single format [...]
      }
    } else {
      throw new Error('Unexpected embedding format from Workers AI');
    }

    // Validate dimensions
    const expectedDimensions = getModelDimensions(model);
    validateDimensions(embedding, expectedDimensions);

    // Normalize if requested
    if (shouldNormalize) {
      embedding = normalize(embedding);
    }

    // Cache the result
    if (useCache && this.kv) {
      await this.cacheEmbedding(text, model, embedding, cacheTTL);
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `Generated embedding in ${processingTime}ms (${embedding.length} dims)`
    );

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatch(
    texts: string[],
    options: BatchEmbeddingOptions = {}
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const {
      batchSize = 10,
      batchDelay = 100,
      ...embeddingOptions
    } = options;

    const results: number[][] = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Generate embeddings for batch
      const batchResults = await Promise.all(
        batch.map((text) => this.generateEmbedding(text, embeddingOptions))
      );

      results.push(...batchResults);

      // Delay between batches if not the last batch
      if (i + batchSize < texts.length && batchDelay > 0) {
        await this.delay(batchDelay);
      }
    }

    return results;
  }

  /**
   * Generate embedding with caching
   */
  async generateWithCache(
    text: string,
    model?: EmbeddingModel
  ): Promise<number[]> {
    return this.generateEmbedding(text, {
      model,
      useCache: true,
    });
  }

  /**
   * Generate embedding result with metadata
   */
  async generateEmbeddingResult(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    // Check cache
    let cached = false;
    let embedding: number[];

    if (options.useCache !== false && this.kv) {
      const cachedEmbedding = await this.getCachedEmbedding(text, model);
      if (cachedEmbedding) {
        cached = true;
        embedding = cachedEmbedding;
      } else {
        embedding = await this.generateEmbedding(text, options);
      }
    } else {
      embedding = await this.generateEmbedding(text, options);
    }

    const processingTime = Date.now() - startTime;

    return {
      text,
      embedding,
      dimensions: embedding.length,
      model,
      cached,
      processingTime,
    };
  }

  /**
   * Get cached embedding
   */
  private async getCachedEmbedding(
    text: string,
    model: EmbeddingModel
  ): Promise<number[] | null> {
    if (!this.kv) return null;

    try {
      const cacheKey = getCacheKey(text, model);
      const cached = await this.kv.get(cacheKey, 'json');

      if (cached && Array.isArray(cached)) {
        return cached as number[];
      }

      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Cache an embedding
   */
  private async cacheEmbedding(
    text: string,
    model: EmbeddingModel,
    embedding: number[],
    ttl: number
  ): Promise<void> {
    if (!this.kv) return;

    try {
      const cacheKey = getCacheKey(text, model);
      await this.kv.put(cacheKey, JSON.stringify(embedding), {
        expirationTtl: Math.max(ttl, 60), // Minimum 60 seconds for KV
      });
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  /**
   * Clear cache for a specific text
   */
  async clearCache(text: string, model?: EmbeddingModel): Promise<void> {
    if (!this.kv) return;

    const modelToUse = model || this.defaultModel;
    const cacheKey = getCacheKey(text, modelToUse);

    try {
      await this.kv.delete(cacheKey);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Clear all embedding cache
   * Note: KV doesn't support wildcard delete, so this is a best-effort cleanup
   */
  async clearAllCache(): Promise<void> {
    // KV doesn't support wildcard operations
    // This would require maintaining a list of keys or using a different approach
    console.warn(
      'clearAllCache is not implemented - KV does not support wildcard deletes'
    );
  }

  /**
   * Compare two texts by their embeddings
   */
  async compareSimilarity(
    textA: string,
    textB: string,
    options: EmbeddingOptions = {}
  ): Promise<number> {
    const [embeddingA, embeddingB] = await Promise.all([
      this.generateEmbedding(textA, options),
      this.generateEmbedding(textB, options),
    ]);

    // Calculate cosine similarity (since vectors are normalized)
    let dotProduct = 0;
    for (let i = 0; i < embeddingA.length; i++) {
      dotProduct += embeddingA[i] * embeddingB[i];
    }

    return dotProduct;
  }

  /**
   * Find most similar text from a list
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    options: EmbeddingOptions = {}
  ): Promise<{
    text: string;
    similarity: number;
    index: number;
  }> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query, options);

    // Generate candidate embeddings
    const candidateEmbeddings = await this.generateBatch(candidates, options);

    // Find most similar
    let maxSimilarity = -Infinity;
    let maxIndex = 0;

    for (let i = 0; i < candidateEmbeddings.length; i++) {
      let similarity = 0;
      for (let j = 0; j < queryEmbedding.length; j++) {
        similarity += queryEmbedding[j] * candidateEmbeddings[i][j];
      }

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxIndex = i;
      }
    }

    return {
      text: candidates[maxIndex],
      similarity: maxSimilarity,
      index: maxIndex,
    };
  }

  /**
   * Get model information
   */
  getModelInfo(model?: EmbeddingModel): {
    name: string;
    dimensions: number;
    description: string;
  } {
    const modelToUse = model || this.defaultModel;

    switch (modelToUse) {
      case '@cf/baai/bge-small-en-v1.5':
        return {
          name: modelToUse,
          dimensions: 384,
          description: 'Small model - Faster generation, lower accuracy',
        };
      case '@cf/baai/bge-base-en-v1.5':
        return {
          name: modelToUse,
          dimensions: 768,
          description: 'Base model - Balanced speed and accuracy (default)',
        };
      case '@cf/baai/bge-large-en-v1.5':
        return {
          name: modelToUse,
          dimensions: 1024,
          description: 'Large model - Slower generation, higher accuracy',
        };
      default:
        throw new Error(`Unknown model: ${modelToUse}`);
    }
  }

  /**
   * Get supported models
   */
  getSupportedModels(): Array<{
    name: EmbeddingModel;
    dimensions: number;
    description: string;
  }> {
    return [
      {
        name: '@cf/baai/bge-small-en-v1.5',
        dimensions: 384,
        description: 'Small model - Faster generation, lower accuracy',
      },
      {
        name: '@cf/baai/bge-base-en-v1.5',
        dimensions: 768,
        description: 'Base model - Balanced speed and accuracy (default)',
      },
      {
        name: '@cf/baai/bge-large-en-v1.5',
        dimensions: 1024,
        description: 'Large model - Slower generation, higher accuracy',
      },
    ];
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
