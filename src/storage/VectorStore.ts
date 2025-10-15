/**
 * VectorStore - Manages vector storage and retrieval in D1
 *
 * Provides CRUD operations for vector embeddings with metadata support.
 * Supports dimensions up to 4096 and automatic normalization.
 */

import { D1Database } from '@cloudflare/workers-types';
import { generateId } from '../utils/id';

export interface Vector {
  id: string;
  documentId: string;
  collection: string;
  vector: number[];
  dimensions: number;
  normalized: boolean;
  modelName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface VectorInsertOptions {
  documentId: string;
  collection: string;
  vector: number[];
  modelName?: string;
  metadata?: Record<string, any>;
  normalized?: boolean;
}

export interface VectorUpdateOptions {
  vector?: number[];
  modelName?: string;
  metadata?: Record<string, any>;
  normalized?: boolean;
}

export interface VectorQueryOptions {
  collection?: string;
  modelName?: string;
  dimensions?: number;
  limit?: number;
  offset?: number;
}

/**
 * VectorStore class for managing vector embeddings
 */
export class VectorStore {
  constructor(private db: D1Database) {}

  /**
   * Insert a new vector
   */
  async insert(options: VectorInsertOptions): Promise<Vector> {
    const {
      documentId,
      collection,
      vector,
      modelName,
      metadata,
      normalized = false,
    } = options;

    // Validate vector
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Vector must be a non-empty array');
    }

    if (vector.length > 4096) {
      throw new Error('Vector dimensions cannot exceed 4096');
    }

    // Validate that all elements are numbers
    if (!vector.every((v) => typeof v === 'number' && !isNaN(v))) {
      throw new Error('All vector elements must be valid numbers');
    }

    // Generate ID
    const id = generateId();
    const dimensions = vector.length;
    const now = new Date().toISOString();

    // Convert vector to BLOB (Float32Array)
    const vectorBlob = this.vectorToBlob(vector);

    // Insert into database
    await this.db
      .prepare(
        `INSERT INTO vectors (
          id, document_id, collection, vector, dimensions,
          normalized, model_name, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        documentId,
        collection,
        vectorBlob,
        dimensions,
        normalized ? 1 : 0,
        modelName || null,
        metadata ? JSON.stringify(metadata) : null,
        now,
        now
      )
      .run();

    return {
      id,
      documentId,
      collection,
      vector,
      dimensions,
      normalized,
      modelName,
      metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Find a vector by document ID
   */
  async find(documentId: string): Promise<Vector | null> {
    const result = await this.db
      .prepare(
        `SELECT
          id, document_id, collection, vector, dimensions,
          normalized, model_name, metadata, created_at, updated_at
        FROM vectors
        WHERE document_id = ?
        LIMIT 1`
      )
      .bind(documentId)
      .first<{
        id: string;
        document_id: string;
        collection: string;
        vector: ArrayBuffer;
        dimensions: number;
        normalized: number;
        model_name: string | null;
        metadata: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!result) {
      return null;
    }

    return this.rowToVector(result);
  }

  /**
   * Find a vector by ID
   */
  async findById(id: string): Promise<Vector | null> {
    const result = await this.db
      .prepare(
        `SELECT
          id, document_id, collection, vector, dimensions,
          normalized, model_name, metadata, created_at, updated_at
        FROM vectors
        WHERE id = ?
        LIMIT 1`
      )
      .bind(id)
      .first<{
        id: string;
        document_id: string;
        collection: string;
        vector: ArrayBuffer;
        dimensions: number;
        normalized: number;
        model_name: string | null;
        metadata: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!result) {
      return null;
    }

    return this.rowToVector(result);
  }

  /**
   * Query vectors with filters
   */
  async query(options: VectorQueryOptions = {}): Promise<Vector[]> {
    const { collection, modelName, dimensions, limit = 100, offset = 0 } = options;

    let sql = `SELECT
      id, document_id, collection, vector, dimensions,
      normalized, model_name, metadata, created_at, updated_at
    FROM vectors
    WHERE 1=1`;

    const bindings: any[] = [];

    if (collection) {
      sql += ` AND collection = ?`;
      bindings.push(collection);
    }

    if (modelName) {
      sql += ` AND model_name = ?`;
      bindings.push(modelName);
    }

    if (dimensions) {
      sql += ` AND dimensions = ?`;
      bindings.push(dimensions);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await this.db
      .prepare(sql)
      .bind(...bindings)
      .all<{
        id: string;
        document_id: string;
        collection: string;
        vector: ArrayBuffer;
        dimensions: number;
        normalized: number;
        model_name: string | null;
        metadata: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!result.results) {
      return [];
    }

    return result.results.map((row) => this.rowToVector(row));
  }

  /**
   * Update a vector
   */
  async update(id: string, options: VectorUpdateOptions): Promise<Vector> {
    const { vector, modelName, metadata, normalized } = options;

    // Check if vector exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Vector with id ${id} not found`);
    }

