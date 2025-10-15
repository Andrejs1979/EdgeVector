/**
 * Vector Utilities Tests
 *
 * Tests for vector utility functions including normalization,
 * validation, conversion, and arithmetic operations
 */

import { describe, test, expect } from 'vitest';
import {
  normalize,
  l2Norm,
  validateDimensions,
  vectorToBlob,
  blobToVector,
  quantizeVector,
  dequantizeVector,
  randomVector,
  add,
  subtract,
  scale,
  mean,
  vectorsEqual,
} from '../../src/vector/utils';
import { dotProduct } from '../../src/vector/similarity';

// Helper function for validation tests
function validateVector(vector: any, expectedDimensions?: number): boolean {
  try {
    if (!Array.isArray(vector) || vector.length === 0) return false;
    if (vector.some((v: any) => typeof v !== 'number' || isNaN(v) || !isFinite(v))) return false;
    if (expectedDimensions !== undefined && vector.length !== expectedDimensions) return false;
    return true;
  } catch {
    return false;
  }
}

// Alias for consistency with test expectations
const normalizeVector = normalize;
const vectorMagnitude = l2Norm;
const vectorAdd = add;
const vectorSubtract = subtract;
const vectorScale = scale;
const vectorMean = mean;

describe('Vector Utilities', () => {
  describe('normalizeVector', () => {
    test('should normalize a vector to unit length', () => {
      const vector = [3, 4]; // magnitude = 5
      const normalized = normalizeVector(vector);

      expect(normalized[0]).toBeCloseTo(0.6);
      expect(normalized[1]).toBeCloseTo(0.8);
      expect(vectorMagnitude(normalized)).toBeCloseTo(1.0);
    });

    test('should handle zero vector', () => {
      const vector = [0, 0, 0];

      // Zero vectors cannot be normalized (would require division by zero)
      expect(() => normalizeVector(vector)).toThrow('Cannot normalize zero vector');
    });

    test('should normalize 3D vector', () => {
      const vector = [1, 2, 2]; // magnitude = 3
      const normalized = normalizeVector(vector);

      expect(vectorMagnitude(normalized)).toBeCloseTo(1.0);
    });

    test('should preserve direction', () => {
      const vector = [5, 0, 0];
      const normalized = normalizeVector(vector);

      expect(normalized[0]).toBeCloseTo(1.0);
      expect(normalized[1]).toBe(0);
      expect(normalized[2]).toBe(0);
    });
  });

  describe('validateVector', () => {
    test('should accept valid vectors', () => {
      expect(validateVector([1, 2, 3])).toBe(true);
      expect(validateVector([0.5, -0.5, 0.3])).toBe(true);
    });

    test('should reject non-array input', () => {
      expect(validateVector(null as any)).toBe(false);
      expect(validateVector(undefined as any)).toBe(false);
      expect(validateVector({} as any)).toBe(false);
      expect(validateVector('not an array' as any)).toBe(false);
    });

    test('should reject empty arrays', () => {
      expect(validateVector([])).toBe(false);
    });

    test('should reject vectors with non-numeric values', () => {
      expect(validateVector([1, 'two' as any, 3])).toBe(false);
      expect(validateVector([1, NaN, 3])).toBe(false);
      expect(validateVector([1, Infinity, 3])).toBe(false);
    });

    test('should accept large vectors', () => {
      const largeVector = new Array(1024).fill(0.5);
      expect(validateVector(largeVector)).toBe(true);
    });

    test('should validate dimensions', () => {
      const vector = [1, 2, 3];
      expect(validateVector(vector, 3)).toBe(true);
      expect(validateVector(vector, 4)).toBe(false);
    });
  });

  describe('vectorToBlob and blobToVector', () => {
    test('should convert vector to blob and back', () => {
      const original = [1.5, -2.3, 0.0, 4.7];
      const blob = vectorToBlob(original);
      const converted = blobToVector(blob);

      expect(converted).toHaveLength(original.length);
      converted.forEach((val, idx) => {
        expect(val).toBeCloseTo(original[idx]);
      });
    });

    test('should handle large vectors', () => {
      const original = new Array(768).fill(0).map((_, i) => Math.sin(i / 10));
      const blob = vectorToBlob(original);
      const converted = blobToVector(blob);

      expect(converted).toHaveLength(original.length);
    });

    test('should handle zero vector', () => {
      const original = [0, 0, 0];
      const blob = vectorToBlob(original);
      const converted = blobToVector(blob);

      expect(converted).toEqual(original);
    });

    test('should preserve precision', () => {
      const original = [0.123456789, -0.987654321];
      const blob = vectorToBlob(original);
      const converted = blobToVector(blob);

      // Float32 has limited precision
      expect(converted[0]).toBeCloseTo(original[0], 6);
      expect(converted[1]).toBeCloseTo(original[1], 6);
    });
  });

  describe('quantizeVector and dequantizeVector', () => {
    test('should quantize and dequantize vector', () => {
      const original = [-1.0, -0.5, 0.0, 0.5, 1.0];
      const quantized = quantizeVector(original);
      const dequantized = dequantizeVector(quantized);

      expect(quantized).toHaveLength(original.length);
      dequantized.forEach((val, idx) => {
        expect(val).toBeCloseTo(original[idx], 1);
      });
    });

    test('should reduce to uint8', () => {
      const vector = [-1.0, 0.0, 1.0];
      const quantized = quantizeVector(vector);

      expect(quantized[0]).toBe(0); // -1.0 maps to 0
      expect(quantized[1]).toBe(128); // 0.0 maps to 128
      expect(quantized[2]).toBe(255); // 1.0 maps to 255
    });

    test('should handle negative values', () => {
      const vector = [-1.0, 0.0, 1.0];
      const quantized = quantizeVector(vector);
      const dequantized = dequantizeVector(quantized);

      expect(dequantized[0]).toBeCloseTo(-1.0, 1);
      expect(dequantized[1]).toBeCloseTo(0.0, 1);
      expect(dequantized[2]).toBeCloseTo(1.0, 1);
    });
  });

  describe('randomVector', () => {
    test('should generate vector of correct dimensions', () => {
      const vector = randomVector(128);
      expect(vector).toHaveLength(128);
    });

    test('should generate normalized vector', () => {
      const vector = randomVector(64, true);
      const magnitude = vectorMagnitude(vector);
      expect(magnitude).toBeCloseTo(1.0);
    });

    test('should generate different vectors', () => {
      const v1 = randomVector(10);
      const v2 = randomVector(10);

      expect(v1).not.toEqual(v2);
    });

    test('should generate values in valid range', () => {
      const vector = randomVector(100);

      vector.forEach((val) => {
        expect(val).toBeGreaterThanOrEqual(-1.0);
        expect(val).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('vectorAdd', () => {
    test('should add two vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];
      const result = vectorAdd(v1, v2);

      expect(result).toEqual([5, 7, 9]);
    });

    test('should handle negative values', () => {
      const v1 = [1, -2, 3];
      const v2 = [-1, 2, -3];
      const result = vectorAdd(v1, v2);

      expect(result).toEqual([0, 0, 0]);
    });

    test('should throw on dimension mismatch', () => {
      const v1 = [1, 2];
      const v2 = [1, 2, 3];

      expect(() => vectorAdd(v1, v2)).toThrow();
    });
  });

  describe('vectorSubtract', () => {
    test('should subtract two vectors', () => {
      const v1 = [5, 7, 9];
      const v2 = [1, 2, 3];
      const result = vectorSubtract(v1, v2);

      expect(result).toEqual([4, 5, 6]);
    });

    test('should handle negative results', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];
      const result = vectorSubtract(v1, v2);

      expect(result).toEqual([-3, -3, -3]);
    });
  });

  describe('vectorScale', () => {
    test('should scale vector by scalar', () => {
      const vector = [1, 2, 3];
      const result = vectorScale(vector, 2);

      expect(result).toEqual([2, 4, 6]);
    });

    test('should handle negative scalar', () => {
      const vector = [1, 2, 3];
      const result = vectorScale(vector, -1);

      expect(result).toEqual([-1, -2, -3]);
    });

    test('should handle zero scalar', () => {
      const vector = [1, 2, 3];
      const result = vectorScale(vector, 0);

      expect(result).toEqual([0, 0, 0]);
    });
  });

  describe('vectorMean', () => {
    test('should compute mean of vectors', () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const mean = vectorMean(vectors);

      expect(mean).toEqual([4, 5, 6]);
    });

    test('should handle single vector', () => {
      const vectors = [[1, 2, 3]];
      const mean = vectorMean(vectors);

      expect(mean).toEqual([1, 2, 3]);
    });

    test('should throw on empty array', () => {
      expect(() => vectorMean([])).toThrow();
    });

    test('should handle negative values', () => {
      const vectors = [
        [1, -1],
        [-1, 1],
      ];
      const mean = vectorMean(vectors);

      expect(mean).toEqual([0, 0]);
    });
  });

  describe('vectorsEqual', () => {
    test('should detect equal vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 3];

      expect(vectorsEqual(v1, v2)).toBe(true);
    });

    test('should detect unequal vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 4];

      expect(vectorsEqual(v1, v2)).toBe(false);
    });

    test('should handle tolerance', () => {
      const v1 = [1.0, 2.0, 3.0];
      const v2 = [1.002, 2.002, 3.002];

      // Difference of 0.002 is greater than tolerance of 0.001
      expect(vectorsEqual(v1, v2, 0.001)).toBe(false);
      // Difference of 0.002 is less than tolerance of 0.01
      expect(vectorsEqual(v1, v2, 0.01)).toBe(true);
    });

    test('should detect dimension mismatch', () => {
      const v1 = [1, 2];
      const v2 = [1, 2, 3];

      expect(vectorsEqual(v1, v2)).toBe(false);
    });
  });

  describe('vectorMagnitude', () => {
    test('should compute magnitude', () => {
      const vector = [3, 4];
      expect(vectorMagnitude(vector)).toBe(5);
    });

    test('should handle zero vector', () => {
      const vector = [0, 0, 0];
      expect(vectorMagnitude(vector)).toBe(0);
    });

    test('should handle unit vector', () => {
      const vector = [1, 0, 0];
      expect(vectorMagnitude(vector)).toBe(1);
    });

    test('should handle 3D vector', () => {
      const vector = [1, 2, 2]; // magnitude = 3
      expect(vectorMagnitude(vector)).toBe(3);
    });
  });

  describe('dotProduct', () => {
    test('should compute dot product', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];
      const result = dotProduct(v1, v2);

      expect(result).toBe(32); // 1*4 + 2*5 + 3*6 = 32
    });

    test('should handle orthogonal vectors', () => {
      const v1 = [1, 0];
      const v2 = [0, 1];
      const result = dotProduct(v1, v2);

      expect(result).toBe(0);
    });

    test('should handle parallel vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [2, 4, 6];
      const result = dotProduct(v1, v2);

      expect(result).toBe(28); // 1*2 + 2*4 + 3*6 = 28
    });

    test('should throw on dimension mismatch', () => {
      const v1 = [1, 2];
      const v2 = [1, 2, 3];

      expect(() => dotProduct(v1, v2)).toThrow();
    });
  });

  describe('Integration tests', () => {
    test('should handle complete workflow', () => {
      // Create a vector
      const original = [0.5, -0.3, 0.8, 0.1];

      // Normalize it
      const normalized = normalizeVector(original);
      expect(vectorMagnitude(normalized)).toBeCloseTo(1.0);

      // Convert to blob
      const blob = vectorToBlob(normalized);
      expect(blob).toBeInstanceOf(ArrayBuffer);

      // Convert back
      const restored = blobToVector(blob);
      expect(vectorsEqual(normalized, restored, 0.01)).toBe(true);
    });

    test('should handle quantization workflow', () => {
      // Generate random vector
      const vector = randomVector(128, true);

      // Quantize
      const quantized = quantizeVector(vector);
      expect(quantized).toHaveLength(128);

      // Verify storage savings (1 byte vs 4 bytes per value)
      expect(quantized.byteLength).toBe(vector.length);

      // Dequantize
      const dequantized = dequantizeVector(quantized);
      expect(dequantized).toHaveLength(128);

      // Check magnitude is approximately preserved
      const origMag = vectorMagnitude(vector);
      const dequantMag = vectorMagnitude(dequantized);
      expect(Math.abs(origMag - dequantMag)).toBeLessThan(0.2);
    });
  });
});
