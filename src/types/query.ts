/**
 * Query translation types
 * For converting MongoDB-style queries to SQL
 */

export interface SQLQuery {
  sql: string;
  params: unknown[];
  usesIndexedFields: boolean;
}

export interface SQLParts {
  select: string[];
  from: string;
  where: string[];
  params: unknown[];
  orderBy: string[];
  limit?: number;
  offset?: number;
}

export interface FieldMapping {
  fieldPath: string;
  indexColumn: string;
  dataType: 'TEXT' | 'REAL' | 'INTEGER';
  isIndexed: boolean;
}

export interface QueryAnalysis {
  collection: string;
  fieldsAccessed: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  usesIndexes: boolean;
  recommendedIndexes: string[];
}