    const updates: string[] = [];
    const bindings: any[] = [];

    if (vector !== undefined) {
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error('Vector must be a non-empty array');
      }

      if (vector.length > 4096) {
        throw new Error('Vector dimensions cannot exceed 4096');
      }

      if (!vector.every((v) => typeof v === 'number' && !isNaN(v))) {
        throw new Error('All vector elements must be valid numbers');
      }

      updates.push('vector = ?', 'dimensions = ?');
      bindings.push(this.vectorToBlob(vector), vector.length);
    }

    if (modelName !== undefined) {
      updates.push('model_name = ?');
      bindings.push(modelName || null);
    }

    if (metadata !== undefined) {
      updates.push('metadata = ?');
      bindings.push(metadata ? JSON.stringify(metadata) : null);
    }

    if (normalized !== undefined) {
      updates.push('normalized = ?');
      bindings.push(normalized ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    bindings.push(now);

    bindings.push(id);

    await this.db
      .prepare(
        `UPDATE vectors SET ${updates.join(', ')} WHERE id = ?`
      )
      .bind(...bindings)
      .run();

    // Fetch and return updated vector
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to fetch updated vector');
    }

    return updated;
  }

  /**
   * Update vector by document ID
   */
  async updateByDocumentId(
    documentId: string,
    options: VectorUpdateOptions
  ): Promise<Vector> {
    const existing = await this.find(documentId);
    if (!existing) {
      throw new Error(`Vector for document ${documentId} not found`);
    }

    return this.update(existing.id, options);
  }

  /**
   * Delete a vector by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM vectors WHERE id = ?')
      .bind(id)
      .run();

    return result.meta.changes > 0;
  }

  /**
   * Delete a vector by document ID
   */
  async deleteByDocumentId(documentId: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM vectors WHERE document_id = ?')
      .bind(documentId)
      .run();

    return result.meta.changes > 0;
  }

  /**
   * Delete all vectors in a collection
   */
  async deleteCollection(collection: string): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM vectors WHERE collection = ?')
      .bind(collection)
      .run();

    return result.meta.changes;
  }

  /**
   * Count vectors
   */
  async count(options: VectorQueryOptions = {}): Promise<number> {
    const { collection, modelName, dimensions } = options;

    let sql = 'SELECT COUNT(*) as count FROM vectors WHERE 1=1';
    const bindings: any[] = [];

    if (collection) {
      sql += ' AND collection = ?';
      bindings.push(collection);
    }

    if (modelName) {
      sql += ' AND model_name = ?';
      bindings.push(modelName);
    }

    if (dimensions) {
      sql += ' AND dimensions = ?';
      bindings.push(dimensions);
    }

    const result = await this.db
      .prepare(sql)
      .bind(...bindings)
      .first<{ count: number }>();

    return result?.count || 0;
  }

  /**
   * Get all vectors for a collection (for search operations)
   */
  async getAllVectors(collection: string): Promise<Vector[]> {
    const result = await this.db
      .prepare(
        `SELECT
          id, document_id, collection, vector, dimensions,
          normalized, model_name, metadata, created_at, updated_at
        FROM vectors
        WHERE collection = ?
        ORDER BY created_at DESC`
      )
      .bind(collection)
      .all<{
        id: string;
        document_id: string;
        collection: string;
        vector: ArrayBuffer;
        dimensions: number;
        normalized: number;
        model_name: string | null;
        metadata: string | null;
        created_at: string;
        updated_at: string;
      }>();

    if (!result.results) {
      return [];
    }

    return result.results.map((row) => this.rowToVector(row));
  }

  /**
   * Convert vector array to BLOB (Float32Array)
   */
  private vectorToBlob(vector: number[]): ArrayBuffer {
    const float32Array = new Float32Array(vector);
    return float32Array.buffer;
  }

  /**
   * Convert BLOB to vector array
   */
  private blobToVector(blob: ArrayBuffer): number[] {
    const float32Array = new Float32Array(blob);
    return Array.from(float32Array);
  }

  /**
   * Convert database row to Vector object
   */
  private rowToVector(row: {
    id: string;
    document_id: string;
    collection: string;
    vector: ArrayBuffer;
    dimensions: number;
    normalized: number;
    model_name: string | null;
    metadata: string | null;
    created_at: string;
    updated_at: string;
  }): Vector {
    return {
      id: row.id,
      documentId: row.document_id,
      collection: row.collection,
      vector: this.blobToVector(row.vector),
      dimensions: row.dimensions,
      normalized: row.normalized === 1,
      modelName: row.model_name || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
