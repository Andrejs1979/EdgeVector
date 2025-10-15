/**
 * EdgeVector SDK Types
 *
 * Comprehensive type definitions for the EdgeVector DB JavaScript/TypeScript SDK
 */

// ============================================================================
// Client Configuration
// ============================================================================

export interface EdgeVectorConfig {
  /** Base URL of the EdgeVector DB instance (e.g., 'https://api.edgevector.com') */
  baseUrl: string;

  /** API key for authentication (if using API key auth) */
  apiKey?: string;

  /** JWT token for authentication (if using JWT auth) */
  token?: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Enable automatic retry on failure (default: true) */
  retry?: boolean;

  /** Maximum number of retries (default: 3) */
  maxRetries?: number;

  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  lastLogin?: string;
}

// ============================================================================
// Document Types
// ============================================================================

export type Document = Record<string, any>;

export interface InsertOneResult {
  _id: string;
  acknowledged: boolean;
}

export interface InsertManyResult {
  insertedIds: string[];
  insertedCount: number;
  acknowledged: boolean;
}

export interface FindOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

export interface FindResult<T = Document> {
  documents: T[];
  count: number;
}

export interface UpdateResult {
  matchedCount: number;
  modifiedCount: number;
  acknowledged: boolean;
}

export interface DeleteResult {
  deletedCount: number;
  acknowledged: boolean;
}

// ============================================================================
// Collection Types
// ============================================================================

export interface Collection {
  name: string;
  documentCount: number;
  createdAt: string;
  indexes?: string[];
}

export interface CreateCollectionResult {
  name: string;
  created: boolean;
}

// ============================================================================
// Vector Search Types
// ============================================================================

export type SimilarityMetric = 'cosine' | 'euclidean' | 'dot' | 'manhattan' | 'squared_euclidean' | 'cosine_distance';

export type EmbeddingModel = 'bge-small' | 'bge-base' | 'bge-large';

export interface VectorSearchOptions {
  /** Collection to search in */
  collection?: string;

  /** Maximum number of results (default: 10) */
  limit?: number;

  /** Similarity metric to use (default: 'cosine') */
  metric?: SimilarityMetric;

  /** Minimum similarity threshold (0-1) */
  threshold?: number;

  /** Filter results by metadata */
  metadata?: Record<string, any>;

  /** Filter by model name */
  modelName?: string;
}

export interface Vector {
  id: string;
  documentId: string;
  collection: string;
  dimensions: number;
  modelName: string;
  normalized: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface VectorSearchResult {
  vector: Vector;
  score: number;
  distance: number;
}

export interface VectorSearchResponse {
  results: VectorSearchResult[];
  stats: {
    totalVectors: number;
    searchTimeMs: number;
  };
}

export interface GenerateEmbeddingOptions {
  /** Embedding model to use (default: 'bge-base') */
  model?: EmbeddingModel;

  /** Whether to normalize the vector (default: true) */
  normalize?: boolean;

  /** Use cached embeddings if available (default: true) */
  useCache?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
  cached: boolean;
}

export interface CompareSimilarityOptions {
  /** Similarity metric to use (default: 'cosine') */
  metric?: SimilarityMetric;

  /** Embedding model to use (default: 'bge-base') */
  model?: EmbeddingModel;
}

export interface SimilarityResult {
  similarity: number;
  metric: string;
  text1: string;
  text2: string;
}

// ============================================================================
// Query Filter Types (MongoDB-style)
// ============================================================================

export type FilterValue = string | number | boolean | null | Date | FilterValue[];

export interface ComparisonOperators {
  $eq?: FilterValue;
  $ne?: FilterValue;
  $gt?: number | Date;
  $gte?: number | Date;
  $lt?: number | Date;
  $lte?: number | Date;
  $in?: FilterValue[];
  $nin?: FilterValue[];
}

export interface LogicalOperators {
  $and?: Filter[];
  $or?: Filter[];
  $not?: Filter;
}

export interface ElementOperators {
  $exists?: boolean;
  $type?: string;
}

export interface ArrayOperators {
  $all?: FilterValue[];
  $elemMatch?: Filter;
  $size?: number;
}

export interface StringOperators {
  $regex?: string;
  $options?: string;
}

export type FieldFilter =
  | FilterValue
  | ComparisonOperators
  | ElementOperators
  | ArrayOperators
  | StringOperators;

export type Filter =
  | { [key: string]: FieldFilter }
  | LogicalOperators;

// ============================================================================
// Update Types
// ============================================================================

export interface UpdateOperators {
  $set?: Record<string, any>;
  $unset?: Record<string, any>;
  $inc?: Record<string, number>;
  $mul?: Record<string, number>;
  $push?: Record<string, any>;
  $pull?: Record<string, any>;
  $addToSet?: Record<string, any>;
}

export type UpdateDocument = UpdateOperators | Record<string, any>;

// ============================================================================
// Error Types
// ============================================================================

export class EdgeVectorError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'EdgeVectorError';
  }
}

export class AuthenticationError extends EdgeVectorError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends EdgeVectorError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends EdgeVectorError {
  constructor(
    message: string,
    public retryAfter?: number,
    details?: any
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends EdgeVectorError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', 0, details);
    this.name = 'NetworkError';
  }
}

// ============================================================================
// GraphQL Response Types (Internal)
// ============================================================================

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: any;
  }>;
}

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: any;
}
