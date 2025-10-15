/**
 * SchemaEvolutionManager - Dynamic Index Management
 *
 * Manages automatic field promotion from JSON to indexed columns
 * based on query patterns. This is the key to making schema-free
 * storage performant.
 */

import type { IndexInfo } from '../types/document';
import type { FieldMapping } from '../types/query';

export interface SchemaEvolutionConfig {
  promotionThreshold: number; // Number of queries before promoting field
  maxIndexedFields: number; // Maximum number of indexed fields per collection
}

export class SchemaEvolutionManager {
  private availableColumns: Set<string>;
  private indexRegistry: Map<string, FieldMapping> = new Map();

  constructor(
    private db: D1Database,
    private config: SchemaEvolutionConfig = {
      promotionThreshold: 100,
      maxIndexedFields: 20,
    }
  ) {
    // Initialize available index columns (_idx_field_1 through _idx_field_20)
    this.availableColumns = new Set(
      Array.from({ length: config.maxIndexedFields }, (_, i) => `_idx_field_${i + 1}`)
    );
  }

  /**
   * Load existing index mappings from database
   */
  async initialize(collection: string): Promise<void> {
    const result = await this.db
      .prepare(
        `SELECT collection, field_path, index_column, data_type, usage_count, last_used
         FROM index_registry
         WHERE collection = ?`
      )
      .bind(collection)
      .all();

    if (result.results) {
      for (const row of result.results) {
        const info = row as unknown as IndexInfo;
        const key = `${info.collection}:${info.fieldPath}`;

        this.indexRegistry.set(key, {
          fieldPath: info.fieldPath,
          indexColumn: info.indexColumn,
          dataType: info.dataType,
          isIndexed: true,
        });

        // Mark column as used
        this.availableColumns.delete(info.indexColumn);
      }
    }
  }

  /**
   * Get field mapping if exists
   */
  getFieldMapping(collection: string, fieldPath: string): FieldMapping | null {
    const key = `${collection}:${fieldPath}`;
    return this.indexRegistry.get(key) || null;
  }

  /**
   * Get all field mappings for a collection
   */
  getCollectionMappings(collection: string): FieldMapping[] {
    const mappings: FieldMapping[] = [];
    for (const [key, mapping] of this.indexRegistry.entries()) {
      if (key.startsWith(`${collection}:`)) {
        mappings.push(mapping);
      }
    }
    return mappings;
  }

  /**
   * Check if a field should be promoted to indexed column
   */
  async shouldPromoteField(collection: string, fieldPath: string): Promise<boolean> {
    // Already indexed?
    if (this.getFieldMapping(collection, fieldPath)) {
      return false;
    }

    // Check query count
    const result = await this.db
      .prepare(
        `SELECT query_count FROM query_patterns
         WHERE collection = ? AND field_path = ?`
      )
      .bind(collection, fieldPath)
      .first();

    if (!result) {
      return false;
    }

    const queryCount = (result as { query_count: number }).query_count;
    return queryCount >= this.config.promotionThreshold;
  }

