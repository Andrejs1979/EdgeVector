/**
 * QueryTranslator - MongoDB to SQL Query Translation
 *
 * Translates MongoDB-style queries to SQL for D1/SQLite.
 * Uses indexed columns when available for performance,
 * falls back to JSON queries for non-indexed fields.
 */

import type { QueryFilter, QueryOptions, QueryOperator } from '../types/document';
import type { SQLQuery, SQLParts, FieldMapping } from '../types/query';

export class QueryTranslator {
  private indexedFields: Map<string, FieldMapping> = new Map();

  constructor(private collection: string) {}

  /**
   * Register indexed fields for this collection
   */
  registerIndexedFields(fields: FieldMapping[]): void {
    for (const field of fields) {
      const key = `${this.collection}:${field.fieldPath}`;
      this.indexedFields.set(key, field);
    }
  }

  /**
   * Translate MongoDB-style find query to SQL
   */
  async translate(filter: QueryFilter, options?: QueryOptions): Promise<SQLQuery> {
    const sqlParts: SQLParts = {
      select: ['*'],
      from: 'documents',
      where: ['_collection = ?', '_deleted = FALSE'],
      params: [this.collection],
      orderBy: [],
      limit: options?.limit,
      offset: options?.skip,
    };

    // Translate filter conditions
    const fieldsAccessed: string[] = [];
    for (const [field, condition] of Object.entries(filter)) {
      await this.translateFieldCondition(field, condition, sqlParts, fieldsAccessed);
    }

    // Apply sorting
    if (options?.sort) {
      for (const [field, direction] of Object.entries(options.sort)) {
        const mapping = this.getFieldMapping(field);
        if (mapping?.isIndexed) {
          sqlParts.orderBy.push(`${mapping.indexColumn} ${direction === 1 ? 'ASC' : 'DESC'}`);
        } else {
          // Sort by JSON extract
          sqlParts.orderBy.push(`json_extract(_data, '$.${field}') ${direction === 1 ? 'ASC' : 'DESC'}`);
        }
      }
    }

    // Build final SQL
    const sql = this.buildSQL(sqlParts);

    return {
      sql,
      params: sqlParts.params,
      usesIndexedFields: fieldsAccessed.some(f => this.isFieldIndexed(f)),
    };
  }

  /**
   * Translate a single field condition
   */
  private async translateFieldCondition(
    field: string,
    condition: unknown,
    sqlParts: SQLParts,
    fieldsAccessed: string[]
  ): Promise<void> {
    fieldsAccessed.push(field);

    // Handle logical operators
    if (field === '$and' || field === '$or') {
      await this.translateLogicalOperator(field, condition as QueryFilter[], sqlParts, fieldsAccessed);
      return;
    }

    if (field === '$not') {
      await this.translateNotOperator(condition as QueryFilter, sqlParts, fieldsAccessed);
      return;
    }

    const mapping = this.getFieldMapping(field);

    // Direct value comparison (implicit $eq)
    if (!this.isOperator(condition)) {
      this.addFieldCondition(field, mapping, '$eq', condition, sqlParts);
      return;
    }

    // Handle query operators
    const operators = condition as QueryOperator;
    for (const [op, value] of Object.entries(operators)) {
      this.addFieldCondition(field, mapping, op, value, sqlParts);
    }
  }

  /**
   * Add a field condition to the SQL query
   */
  private addFieldCondition(
    field: string,
    mapping: FieldMapping | null,
    operator: string,
    value: unknown,
    sqlParts: SQLParts
  ): void {
    if (mapping?.isIndexed) {
      // Use indexed column for performance
      this.addIndexedCondition(mapping, operator, value, sqlParts);
    } else {
      // Fall back to JSON query
      this.addJSONCondition(field, operator, value, sqlParts);
    }
  }

  /**
   * Add condition using indexed column
   */
  private addIndexedCondition(
    mapping: FieldMapping,
    operator: string,
    value: unknown,
    sqlParts: SQLParts
  ): void {
    const col = mapping.indexColumn;

    switch (operator) {
      case '$eq':
        sqlParts.where.push(`${col} = ?`);
        sqlParts.params.push(value);
        break;

      case '$ne':
        sqlParts.where.push(`${col} != ?`);
        sqlParts.params.push(value);
        break;

      case '$gt':
        sqlParts.where.push(`${col} > ?`);
        sqlParts.params.push(value);
        break;

      case '$gte':
        sqlParts.where.push(`${col} >= ?`);
        sqlParts.params.push(value);
        break;

      case '$lt':
        sqlParts.where.push(`${col} < ?`);
        sqlParts.params.push(value);
        break;

      case '$lte':
        sqlParts.where.push(`${col} <= ?`);
        sqlParts.params.push(value);
        break;

      case '$in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          sqlParts.where.push(`${col} IN (${placeholders})`);
          sqlParts.params.push(...value);
        }
        break;

      case '$nin':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          sqlParts.where.push(`${col} NOT IN (${placeholders})`);
          sqlParts.params.push(...value);
        }
        break;

      case '$exists':
        if (value) {
          sqlParts.where.push(`${col} IS NOT NULL`);
        } else {
          sqlParts.where.push(`${col} IS NULL`);
        }
        break;

      case '$regex':
        // SQLite uses LIKE for pattern matching
        sqlParts.where.push(`${col} LIKE ?`);
        // Convert regex to SQL LIKE pattern (basic conversion)
        const pattern = String(value).replace(/\.\*/g, '%').replace(/\./g, '_');
        sqlParts.params.push(pattern);
        break;

