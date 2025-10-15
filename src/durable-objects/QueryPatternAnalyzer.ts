/**
 * QueryPatternAnalyzer Durable Object
 * Tracks query patterns and suggests indexes for optimization
 */

import { Env } from '../types/env';

export interface QueryPattern {
  collection: string;
  fieldPath: string;
  queryCount: number;
  lastQueried: number;
  avgResultCount: number;
  isIndexed: boolean;
}

export interface IndexSuggestion {
  collection: string;
  fieldPath: string;
  reason: string;
  queryCount: number;
  estimatedImpact: 'high' | 'medium' | 'low';
}

export class QueryPatternAnalyzer implements DurableObject {
  private state: DurableObjectState;
  private _env: Env;
  private patterns: Map<string, QueryPattern>;
  private readonly INDEX_THRESHOLD = 100; // Suggest index after 100 queries

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this._env = env;
    this.patterns = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Load patterns on first request
    if (this.patterns.size === 0) {
      await this.loadPatterns();
    }

    switch (path) {
      case '/pattern/track':
        return this.handleTrackQuery(request);

      case '/pattern/analyze':
        return this.handleAnalyze(request);

      case '/pattern/suggestions':
        return this.handleGetSuggestions();

      case '/pattern/stats':
        return this.handleGetStats(request);

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  }

  private async loadPatterns(): Promise<void> {
    const patternsData = await this.state.storage.get<QueryPattern[]>('patterns');
    if (patternsData) {
      patternsData.forEach(pattern => {
        const key = this.getPatternKey(pattern.collection, pattern.fieldPath);
        this.patterns.set(key, pattern);
      });
    }
  }

  private async savePatterns(): Promise<void> {
    const patternsArray = Array.from(this.patterns.values());
    await this.state.storage.put('patterns', patternsArray);
  }

  private async handleTrackQuery(request: Request): Promise<Response> {
    const body = await request.json() as any;

    // Track each field used in the query
    for (const field of body.fields) {
      const key = this.getPatternKey(body.collection, field);
      const pattern = this.patterns.get(key);

      if (pattern) {
        // Update existing pattern
        pattern.queryCount++;
        pattern.lastQueried = Date.now();
        pattern.avgResultCount = (pattern.avgResultCount + body.resultCount) / 2;
        pattern.isIndexed = body.isIndexed || pattern.isIndexed;
      } else {
        // Create new pattern
        this.patterns.set(key, {
          collection: body.collection,
          fieldPath: field,
          queryCount: 1,
          lastQueried: Date.now(),
          avgResultCount: body.resultCount,
          isIndexed: body.isIndexed || false,
        });
      }
    }

    await this.savePatterns();

    return new Response(JSON.stringify({
      success: true,
      tracked: body.fields.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleAnalyze(request: Request): Promise<Response> {
    const body = await request.json() as any;

    const key = this.getPatternKey(body.collection, body.fieldPath);
    const pattern = this.patterns.get(key);

    if (!pattern) {
      return new Response(JSON.stringify({
        success: true,
        pattern: null,
        shouldIndex: false,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const shouldIndex = !pattern.isIndexed && pattern.queryCount >= this.INDEX_THRESHOLD;

    return new Response(JSON.stringify({
      success: true,
      pattern,
      shouldIndex,
      recommendation: this.generateRecommendation(pattern),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleGetSuggestions(): Promise<Response> {
    const suggestions: IndexSuggestion[] = [];

    for (const pattern of this.patterns.values()) {
      if (!pattern.isIndexed && pattern.queryCount >= this.INDEX_THRESHOLD) {
        suggestions.push({
          collection: pattern.collection,
          fieldPath: pattern.fieldPath,
          reason: `Field queried ${pattern.queryCount} times without index`,
          queryCount: pattern.queryCount,
          estimatedImpact: this.estimateImpact(pattern),
        });
      }
    }

    // Sort by estimated impact and query count
    suggestions.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const impactDiff = impactOrder[b.estimatedImpact] - impactOrder[a.estimatedImpact];
      return impactDiff !== 0 ? impactDiff : b.queryCount - a.queryCount;
    });

    return new Response(JSON.stringify({
      success: true,
      suggestions,
      count: suggestions.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleGetStats(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const collection = url.searchParams.get('collection');

    let stats;
    if (collection) {
      const collectionPatterns = Array.from(this.patterns.values()).filter(
        p => p.collection === collection
      );

      stats = {
        collection,
        totalQueries: collectionPatterns.reduce((sum, p) => sum + p.queryCount, 0),
        fieldsTracked: collectionPatterns.length,
        indexedFields: collectionPatterns.filter(p => p.isIndexed).length,
        unindexedFields: collectionPatterns.filter(p => !p.isIndexed).length,
        hotFields: collectionPatterns
          .filter(p => p.queryCount > this.INDEX_THRESHOLD)
          .sort((a, b) => b.queryCount - a.queryCount)
          .slice(0, 10),
      };
    } else {
      const allPatterns = Array.from(this.patterns.values());
      stats = {
        totalQueries: allPatterns.reduce((sum, p) => sum + p.queryCount, 0),
        collectionsTracked: new Set(allPatterns.map(p => p.collection)).size,
        fieldsTracked: allPatterns.length,
        indexedFields: allPatterns.filter(p => p.isIndexed).length,
        unindexedFields: allPatterns.filter(p => !p.isIndexed).length,
      };
    }

    return new Response(JSON.stringify({
      success: true,
      stats,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private getPatternKey(collection: string, fieldPath: string): string {
    return `${collection}:${fieldPath}`;
  }

  private generateRecommendation(pattern: QueryPattern): string {
    if (pattern.isIndexed) {
      return 'Field is already indexed';
    }

    if (pattern.queryCount < this.INDEX_THRESHOLD) {
      return `Wait for more queries (${pattern.queryCount}/${this.INDEX_THRESHOLD})`;
    }

    return `Create index on ${pattern.collection}.${pattern.fieldPath} (queried ${pattern.queryCount} times)`;
  }

  private estimateImpact(pattern: QueryPattern): 'high' | 'medium' | 'low' {
    if (pattern.queryCount > 1000 && pattern.avgResultCount > 100) {
      return 'high';
    } else if (pattern.queryCount > 500 || pattern.avgResultCount > 50) {
      return 'medium';
    }
    return 'low';
  }
}
