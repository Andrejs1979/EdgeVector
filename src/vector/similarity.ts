/**
 * Vector Similarity Metrics
 *
 * Implementations of common similarity and distance metrics
 * for vector search and comparison.
 */

import { validateDimensions } from './utils';

export type SimilarityMetric = 'cosine' | 'euclidean' | 'dot';

/**
 * Calculate dot product of two vectors
 * dot(a, b) = Σ(a[i] * b[i])
 *
 * Higher values indicate greater similarity.
 * Range: [-∞, +∞] (unbounded)
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

/**
 * Calculate cosine similarity between two vectors
 * cosine(a, b) = dot(a, b) / (||a|| * ||b||)
 *
 * Measures the cosine of the angle between vectors.
 * Higher values indicate greater similarity.
 * Range: [-1, 1] where 1 = identical direction, 0 = orthogonal, -1 = opposite
 *
 * Note: If vectors are normalized, cosine similarity = dot product
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let dotProd = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProd += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0; // Undefined for zero vectors, return 0
  }

  return dotProd / (normA * normB);
}

/**
 * Calculate Euclidean distance between two vectors
 * euclidean(a, b) = sqrt(Σ((a[i] - b[i])²))
 *
 * Measures the straight-line distance between vectors.
 * Lower values indicate greater similarity (0 = identical).
 * Range: [0, +∞]
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate squared Euclidean distance (faster, no sqrt)
 * Often sufficient for comparisons since sqrt is monotonic
 */
export function squaredEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return sum;
}

/**
 * Calculate Manhattan distance (L1 distance)
 * manhattan(a, b) = Σ|a[i] - b[i]|
 *
 * Lower values indicate greater similarity.
 * Range: [0, +∞]
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }

  return sum;
}

/**
 * Calculate cosine distance (1 - cosine similarity)
 * Converts similarity to distance metric.
 * Range: [0, 2] where 0 = identical, 1 = orthogonal, 2 = opposite
 */
export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

/**
 * Calculate similarity/distance using specified metric
 */
export function calculateSimilarity(
  a: number[],
  b: number[],
  metric: SimilarityMetric
): number {
  switch (metric) {
    case 'cosine':
      return cosineSimilarity(a, b);
    case 'euclidean':
      return euclideanDistance(a, b);
    case 'dot':
      return dotProduct(a, b);
    default:
      throw new Error(`Unknown similarity metric: ${metric}`);
  }
}

/**
 * Rank vectors by similarity to a query vector
 * Returns indices sorted by similarity (descending for cosine/dot, ascending for euclidean)
 */
export function rankBySimilarity(
  queryVector: number[],
  vectors: number[][],
  metric: SimilarityMetric
): number[] {
  validateDimensions(queryVector);

  // Calculate similarities for all vectors
  const similarities = vectors.map((vector, index) => ({
    index,
    score: calculateSimilarity(queryVector, vector, metric),
  }));

  // Sort based on metric type
  // Cosine and dot: higher is better (descending)
  // Euclidean: lower is better (ascending)
  if (metric === 'euclidean') {
    similarities.sort((a, b) => a.score - b.score);
  } else {
    similarities.sort((a, b) => b.score - a.score);
  }

  return similarities.map((s) => s.index);
}

/**
 * Find top-k most similar vectors
 */
export function topKSimilar(
  queryVector: number[],
  vectors: number[][],
  k: number,
  metric: SimilarityMetric
): Array<{ index: number; score: number; vector: number[] }> {
  validateDimensions(queryVector);

  if (k <= 0) {
    throw new Error('k must be positive');
  }

  if (k > vectors.length) {
    k = vectors.length;
  }

  // Calculate similarities
  const similarities = vectors.map((vector, index) => ({
    index,
    score: calculateSimilarity(queryVector, vector, metric),
    vector,
  }));

  // Sort and take top-k
  if (metric === 'euclidean') {
    similarities.sort((a, b) => a.score - b.score);
  } else {
    similarities.sort((a, b) => b.score - a.score);
  }

  return similarities.slice(0, k);
}

