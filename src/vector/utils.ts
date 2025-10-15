/**
 * Vector Utilities
 *
 * Helper functions for vector operations including normalization,
 * validation, format conversion, and batch operations.
 */

/**
 * Validate vector dimensions
 */
export function validateDimensions(
  vector: number[],
  expectedDimensions?: number,
  maxDimensions: number = 4096
): void {
  if (!Array.isArray(vector)) {
    throw new Error('Vector must be an array');
  }

  if (vector.length === 0) {
    throw new Error('Vector cannot be empty');
  }

  if (vector.length > maxDimensions) {
    throw new Error(
      `Vector dimensions (${vector.length}) exceed maximum (${maxDimensions})`
    );
  }

  if (expectedDimensions !== undefined && vector.length !== expectedDimensions) {
    throw new Error(
      `Vector dimensions (${vector.length}) do not match expected (${expectedDimensions})`
    );
  }

  // Validate all elements are valid numbers
  for (let i = 0; i < vector.length; i++) {
    if (typeof vector[i] !== 'number' || isNaN(vector[i])) {
      throw new Error(`Invalid number at index ${i}: ${vector[i]}`);
    }

    if (!isFinite(vector[i])) {
      throw new Error(`Infinite value at index ${i}`);
    }
  }
}

/**
 * Calculate L2 norm (Euclidean length) of a vector
 */
export function l2Norm(vector: number[]): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (L2 normalization)
 * Returns a new normalized vector
 */
export function normalize(vector: number[]): number[] {
  validateDimensions(vector);

  const norm = l2Norm(vector);

  if (norm === 0) {
    throw new Error('Cannot normalize zero vector');
  }

  return vector.map((v) => v / norm);
}

/**
 * Check if a vector is normalized (L2 norm ≈ 1)
 */
export function isNormalized(vector: number[], tolerance: number = 1e-6): boolean {
  const norm = l2Norm(vector);
  return Math.abs(norm - 1.0) < tolerance;
}

/**
 * Convert vector array to Float32 BLOB
 */
export function vectorToBlob(vector: number[]): ArrayBuffer {
  validateDimensions(vector);
  const float32Array = new Float32Array(vector);
  return float32Array.buffer;
}

/**
 * Convert BLOB to vector array
 */
export function blobToVector(blob: ArrayBuffer): number[] {
  const float32Array = new Float32Array(blob);
  return Array.from(float32Array);
}

/**
 * Convert vector to base64 string (for transport)
 */
export function vectorToBase64(vector: number[]): string {
  const blob = vectorToBlob(vector);
  const uint8Array = new Uint8Array(blob);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to vector
 */
export function base64ToVector(base64: string): number[] {
  const binary = atob(base64);
  const uint8Array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8Array[i] = binary.charCodeAt(i);
  }
  return blobToVector(uint8Array.buffer);
}

/**
 * Batch normalize vectors
 */
export function batchNormalize(vectors: number[][]): number[][] {
  return vectors.map((v) => normalize(v));
}

/**
 * Validate that all vectors have the same dimensions
 */
export function validateBatchDimensions(vectors: number[][]): number {
  if (vectors.length === 0) {
    throw new Error('Batch cannot be empty');
  }

  const dimensions = vectors[0].length;

  for (let i = 1; i < vectors.length; i++) {
    if (vectors[i].length !== dimensions) {
      throw new Error(
        `Dimension mismatch: vector at index ${i} has ${vectors[i].length} dimensions, expected ${dimensions}`
      );
    }
  }

  return dimensions;
}

/**
 * Convert batch of vectors to BLOBs
 */
export function batchVectorToBlob(vectors: number[][]): ArrayBuffer[] {
  return vectors.map((v) => vectorToBlob(v));
}

/**
 * Convert batch of BLOBs to vectors
 */
export function batchBlobToVector(blobs: ArrayBuffer[]): number[][] {
  return blobs.map((b) => blobToVector(b));
}

/**
 * Create a zero vector of specified dimensions
 */
export function zeros(dimensions: number): number[] {
  return new Array(dimensions).fill(0);
}

/**
 * Create a random vector (for testing)
 */
export function randomVector(dimensions: number, normalized: boolean = false): number[] {
  const vector = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    vector[i] = Math.random() * 2 - 1; // Range: [-1, 1]
  }
  return normalized ? normalize(vector) : vector;
}

/**
 * Add two vectors element-wise
 */
export function add(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  return a.map((val, i) => val + b[i]);
}

/**
 * Subtract two vectors element-wise (a - b)
 */
export function subtract(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  return a.map((val, i) => val - b[i]);
}

/**
 * Multiply vector by scalar
 */
export function scale(vector: number[], scalar: number): number[] {
  return vector.map((v) => v * scalar);
}

/**
 * Calculate mean vector from batch
 */
export function mean(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error('Cannot calculate mean of empty batch');
  }

  const dimensions = validateBatchDimensions(vectors);
  const result = zeros(dimensions);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      result[i] += vector[i];
    }
  }

  return scale(result, 1 / vectors.length);
}

/**
 * Quantize vector to reduce storage (Float32 → Uint8)
 * Maps values from [-1, 1] to [0, 255]
 */
export function quantizeVector(vector: number[]): Uint8Array {
  validateDimensions(vector);
  const quantized = new Uint8Array(vector.length);

  for (let i = 0; i < vector.length; i++) {
    // Clamp to [-1, 1] and map to [0, 255]
    const clamped = Math.max(-1, Math.min(1, vector[i]));
    quantized[i] = Math.round((clamped + 1) * 127.5);
  }

  return quantized;
}

/**
 * Dequantize vector (Uint8 → Float32)
 * Maps values from [0, 255] to [-1, 1]
 */
export function dequantizeVector(quantized: Uint8Array): number[] {
  const vector = new Array(quantized.length);

  for (let i = 0; i < quantized.length; i++) {
    vector[i] = (quantized[i] / 127.5) - 1;
  }

  return vector;
}

/**
 * Calculate storage size of a vector in bytes
 */
export function vectorSizeBytes(dimensions: number, quantized: boolean = false): number {
  return quantized ? dimensions : dimensions * 4; // Uint8 vs Float32
}

/**
 * Calculate storage savings from quantization
 */
export function quantizationSavings(dimensions: number): {
  originalBytes: number;
  quantizedBytes: number;
  savingsBytes: number;
  savingsPercent: number;
} {
  const originalBytes = vectorSizeBytes(dimensions, false);
  const quantizedBytes = vectorSizeBytes(dimensions, true);
  const savingsBytes = originalBytes - quantizedBytes;
  const savingsPercent = (savingsBytes / originalBytes) * 100;

  return {
    originalBytes,
    quantizedBytes,
    savingsBytes,
    savingsPercent,
  };
}

/**
 * Pretty print vector (for debugging)
 */
export function formatVector(
  vector: number[],
  maxElements: number = 5,
  precision: number = 4
): string {
  if (vector.length <= maxElements) {
    return `[${vector.map((v) => v.toFixed(precision)).join(', ')}]`;
  }

  const shown = vector.slice(0, maxElements);
  const shownStr = shown.map((v) => v.toFixed(precision)).join(', ');
  return `[${shownStr}, ... (${vector.length} dims)]`;
}

/**
 * Calculate the centroid of multiple vectors
 */
export function centroid(vectors: number[][]): number[] {
  return mean(vectors);
}

/**
 * Check if two vectors are equal within tolerance
 */
export function vectorsEqual(
  a: number[],
  b: number[],
  tolerance: number = 1e-6
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tolerance) {
      return false;
    }
  }

  return true;
}
