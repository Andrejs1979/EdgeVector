/**
 * EdgeVector DB JavaScript/TypeScript SDK
 *
 * Official SDK for interacting with EdgeVector DB
 *
 * @packageDocumentation
 */

// Main client
export { EdgeVectorClient } from './EdgeVectorClient';

// Sub-clients
export { AuthClient } from './clients/AuthClient';
export { CollectionClient } from './clients/CollectionClient';
export { DocumentClient } from './clients/DocumentClient';
export { VectorClient } from './clients/VectorClient';

// Types
export type {
  EdgeVectorConfig,
  RegisterInput,
  LoginInput,
  AuthResponse,
  User,
  Document,
  InsertOneResult,
  InsertManyResult,
  FindOptions,
  FindResult,
  UpdateResult,
  DeleteResult,
  Collection,
  CreateCollectionResult,
  SimilarityMetric,
  EmbeddingModel,
  VectorSearchOptions,
  Vector,
  VectorSearchResult,
  VectorSearchResponse,
  GenerateEmbeddingOptions,
  EmbeddingResult,
  CompareSimilarityOptions,
  SimilarityResult,
  Filter,
  FilterValue,
  ComparisonOperators,
  LogicalOperators,
  ElementOperators,
  ArrayOperators,
  StringOperators,
  FieldFilter,
  UpdateOperators,
  UpdateDocument,
  GraphQLResponse,
  GraphQLError,
} from './types';

// Error classes
export {
  EdgeVectorError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NetworkError,
} from './types';

// Default export
export { EdgeVectorClient as default } from './EdgeVectorClient';