/**
 * Calculate similarity matrix for a batch of vectors
 * Returns an n×n matrix where result[i][j] is similarity(vectors[i], vectors[j])
 */
export function similarityMatrix(
  vectors: number[][],
  metric: SimilarityMetric
): number[][] {
  const n = vectors.length;
  const matrix: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        // Diagonal: perfect similarity
        matrix[i][j] = metric === 'euclidean' ? 0 : 1;
      } else {
        const sim = calculateSimilarity(vectors[i], vectors[j], metric);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // Symmetric
      }
    }
  }

  return matrix;
}

/**
 * Find nearest neighbors within a distance threshold
 */
export function neighborsWithinRadius(
  queryVector: number[],
  vectors: number[][],
  radius: number,
  metric: SimilarityMetric
): Array<{ index: number; score: number; vector: number[] }> {
  validateDimensions(queryVector);

  const results: Array<{ index: number; score: number; vector: number[] }> = [];

  for (let i = 0; i < vectors.length; i++) {
    const score = calculateSimilarity(queryVector, vectors[i], metric);

    // Check if within radius (depends on metric type)
    const withinRadius =
      metric === 'euclidean'
        ? score <= radius // Distance: lower is closer
        : score >= radius; // Similarity: higher is closer

    if (withinRadius) {
      results.push({
        index: i,
        score,
        vector: vectors[i],
      });
    }
  }

  // Sort results
  if (metric === 'euclidean') {
    results.sort((a, b) => a.score - b.score);
  } else {
    results.sort((a, b) => b.score - a.score);
  }

  return results;
}

/**
 * Calculate pairwise distances between two sets of vectors
 */
export function pairwiseDistances(
  vectorsA: number[][],
  vectorsB: number[][],
  metric: SimilarityMetric
): number[][] {
  const m = vectorsA.length;
  const n = vectorsB.length;
  const distances: number[][] = Array(m)
    .fill(0)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      distances[i][j] = calculateSimilarity(vectorsA[i], vectorsB[j], metric);
    }
  }

  return distances;
}

/**
 * Compute average similarity across all vector pairs
 */
export function averageSimilarity(
  vectors: number[][],
  metric: SimilarityMetric
): number {
  if (vectors.length < 2) {
    return metric === 'euclidean' ? 0 : 1; // Perfect similarity for single vector
  }

  let sum = 0;
  let count = 0;

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      sum += calculateSimilarity(vectors[i], vectors[j], metric);
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Find the most similar pair in a set of vectors
 */
export function mostSimilarPair(
  vectors: number[][],
  metric: SimilarityMetric
): {
  indexA: number;
  indexB: number;
  score: number;
} | null {
  if (vectors.length < 2) {
    return null;
  }

  let bestScore = metric === 'euclidean' ? Infinity : -Infinity;
  let bestPair = { indexA: 0, indexB: 1, score: bestScore };

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const score = calculateSimilarity(vectors[i], vectors[j], metric);

      const isBetter =
        metric === 'euclidean' ? score < bestScore : score > bestScore;

      if (isBetter) {
        bestScore = score;
        bestPair = { indexA: i, indexB: j, score };
      }
    }
  }

  return bestPair;
}

/**
 * Normalize similarity score to [0, 1] range
 * Useful for combining different metrics
 */
export function normalizeSimilarity(
  score: number,
  metric: SimilarityMetric,
  maxDistance?: number
): number {
  switch (metric) {
    case 'cosine':
      // Cosine is already in [-1, 1], map to [0, 1]
      return (score + 1) / 2;

    case 'dot':
      // Dot product is unbounded, need max value for normalization
      if (maxDistance === undefined) {
        throw new Error('maxDistance required for dot product normalization');
      }
      return Math.max(0, Math.min(1, score / maxDistance));

    case 'euclidean':
      // Euclidean distance: inverse relationship (0 = perfect, higher = worse)
      if (maxDistance === undefined) {
        throw new Error('maxDistance required for euclidean normalization');
      }
      return Math.max(0, 1 - score / maxDistance);

    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
}