      default:
        console.warn(`Unsupported operator for indexed field: ${operator}`);
    }
  }

  /**
   * Add condition using JSON extraction
   */
  private addJSONCondition(
    field: string,
    operator: string,
    value: unknown,
    sqlParts: SQLParts
  ): void {
    const jsonPath = `$.${field}`;

    switch (operator) {
      case '$eq':
        sqlParts.where.push(`json_extract(_data, ?) = ?`);
        sqlParts.params.push(jsonPath, this.serializeValue(value));
        break;

      case '$ne':
        sqlParts.where.push(`json_extract(_data, ?) != ?`);
        sqlParts.params.push(jsonPath, this.serializeValue(value));
        break;

      case '$gt':
        sqlParts.where.push(`CAST(json_extract(_data, ?) AS REAL) > ?`);
        sqlParts.params.push(jsonPath, value);
        break;

      case '$gte':
        sqlParts.where.push(`CAST(json_extract(_data, ?) AS REAL) >= ?`);
        sqlParts.params.push(jsonPath, value);
        break;

      case '$lt':
        sqlParts.where.push(`CAST(json_extract(_data, ?) AS REAL) < ?`);
        sqlParts.params.push(jsonPath, value);
        break;

      case '$lte':
        sqlParts.where.push(`CAST(json_extract(_data, ?) AS REAL) <= ?`);
        sqlParts.params.push(jsonPath, value);
        break;

      case '$in':
        if (Array.isArray(value) && value.length > 0) {
          const conditions = value.map(() => `json_extract(_data, ?) = ?`).join(' OR ');
          sqlParts.where.push(`(${conditions})`);
          for (const v of value) {
            sqlParts.params.push(jsonPath, this.serializeValue(v));
          }
        }
        break;

      case '$nin':
        if (Array.isArray(value) && value.length > 0) {
          const conditions = value.map(() => `json_extract(_data, ?) != ?`).join(' AND ');
          sqlParts.where.push(`(${conditions})`);
          for (const v of value) {
            sqlParts.params.push(jsonPath, this.serializeValue(v));
          }
        }
        break;

      case '$regex':
        // SQLite uses LIKE for pattern matching
        sqlParts.where.push(`json_extract(_data, ?) LIKE ?`);
        // Convert regex to SQL LIKE pattern (basic conversion)
        const pattern = String(value).replace(/\.\*/g, '%').replace(/\./g, '_');
        sqlParts.params.push(jsonPath, pattern);
        break;

      case '$exists':
        if (value) {
          sqlParts.where.push(`json_extract(_data, ?) IS NOT NULL`);
          sqlParts.params.push(jsonPath);
        } else {
          sqlParts.where.push(`json_extract(_data, ?) IS NULL`);
          sqlParts.params.push(jsonPath);
        }
        break;

      default:
        console.warn(`Unsupported operator for JSON field: ${operator}`);
    }
  }

  /**
   * Handle $and / $or logical operators
   */
  private async translateLogicalOperator(
    operator: '$and' | '$or',
    conditions: QueryFilter[],
    sqlParts: SQLParts,
    fieldsAccessed: string[]
  ): Promise<void> {
    const subConditions: string[] = [];
    const tempParams: unknown[] = [];

    for (const condition of conditions) {
      const tempParts: SQLParts = {
        select: [],
        from: '',
        where: [],
        params: [],
        orderBy: [],
      };

      for (const [field, value] of Object.entries(condition)) {
        await this.translateFieldCondition(field, value, tempParts, fieldsAccessed);
      }

      if (tempParts.where.length > 0) {
        subConditions.push(`(${tempParts.where.join(' AND ')})`);
        tempParams.push(...tempParts.params);
      }
    }

    if (subConditions.length > 0) {
      const joinOperator = operator === '$and' ? ' AND ' : ' OR ';
      sqlParts.where.push(`(${subConditions.join(joinOperator)})`);
      sqlParts.params.push(...tempParams);
    }
  }

  /**
   * Handle $not operator
   */
  private async translateNotOperator(
    condition: QueryFilter,
    sqlParts: SQLParts,
    fieldsAccessed: string[]
  ): Promise<void> {
    const tempParts: SQLParts = {
      select: [],
      from: '',
      where: [],
      params: [],
      orderBy: [],
    };

    for (const [field, value] of Object.entries(condition)) {
      await this.translateFieldCondition(field, value, tempParts, fieldsAccessed);
    }

    if (tempParts.where.length > 0) {
      sqlParts.where.push(`NOT (${tempParts.where.join(' AND ')})`);
      sqlParts.params.push(...tempParts.params);
    }
  }

  /**
   * Build final SQL from parts
   */
  private buildSQL(parts: SQLParts): string {
    let sql = `SELECT ${parts.select.join(', ')} FROM ${parts.from}`;

    if (parts.where.length > 0) {
      sql += ` WHERE ${parts.where.join(' AND ')}`;
    }

    if (parts.orderBy.length > 0) {
      sql += ` ORDER BY ${parts.orderBy.join(', ')}`;
    }

    if (parts.limit !== undefined) {
      sql += ` LIMIT ${parts.limit}`;
    }

    if (parts.offset !== undefined) {
      sql += ` OFFSET ${parts.offset}`;
    }

    return sql;
  }

  /**
   * Get field mapping if indexed
   */
  private getFieldMapping(field: string): FieldMapping | null {
    const key = `${this.collection}:${field}`;
    return this.indexedFields.get(key) || null;
  }

  /**
   * Check if field is indexed
   */
  private isFieldIndexed(field: string): boolean {
    return this.getFieldMapping(field)?.isIndexed || false;
  }

  /**
   * Check if value is a query operator
   */
  private isOperator(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every(k => k.startsWith('$'));
  }

  /**
   * Serialize value for JSON comparison
   */
  private serializeValue(value: unknown): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return JSON.stringify(value);
  }
}
