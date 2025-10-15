/**
 * Similarity Metrics Tests
 *
 * Tests for all similarity and distance metrics used in vector search
 */

import { describe, test, expect } from 'vitest';
import {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  manhattanDistance,
  squaredEuclideanDistance,
  cosineDistance,
} from '../../src/vector/similarity';

// Alias for consistency with test names
const dotProductSimilarity = dotProduct;

describe('Similarity Metrics', () => {
  describe('cosineSimilarity', () => {
    test('should return 1.0 for identical vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 3];

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    });

    test('should return 0.0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0);
    });

    test('should return -1.0 for opposite vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [-1, -2, -3];

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0);
    });

    test('should handle normalized vectors', () => {
      const v1 = [0.6, 0.8]; // normalized
      const v2 = [0.8, 0.6]; // normalized

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    test('should be symmetric', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(cosineSimilarity(v2, v1));
    });

    test('should handle zero vector', () => {
      const v1 = [0, 0, 0];
      const v2 = [1, 2, 3];

      expect(cosineSimilarity(v1, v2)).toBe(0);
    });

    test('should work with high-dimensional vectors', () => {
      const dim = 768;
      const v1 = new Array(dim).fill(0).map(() => Math.random());
      const v2 = new Array(dim).fill(0).map(() => Math.random());

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('euclideanDistance', () => {
    test('should return 0 for identical vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 3];

      expect(euclideanDistance(v1, v2)).toBeCloseTo(0);
    });

    test('should compute correct distance', () => {
      const v1 = [0, 0];
      const v2 = [3, 4];

      expect(euclideanDistance(v1, v2)).toBeCloseTo(5);
    });

    test('should be symmetric', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      expect(euclideanDistance(v1, v2)).toBeCloseTo(euclideanDistance(v2, v1));
    });

    test('should satisfy triangle inequality', () => {
      const v1 = [0, 0];
      const v2 = [1, 1];
      const v3 = [2, 0];

      const d12 = euclideanDistance(v1, v2);
      const d23 = euclideanDistance(v2, v3);
      const d13 = euclideanDistance(v1, v3);

      expect(d12 + d23).toBeGreaterThanOrEqual(d13 - 0.001); // small tolerance for floating point
    });

    test('should handle 3D vectors', () => {
      const v1 = [1, 2, 2];
      const v2 = [1, 2, 2];

      expect(euclideanDistance(v1, v2)).toBeCloseTo(0);
    });

    test('should work with high-dimensional vectors', () => {
      const dim = 1024;
      const v1 = new Array(dim).fill(0);
      const v2 = new Array(dim).fill(0);
      v2[0] = 1;

      expect(euclideanDistance(v1, v2)).toBeCloseTo(1);
    });
  });

  describe('dotProductSimilarity', () => {
    test('should compute dot product', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      expect(dotProductSimilarity(v1, v2)).toBe(32); // 1*4 + 2*5 + 3*6 = 32
    });

    test('should return 0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];

      expect(dotProductSimilarity(v1, v2)).toBeCloseTo(0);
    });

    test('should be symmetric', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      expect(dotProductSimilarity(v1, v2)).toBeCloseTo(dotProductSimilarity(v2, v1));
    });

    test('should handle negative values', () => {
      const v1 = [1, -1];
      const v2 = [-1, 1];

      expect(dotProductSimilarity(v1, v2)).toBe(-2);
    });

    test('should equal squared magnitude for identical vectors', () => {
      const v = [3, 4]; // magnitude = 5, squared = 25
      expect(dotProductSimilarity(v, v)).toBe(25);
    });
  });

  describe('manhattanDistance', () => {
    test('should return 0 for identical vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 3];

      expect(manhattanDistance(v1, v2)).toBe(0);
    });

    test('should compute L1 distance', () => {
      const v1 = [0, 0];
      const v2 = [3, 4];

      expect(manhattanDistance(v1, v2)).toBe(7); // |3| + |4| = 7
    });

    test('should be symmetric', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      expect(manhattanDistance(v1, v2)).toBe(manhattanDistance(v2, v1));
    });

    test('should handle negative values', () => {
      const v1 = [1, 2];
      const v2 = [-1, -2];

      expect(manhattanDistance(v1, v2)).toBe(6); // |1-(-1)| + |2-(-2)| = 2 + 4 = 6
    });

    test('should satisfy triangle inequality', () => {
      const v1 = [0, 0];
      const v2 = [1, 1];
      const v3 = [2, 0];

      const d12 = manhattanDistance(v1, v2);
      const d23 = manhattanDistance(v2, v3);
      const d13 = manhattanDistance(v1, v3);

      expect(d12 + d23).toBeGreaterThanOrEqual(d13);
    });
  });

  describe('squaredEuclideanDistance', () => {
    test('should return 0 for identical vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 3];

      expect(squaredEuclideanDistance(v1, v2)).toBeCloseTo(0);
    });

    test('should compute squared distance', () => {
      const v1 = [0, 0];
      const v2 = [3, 4];

      expect(squaredEuclideanDistance(v1, v2)).toBeCloseTo(25); // 3^2 + 4^2 = 25
    });

    test('should be square of euclidean distance', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      const euclidean = euclideanDistance(v1, v2);
      const squared = squaredEuclideanDistance(v1, v2);

      expect(squared).toBeCloseTo(euclidean * euclidean);
    });

    test('should be symmetric', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      expect(squaredEuclideanDistance(v1, v2)).toBeCloseTo(
        squaredEuclideanDistance(v2, v1)
      );
    });

    test('should be faster than euclidean (no sqrt)', () => {
      // Just verify it works without sqrt
      const v1 = [1, 2, 3, 4, 5];
      const v2 = [6, 7, 8, 9, 10];

      const squared = squaredEuclideanDistance(v1, v2);
      expect(squared).toBeGreaterThan(0);
    });
  });

  describe('cosineDistance', () => {
    test('should return 0 for identical vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 3];

      expect(cosineDistance(v1, v2)).toBeCloseTo(0);
    });

    test('should return 1 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];

      expect(cosineDistance(v1, v2)).toBeCloseTo(1.0);
    });

    test('should return 2 for opposite vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [-1, -2, -3];

      expect(cosineDistance(v1, v2)).toBeCloseTo(2.0);
    });

    test('should be 1 - cosine similarity', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      const similarity = cosineSimilarity(v1, v2);
      const distance = cosineDistance(v1, v2);

      expect(distance).toBeCloseTo(1 - similarity);
    });

    test('should be symmetric', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];

      expect(cosineDistance(v1, v2)).toBeCloseTo(cosineDistance(v2, v1));
    });
  });

  describe('Metric comparisons', () => {
    test('should rank same pairs similarly', () => {
      const query = [1, 0, 0];
      const v1 = [0.9, 0.1, 0]; // similar
      const v2 = [0.1, 0.9, 0]; // different

      // Cosine similarity: higher is better
      const cosine1 = cosineSimilarity(query, v1);
      const cosine2 = cosineSimilarity(query, v2);
      expect(cosine1).toBeGreaterThan(cosine2);

      // Euclidean distance: lower is better
      const euclidean1 = euclideanDistance(query, v1);
      const euclidean2 = euclideanDistance(query, v2);
      expect(euclidean1).toBeLessThan(euclidean2);

      // Manhattan distance: lower is better
      const manhattan1 = manhattanDistance(query, v1);
      const manhattan2 = manhattanDistance(query, v2);
      expect(manhattan1).toBeLessThan(manhattan2);
    });

    test('should handle normalized vectors', () => {
      const v1 = [1, 0]; // normalized
      const v2 = [0.707, 0.707]; // normalized, 45 degrees
      const v3 = [0, 1]; // normalized, 90 degrees

      // Cosine similarity should decrease with angle
      const cos12 = cosineSimilarity(v1, v2);
      const cos13 = cosineSimilarity(v1, v3);
      expect(cos12).toBeGreaterThan(cos13);

      // For normalized vectors, dot product equals cosine similarity
      const dot12 = dotProductSimilarity(v1, v2);
      expect(dot12).toBeCloseTo(cos12);
    });
  });

  describe('Edge cases', () => {
    test('should handle very small values', () => {
      const v1 = [0.0001, 0.0002, 0.0003];
      const v2 = [0.0001, 0.0002, 0.0003];

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
      expect(euclideanDistance(v1, v2)).toBeCloseTo(0);
    });

    test('should handle very large values', () => {
      const v1 = [1000, 2000, 3000];
      const v2 = [1000, 2000, 3000];

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
      expect(euclideanDistance(v1, v2)).toBeCloseTo(0);
    });

    test('should handle sparse vectors', () => {
      const v1 = new Array(100).fill(0);
      v1[0] = 1;
      const v2 = new Array(100).fill(0);
      v2[0] = 1;

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    });

    test('should handle dimension mismatch', () => {
      const v1 = [1, 2];
      const v2 = [1, 2, 3];

      expect(() => cosineSimilarity(v1, v2)).toThrow();
      expect(() => euclideanDistance(v1, v2)).toThrow();
      expect(() => manhattanDistance(v1, v2)).toThrow();
    });
  });

  describe('Performance characteristics', () => {
    test('should handle typical embedding dimensions', () => {
      // Test common embedding sizes
      const dimensions = [384, 768, 1024]; // BGE model dimensions

      dimensions.forEach((dim) => {
        const v1 = new Array(dim).fill(0).map(() => Math.random());
        const v2 = new Array(dim).fill(0).map(() => Math.random());

        // All metrics should complete quickly
        const cosine = cosineSimilarity(v1, v2);
        const euclidean = euclideanDistance(v1, v2);
        const manhattan = manhattanDistance(v1, v2);

        expect(cosine).toBeGreaterThanOrEqual(-1);
        expect(cosine).toBeLessThanOrEqual(1);
        expect(euclidean).toBeGreaterThanOrEqual(0);
        expect(manhattan).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle maximum supported dimensions', () => {
      const dim = 4096; // Maximum supported
      const v1 = new Array(dim).fill(0);
      const v2 = new Array(dim).fill(0);
      v1[0] = 1;
      v2[0] = 1;

      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
      expect(euclideanDistance(v1, v2)).toBeCloseTo(0);
    });
  });
});