  /**
   * Promote a field to an indexed column
   */
  async promoteField(
    collection: string,
    fieldPath: string,
    sampleValue: unknown
  ): Promise<boolean> {
    // Get available column
    const indexColumn = this.getAvailableColumn();
    if (!indexColumn) {
      console.warn(`No available index columns for ${collection}.${fieldPath}`);
      return false;
    }

    // Determine data type
    const dataType = this.inferDataType(sampleValue);

    // Register the mapping
    await this.db
      .prepare(
        `INSERT INTO index_registry (collection, field_path, index_column, data_type)
         VALUES (?, ?, ?, ?)`
      )
      .bind(collection, fieldPath, indexColumn, dataType)
      .run();

    // Create index
    await this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_${collection}_${indexColumn}
         ON documents(_collection, ${indexColumn})
         WHERE _collection = ?`
      )
      .bind(collection)
      .run();

    // Update in-memory registry
    const key = `${collection}:${fieldPath}`;
    this.indexRegistry.set(key, {
      fieldPath,
      indexColumn,
      dataType,
      isIndexed: true,
    });

    this.availableColumns.delete(indexColumn);

    // Backfill existing documents
    await this.backfillIndex(collection, fieldPath, indexColumn);

    console.log(`Promoted ${collection}.${fieldPath} to ${indexColumn} (${dataType})`);
    return true;
  }

  /**
   * Backfill index for existing documents
   */
  private async backfillIndex(
    collection: string,
    fieldPath: string,
    indexColumn: string
  ): Promise<void> {
    // Update existing documents in batches
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const docs = await this.db
        .prepare(
          `SELECT _id, _data FROM documents
           WHERE _collection = ? AND _deleted = FALSE
           LIMIT ? OFFSET ?`
        )
        .bind(collection, batchSize, offset)
        .all();

      if (!docs.results || docs.results.length === 0) {
        break;
      }

      for (const doc of docs.results) {
        const data = JSON.parse((doc as { _data: string })._data);
        const value = this.extractFieldValue(data, fieldPath);

        if (value !== undefined) {
          await this.db
            .prepare(
              `UPDATE documents SET ${indexColumn} = ?
               WHERE _id = ?`
            )
            .bind(value, (doc as { _id: string })._id)
            .run();
        }
      }

      offset += batchSize;

      // Prevent infinite loop
      if (docs.results.length < batchSize) {
        break;
      }
    }
  }

  /**
   * Analyze a document and track fields for potential indexing
   */
  async analyzeDocument(collection: string, document: Record<string, unknown>): Promise<void> {
    const fields = this.extractAllFields(document);

    for (const field of fields) {
      // Skip internal fields
      if (field.startsWith('_')) {
        continue;
      }

      // Check if field should be promoted
      if (await this.shouldPromoteField(collection, field)) {
        const value = this.extractFieldValue(document, field);
        await this.promoteField(collection, field, value);
      }
    }
  }

  /**
   * Update indexed column value when document is modified
   */
  async updateIndexedFields(
    collection: string,
    documentId: string,
    document: Record<string, unknown>
  ): Promise<void> {
    const mappings = this.getCollectionMappings(collection);

    if (mappings.length === 0) {
      return;
    }

    // Build update query
    const updates: string[] = [];
    const params: unknown[] = [];

    for (const mapping of mappings) {
      const value = this.extractFieldValue(document, mapping.fieldPath);
      updates.push(`${mapping.indexColumn} = ?`);
      params.push(value ?? null);
    }

    if (updates.length > 0) {
      await this.db
        .prepare(
          `UPDATE documents SET ${updates.join(', ')}
           WHERE _id = ?`
        )
        .bind(...params, documentId)
        .run();
    }
  }

  /**
   * Extract all field paths from a document (including nested)
   */
  private extractAllFields(obj: Record<string, unknown>, prefix = ''): string[] {
    const fields: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      fields.push(fieldPath);

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        fields.push(...this.extractAllFields(value as Record<string, unknown>, fieldPath));
      }
    }

    return fields;
  }

  /**
   * Extract field value from document (supports nested paths)
   */
  private extractFieldValue(obj: Record<string, unknown>, fieldPath: string): unknown {
    const parts = fieldPath.split('.');
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
   * Infer SQL data type from sample value
   */
  private inferDataType(value: unknown): 'TEXT' | 'REAL' | 'INTEGER' {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'REAL';
    }
    return 'TEXT';
  }

  /**
   * Get next available index column
   */
  private getAvailableColumn(): string | null {
    const available = Array.from(this.availableColumns);
    return available.length > 0 ? available[0] : null;
  }

  /**
   * Get index statistics for a collection
   */
  async getIndexStats(collection: string): Promise<{
    totalIndexed: number;
    availableSlots: number;
    indexedFields: Array<{ field: string; column: string; usageCount: number }>;
  }> {
    const result = await this.db
      .prepare(
        `SELECT field_path, index_column, usage_count
         FROM index_registry
         WHERE collection = ?
         ORDER BY usage_count DESC`
      )
      .bind(collection)
      .all();

    const indexedFields = (result.results || []).map((row) => {
      const r = row as { field_path: string; index_column: string; usage_count: number };
      return {
        field: r.field_path,
        column: r.index_column,
        usageCount: r.usage_count,
      };
    });

    return {
      totalIndexed: indexedFields.length,
      availableSlots: this.availableColumns.size,
      indexedFields,
    };
  }
}
