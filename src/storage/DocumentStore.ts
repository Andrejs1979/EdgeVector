/**
 * DocumentStore - MongoDB-like Document Operations
 *
 * Provides CRUD operations for schema-free document storage
 * with automatic query optimization and index management.
 */

import { QueryTranslator } from './QueryTranslator';
import { SchemaEvolutionManager } from './SchemaEvolutionManager';
import type {
  Document,
  QueryFilter,
  QueryOptions,
  UpdateOperator,
  InsertResult,
  UpdateResult,
  DeleteResult,
  FindResult,
} from '../types/document';

export class DocumentStore {
  private queryTranslator: QueryTranslator;
  private schemaManager: SchemaEvolutionManager;

  constructor(
    private db: D1Database,
    private collection: string
  ) {
    this.queryTranslator = new QueryTranslator(collection);
    this.schemaManager = new SchemaEvolutionManager(db);
  }

  /**
   * Initialize the store (load index mappings)
   */
  async initialize(): Promise<void> {
    await this.schemaManager.initialize(this.collection);

    // Register indexed fields with query translator
    const mappings = this.schemaManager.getCollectionMappings(this.collection);
    this.queryTranslator.registerIndexedFields(mappings);
  }

  /**
   * Insert a document
   */
  async insertOne(document: Document): Promise<InsertResult> {
    const docId = document._id || this.generateId();
    const now = new Date().toISOString();

    // Prepare document data
    const docData = { ...document };
    delete docData._id;

    // Get indexed field values
    const indexedValues = await this.extractIndexedFieldValues(docData);

    // Build insert query
    const columns = ['_id', '_collection', '_data', '_created_at', '_updated_at'];
    const placeholders = ['?', '?', '?', '?', '?'];
    const values: unknown[] = [docId, this.collection, JSON.stringify(docData), now, now];

    // Add indexed field values
    for (const [column, value] of Object.entries(indexedValues)) {
      columns.push(column);
      placeholders.push('?');
      values.push(value);
    }

    // Insert document
    await this.db
      .prepare(
        `INSERT INTO documents (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})`
      )
      .bind(...values)
      .run();

    // Analyze document for schema evolution
    await this.schemaManager.analyzeDocument(this.collection, docData);

    // Update collection metadata
    await this.updateCollectionMetadata(1, JSON.stringify(docData).length);

    return {
      _id: docId,
      acknowledged: true,
    };
  }

  /**
   * Insert multiple documents
   */
  async insertMany(documents: Document[]): Promise<InsertResult[]> {
    const results: InsertResult[] = [];

    for (const doc of documents) {
      const result = await this.insertOne(doc);
      results.push(result);
    }

    return results;
  }

  /**
   * Find documents matching a query
   */
  async find<T = Document>(filter: QueryFilter = {}, options?: QueryOptions): Promise<FindResult<T>> {
    // Translate query
    const { sql, params } = await this.queryTranslator.translate(filter, options);

    // Execute query
    const result = await this.db.prepare(sql).bind(...params).all();

    // Parse documents
    const documents: T[] = [];
    if (result.results) {
      for (const row of result.results) {
        const stored = row as { _id: string; _data: string };
        const data = JSON.parse(stored._data);
        documents.push({ _id: stored._id, ...data } as T);
      }
    }

    // Track query patterns for all fields accessed
    await this.trackQueryPattern(filter, documents.length);

    return {
      documents,
      count: documents.length,
    };
  }

  /**
   * Find a single document
   */
  async findOne<T = Document>(filter: QueryFilter = {}): Promise<T | null> {
    const result = await this.find<T>(filter, { limit: 1 });
    return result.documents[0] || null;
  }

  /**
   * Count documents matching a query
   */
  async count(filter: QueryFilter = {}): Promise<number> {
    // Translate query (using count instead of *)
    const { sql, params } = await this.queryTranslator.translate(filter);

    // Replace SELECT * with SELECT COUNT(*)
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)');

    const result = await this.db.prepare(countSql).bind(...params).first();

