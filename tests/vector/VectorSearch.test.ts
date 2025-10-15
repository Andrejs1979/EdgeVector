/**
 * Vector Search Engine Tests
 *
 * Tests for the VectorSearch engine including k-NN search,
 * filtering, and search options
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { VectorSearch } from '../../src/vector/VectorSearch';
import { normalizeVector } from '../../src/vector/utils';

// Mock dependencies
const mockDB = {
  prepare: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
} as any;

const mockEmbeddingGenerator = {
  generateEmbedding: vi.fn(),
  generateEmbeddingBatch: vi.fn(),
  compareSimilarity: vi.fn(),
} as any;

describe('VectorSearch', () => {
  let vectorSearch: VectorSearch;

  beforeEach(() => {
    vi.clearAllMocks();
    vectorSearch = new VectorSearch(mockDB, mockEmbeddingGenerator);
  });

  describe('searchByVector', () => {
    test('should find most similar vectors', async () => {
      const queryVector = normalizeVector([1, 0, 0]);

      // Mock database response with vectors
      const mockVectors = [
        {
          id: '1',
          documentId: 'doc1',
          collection: 'test',
          vector: new Uint8Array(normalizeVector([0.9, 0.1, 0]).map((v) => (v + 1) * 127.5)),
          dimensions: 3,
          modelName: 'test-model',
          normalized: true,
          metadata: { title: 'Similar' },
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          documentId: 'doc2',
          collection: 'test',
          vector: new Uint8Array(normalizeVector([0.1, 0.9, 0]).map((v) => (v + 1) * 127.5)),
          dimensions: 3,
          modelName: 'test-model',
          normalized: true,
          metadata: { title: 'Different' },
          createdAt: new Date().toISOString(),
        },
      ];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockVectors }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {
        limit: 2,
        metric: 'cosine',
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].score).toBeGreaterThan(result.results[1].score);
      expect(result.results[0].vector.metadata.title).toBe('Similar');
      expect(result.stats.totalVectors).toBe(2);
    });

    test('should respect limit parameter', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, { limit: 5 });

      expect(mockDB.prepare).toHaveBeenCalled();
      // Verify SQL contains LIMIT clause
    });

    test('should filter by collection', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {
        collection: 'test_collection',
      });

      expect(mockDB.prepare).toHaveBeenCalled();
      // Verify collection filter is applied
    });

    test('should filter by model name', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {
        modelName: 'bge-base-en-v1.5',
      });

      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should apply similarity threshold', async () => {
      const queryVector = normalizeVector([1, 0, 0]);

      const mockVectors = [
        {
          id: '1',
          documentId: 'doc1',
          collection: 'test',
          vector: new Uint8Array(normalizeVector([0.95, 0.05, 0]).map((v) => (v + 1) * 127.5)),
          dimensions: 3,
          modelName: 'test-model',
          normalized: true,
          metadata: {},
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          documentId: 'doc2',
          collection: 'test',
          vector: new Uint8Array(normalizeVector([0.3, 0.7, 0]).map((v) => (v + 1) * 127.5)),
          dimensions: 3,
          modelName: 'test-model',
          normalized: true,
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockVectors }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {
        threshold: 0.9,
        metric: 'cosine',
      });

      // Only the first vector should pass the threshold
      expect(result.results.length).toBeLessThanOrEqual(1);
      if (result.results.length > 0) {
        expect(result.results[0].score).toBeGreaterThanOrEqual(0.9);
      }
    });

    test('should validate vector dimensions', async () => {
      const invalidVector = [1, 2]; // 2D vector

      const mockVectors = [
        {
          id: '1',
          documentId: 'doc1',
          collection: 'test',
          vector: new Uint8Array([1, 2, 3, 4]),
          dimensions: 4,
          modelName: 'test-model',
          normalized: true,
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockVectors }),
      });

      await expect(
        vectorSearch.searchByVector(invalidVector, {})
      ).rejects.toThrow();
    });

    test('should handle empty database', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {});

      expect(result.results).toEqual([]);
      expect(result.stats.totalVectors).toBe(0);
    });

    test('should track search statistics', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {});

      expect(result.stats).toBeDefined();
      expect(result.stats.searchTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.totalVectors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('searchByText', () => {
    test('should generate embedding and search', async () => {
      const queryText = 'machine learning';
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockEmbeddingGenerator.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByText(queryText, {});

      expect(mockEmbeddingGenerator.generateEmbedding).toHaveBeenCalledWith(
        queryText,
        expect.any(Object)
      );
    });

    test('should pass options to vector search', async () => {
      const queryText = 'test query';
      const mockEmbedding = [1, 0, 0];

      mockEmbeddingGenerator.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByText(queryText, {
        collection: 'articles',
        limit: 5,
        threshold: 0.8,
      });

      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should handle embedding generation errors', async () => {
      const queryText = 'test query';

      mockEmbeddingGenerator.generateEmbedding.mockRejectedValue(
        new Error('Embedding generation failed')
      );

      await expect(
        vectorSearch.searchByText(queryText, {})
      ).rejects.toThrow('Embedding generation failed');
    });
  });

  describe('Similarity metrics', () => {
    test('should support cosine similarity', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {
        metric: 'cosine',
      });

      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should support euclidean distance', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {
        metric: 'euclidean',
      });

      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should support dot product', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {
        metric: 'dot',
      });

      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should support manhattan distance', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {
        metric: 'manhattan',
      });

      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should default to cosine metric', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {});

      expect(mockDB.prepare).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should handle large result sets efficiently', async () => {
      const queryVector = [1, 0, 0];

      // Create 1000 mock vectors
      const mockVectors = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        documentId: `doc${i}`,
        collection: 'test',
        vector: new Uint8Array([Math.random() * 255, Math.random() * 255, Math.random() * 255]),
        dimensions: 3,
        modelName: 'test-model',
        normalized: true,
        metadata: {},
        createdAt: new Date().toISOString(),
      }));

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockVectors }),
      });

      const startTime = Date.now();
      const result = await vectorSearch.searchByVector(queryVector, {
        limit: 10,
      });
      const endTime = Date.now();

      expect(result.results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });

    test('should track search time', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {});

      expect(result.stats.searchTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.searchTimeMs).toBeLessThan(10000); // Sanity check
    });
  });

  describe('Edge cases', () => {
    test('should handle metadata filtering', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await vectorSearch.searchByVector(queryVector, {
        metadata: { category: 'tech' },
      });

      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should handle zero limit gracefully', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {
        limit: 0,
      });

      expect(result.results).toEqual([]);
    });

    test('should handle negative threshold', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await expect(
        vectorSearch.searchByVector(queryVector, {
          threshold: -1,
        })
      ).rejects.toThrow();
    });

    test('should handle invalid metric', async () => {
      const queryVector = [1, 0, 0];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await expect(
        vectorSearch.searchByVector(queryVector, {
          metric: 'invalid' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('Result formatting', () => {
    test('should return properly formatted results', async () => {
      const queryVector = normalizeVector([1, 0, 0]);

      const mockVectors = [
        {
          id: '1',
          documentId: 'doc1',
          collection: 'test',
          vector: new Uint8Array(normalizeVector([1, 0, 0]).map((v) => (v + 1) * 127.5)),
          dimensions: 3,
          modelName: 'test-model',
          normalized: true,
          metadata: { title: 'Test' },
          createdAt: '2025-01-01T00:00:00Z',
        },
      ];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockVectors }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {});

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('stats');

      const firstResult = result.results[0];
      expect(firstResult).toHaveProperty('vector');
      expect(firstResult).toHaveProperty('score');
      expect(firstResult).toHaveProperty('distance');
      expect(firstResult.vector).toHaveProperty('id');
      expect(firstResult.vector).toHaveProperty('documentId');
      expect(firstResult.vector).toHaveProperty('collection');
      expect(firstResult.vector).toHaveProperty('metadata');
    });

    test('should include all vector metadata', async () => {
      const queryVector = [1, 0, 0];

      const mockVectors = [
        {
          id: '1',
          documentId: 'doc1',
          collection: 'articles',
          vector: new Uint8Array([127, 127, 127]),
          dimensions: 3,
          modelName: 'bge-base-en-v1.5',
          normalized: true,
          metadata: { category: 'tech', tags: ['ai', 'ml'] },
          createdAt: '2025-01-01T00:00:00Z',
        },
      ];

      mockDB.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockVectors }),
      });

      const result = await vectorSearch.searchByVector(queryVector, {});

      expect(result.results[0].vector.collection).toBe('articles');
      expect(result.results[0].vector.modelName).toBe('bge-base-en-v1.5');
      expect(result.results[0].vector.metadata).toEqual({
        category: 'tech',
        tags: ['ai', 'ml'],
      });
    });
  });
});
