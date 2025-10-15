/**
 * Document types for EdgeVector DB
 * MongoDB-like document operations with schema-free storage
 */

export interface Document {
  _id?: string;
  [key: string]: unknown;
}

export interface DocumentMetadata {
  _id: string;
  _collection: string;
  _version: number;
  _created_at: string;
  _updated_at: string;
  _deleted: boolean;
}

export interface StoredDocument extends DocumentMetadata {
  _data: string; // JSON-serialized document
  _vector?: Uint8Array;
  _vector_dims?: number;
  _search_text?: string;
  _partition_key?: string;
  _shard_key?: string;
}

// MongoDB-like query operators
export interface QueryFilter {
  [key: string]: QueryValue | QueryOperator;
}

export type QueryValue = string | number | boolean | null | Date | QueryValue[];

export interface QueryOperator {
  $eq?: QueryValue;
  $ne?: QueryValue;
  $gt?: QueryValue;
  $gte?: QueryValue;
  $lt?: QueryValue;
  $lte?: QueryValue;
  $in?: QueryValue[];
  $nin?: QueryValue[];
  $exists?: boolean;
  $regex?: string;
  $options?: string;
  $and?: QueryFilter[];
  $or?: QueryFilter[];
  $not?: QueryFilter;
}

// Update operators
export interface UpdateOperator {
  $set?: Record<string, unknown>;
  $unset?: Record<string, ''>;
  $inc?: Record<string, number>;
  $push?: Record<string, unknown>;
  $pull?: Record<string, unknown>;
  $addToSet?: Record<string, unknown>;
}

// Query options
export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  projection?: Record<string, 0 | 1>;
}

// Index information
export interface IndexInfo {
  collection: string;
  fieldPath: string;
  indexColumn: string;
  dataType: 'TEXT' | 'REAL' | 'INTEGER';
  usageCount: number;
  lastUsed: string;
}

// Insert result
export interface InsertResult {
  _id: string;
  acknowledged: boolean;
}

// Update result
export interface UpdateResult {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
}

// Delete result
export interface DeleteResult {
  acknowledged: boolean;
  deletedCount: number;
}

// Find result
export interface FindResult<T = Document> {
  documents: T[];
  count: number;
}