    return (result as { 'COUNT(*)': number })['COUNT(*)'] || 0;
  }

  /**
   * Update documents matching a query
   */
  async updateMany(filter: QueryFilter, update: UpdateOperator): Promise<UpdateResult> {
    // Find matching documents
    const matches = await this.find(filter);

    if (matches.documents.length === 0) {
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    let modifiedCount = 0;

    for (const doc of matches.documents) {
      // Apply update operators
      const updatedDoc = this.applyUpdate(doc, update);

      // Update document
      const now = new Date().toISOString();
      const indexedValues = await this.extractIndexedFieldValues(updatedDoc);

      // Build update query
      const setClauses = ['_data = ?', '_updated_at = ?', '_version = _version + 1'];
      const updateValues: unknown[] = [JSON.stringify(updatedDoc), now];

      // Add indexed field updates
      for (const [column, value] of Object.entries(indexedValues)) {
        setClauses.push(`${column} = ?`);
        updateValues.push(value);
      }

      await this.db
        .prepare(
          `UPDATE documents SET ${setClauses.join(', ')}
           WHERE _id = ?`
        )
        .bind(...updateValues, doc._id)
        .run();

      modifiedCount++;
    }

    return {
      acknowledged: true,
      matchedCount: matches.documents.length,
      modifiedCount,
    };
  }

  /**
   * Update a single document
   */
  async updateOne(filter: QueryFilter, update: UpdateOperator): Promise<UpdateResult> {
    const doc = await this.findOne(filter);

    if (!doc) {
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    // Apply update
    const updatedDoc = this.applyUpdate(doc, update);

    // Update document
    const now = new Date().toISOString();
    const indexedValues = await this.extractIndexedFieldValues(updatedDoc);

    const setClauses = ['_data = ?', '_updated_at = ?', '_version = _version + 1'];
    const updateValues: unknown[] = [JSON.stringify(updatedDoc), now];

    for (const [column, value] of Object.entries(indexedValues)) {
      setClauses.push(`${column} = ?`);
      updateValues.push(value);
    }

    await this.db
      .prepare(
        `UPDATE documents SET ${setClauses.join(', ')}
         WHERE _id = ?`
      )
      .bind(...updateValues, doc._id)
      .run();

    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
    };
  }

  /**
   * Delete documents matching a query
   */
  async deleteMany(filter: QueryFilter): Promise<DeleteResult> {
    // Soft delete: mark as deleted
    const matches = await this.find(filter);

    if (matches.documents.length === 0) {
      return {
        acknowledged: true,
        deletedCount: 0,
      };
    }

    const ids = matches.documents.map(d => d._id);
    const placeholders = ids.map(() => '?').join(', ');

    await this.db
      .prepare(
        `UPDATE documents SET _deleted = TRUE, _updated_at = ?
         WHERE _id IN (${placeholders})`
      )
      .bind(new Date().toISOString(), ...ids)
      .run();

    // Update collection metadata
    await this.updateCollectionMetadata(-matches.documents.length, 0);

    return {
      acknowledged: true,
      deletedCount: matches.documents.length,
    };
  }

  /**
   * Delete a single document
   */
  async deleteOne(filter: QueryFilter): Promise<DeleteResult> {
    const doc = await this.findOne(filter);

    if (!doc) {
      return {
        acknowledged: true,
        deletedCount: 0,
      };
    }

    await this.db
      .prepare(
        `UPDATE documents SET _deleted = TRUE, _updated_at = ?
         WHERE _id = ?`
      )
      .bind(new Date().toISOString(), doc._id)
      .run();

    await this.updateCollectionMetadata(-1, 0);

    return {
      acknowledged: true,
      deletedCount: 1,
    };
  }

  /**
   * Apply update operators to a document
   */
  private applyUpdate(doc: Document, update: UpdateOperator): Document {
    const result = { ...doc };

    // $set operator
    if (update.$set) {
      for (const [key, value] of Object.entries(update.$set)) {
        this.setNestedValue(result, key, value);
      }
    }

    // $unset operator
    if (update.$unset) {
      for (const key of Object.keys(update.$unset)) {
        this.deleteNestedValue(result, key);
      }
    }

    // $inc operator
    if (update.$inc) {
      for (const [key, value] of Object.entries(update.$inc)) {
        const current = this.getNestedValue(result, key);
        const newValue = (typeof current === 'number' ? current : 0) + value;
        this.setNestedValue(result, key, newValue);
      }
    }

    return result;
  }

  /**
   * Extract indexed field values from document
   */
  private async extractIndexedFieldValues(doc: Record<string, unknown>): Promise<Record<string, unknown>> {
    const mappings = this.schemaManager.getCollectionMappings(this.collection);
    const values: Record<string, unknown> = {};

    for (const mapping of mappings) {
      const value = this.getNestedValue(doc, mapping.fieldPath);
      if (value !== undefined) {
        values[mapping.indexColumn] = value;
      }
    }

    return values;
  }

  /**
   * Track query pattern for analysis
   */
  private async trackQueryPattern(filter: QueryFilter, resultCount: number): Promise<void> {
    const fields = this.extractFieldsFromFilter(filter);

    for (const field of fields) {
      // Skip internal fields
      if (field.startsWith('_')) continue;

      // Update or insert query pattern
      await this.db
        .prepare(
          `INSERT INTO query_patterns (collection, field_path, query_count, avg_result_count, last_queried)
           VALUES (?, ?, 1, ?, ?)
           ON CONFLICT(collection, field_path) DO UPDATE SET
             query_count = query_count + 1,
             avg_result_count = (avg_result_count + ?) / 2,
             last_queried = ?`
        )
        .bind(this.collection, field, resultCount, new Date().toISOString(), resultCount, new Date().toISOString())
        .run();
    }
  }

  /**
   * Extract all fields from a query filter
   */
  private extractFieldsFromFilter(filter: QueryFilter): string[] {
    const fields: string[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and' || key === '$or') {
        if (Array.isArray(value)) {
          for (const subFilter of value) {
            fields.push(...this.extractFieldsFromFilter(subFilter as unknown as QueryFilter));
          }
        }
      } else if (key === '$not' && typeof value === 'object' && value !== null) {
        fields.push(...this.extractFieldsFromFilter(value as unknown as QueryFilter));
      } else if (!key.startsWith('$')) {
        fields.push(key);
      }
    }

    return fields;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let value: unknown = obj;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Delete nested value from object
   */
  private deleteNestedValue(obj: Record<string, unknown>, path: string): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        return;
      }
      current = current[part] as Record<string, unknown>;
    }

    delete current[parts[parts.length - 1]];
  }

  /**
   * Update collection metadata
   */
  private async updateCollectionMetadata(docCountDelta: number, sizeDelta: number): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO collections (id, collection_name, document_count, total_size_bytes, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(collection_name) DO UPDATE SET
           document_count = document_count + ?,
           total_size_bytes = total_size_bytes + ?,
           updated_at = ?`
      )
      .bind(
        this.collection,
        this.collection,
        docCountDelta,
        sizeDelta,
        new Date().toISOString(),
        docCountDelta,
        sizeDelta,
        new Date().toISOString()
      )
      .run();
  }

  /**
   * Generate a document ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get schema evolution statistics
   */
  async getSchemaStats() {
    return this.schemaManager.getIndexStats(this.collection);
  }
}
