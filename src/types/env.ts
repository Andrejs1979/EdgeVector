/**
 * Environment bindings and types for EdgeVector DB
 */

export interface Env {
  // D1 Database binding
  DB: D1Database;

  // Durable Object bindings
  SHARD_MANAGER: DurableObjectNamespace;
  QUERY_PATTERN_ANALYZER: DurableObjectNamespace;
  SSE_MANAGER: DurableObjectNamespace;

  // KV Namespaces
  CACHE: KVNamespace;
  METADATA: KVNamespace;

  // R2 Bucket
  COLD_STORAGE: R2Bucket;

  // Workers AI
  AI: Ai;

  // Environment variables
  ENVIRONMENT: string;
  JWT_SECRET?: string;
}

export interface D1Result<T = unknown> {
  success: boolean;
  results: T[];
  meta: {
    duration: number;
    changes?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
    size_after?: number;
  };
}
