/**
 * ShardManager Durable Object
 * Manages database shards and routing for multi-D1 scaling
 */

import { Env } from '../types/env';

export interface ShardInfo {
  shardId: string;
  shardType: 'tenant' | 'range' | 'geo' | 'time';
  shardKey?: string;
  keyRangeStart?: string;
  keyRangeEnd?: string;
  databaseId: string;
  databaseName: string;
  sizeBytes: number;
  documentCount: number;
  status: 'active' | 'readonly' | 'migrating' | 'archived';
}

export interface ShardRoute {
  shardId: string;
  databaseId: string;
}

export class ShardManager implements DurableObject {
  private state: DurableObjectState;
  private _env: Env;
  private shards: Map<string, ShardInfo>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this._env = env;
    this.shards = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize shards from storage on first request
    if (this.shards.size === 0) {
      await this.loadShards();
    }

    switch (path) {
      case '/shard/create':
        return this.handleCreateShard(request);

      case '/shard/route':
        return this.handleGetRoute(request);

      case '/shard/list':
        return this.handleListShards();

      case '/shard/metrics':
        return this.handleGetMetrics(request);

      case '/shard/rebalance':
        return this.handleRebalance(request);

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  }

  private async loadShards(): Promise<void> {
    const shardsData = await this.state.storage.get<ShardInfo[]>('shards');
    if (shardsData) {
      shardsData.forEach(shard => {
        this.shards.set(shard.shardId, shard);
      });
    }
  }

  private async saveShards(): Promise<void> {
    const shardsArray = Array.from(this.shards.values());
    await this.state.storage.put('shards', shardsArray);
  }

  private async handleCreateShard(request: Request): Promise<Response> {
    const body = await request.json();

    const shardId = body.shardId || this.generateShardId();
    const shard: ShardInfo = {
      shardId,
      shardType: body.shardType || 'tenant',
      shardKey: body.shardKey,
      databaseId: body.databaseId || 'default-db',
      databaseName: body.databaseName || 'edgevector-db',
      sizeBytes: 0,
      documentCount: 0,
      status: 'active',
    };

    this.shards.set(shardId, shard);
    await this.saveShards();

    return new Response(JSON.stringify({
      success: true,
      shard,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleGetRoute(request: Request): Promise<Response> {
    const body = await request.json();

    const route = this.getShardForKey(body.key, body.type);

    if (!route) {
      return new Response(JSON.stringify({
        error: 'No shard found for key',
        key: body.key,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      route,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleListShards(): Promise<Response> {
    const shardsList = Array.from(this.shards.values());

    return new Response(JSON.stringify({
      success: true,
      shards: shardsList,
      count: shardsList.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleGetMetrics(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const shardId = url.searchParams.get('shardId');

    if (shardId) {
      const shard = this.shards.get(shardId);
      if (!shard) {
        return new Response(JSON.stringify({
          error: 'Shard not found',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        metrics: {
          sizeBytes: shard.sizeBytes,
          documentCount: shard.documentCount,
          status: shard.status,
          utilizationPercent: (shard.sizeBytes / (10 * 1024 * 1024 * 1024)) * 100, // 10GB limit
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return metrics for all shards
    const allMetrics = Array.from(this.shards.values()).map(shard => ({
      shardId: shard.shardId,
      sizeBytes: shard.sizeBytes,
      documentCount: shard.documentCount,
      status: shard.status,
      utilizationPercent: (shard.sizeBytes / (10 * 1024 * 1024 * 1024)) * 100,
    }));

    return new Response(JSON.stringify({
      success: true,
      metrics: allMetrics,
      totalShards: allMetrics.length,
      totalDocuments: allMetrics.reduce((sum, m) => sum + m.documentCount, 0),
      totalSize: allMetrics.reduce((sum, m) => sum + m.sizeBytes, 0),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleRebalance(_request: Request): Promise<Response> {
    // Find shards that are near capacity (>8GB)
    const heavyShards = Array.from(this.shards.values()).filter(
      shard => shard.sizeBytes > 8 * 1024 * 1024 * 1024 && shard.status === 'active'
    );

    const rebalancePlan = heavyShards.map(shard => ({
      shardId: shard.shardId,
      action: 'split',
      reason: 'approaching capacity',
      currentSize: shard.sizeBytes,
    }));

    return new Response(JSON.stringify({
      success: true,
      rebalancePlan,
      heavyShardsCount: heavyShards.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private getShardForKey(key: string, type: 'tenant' | 'range'): ShardRoute | null {
    if (type === 'tenant') {
      // For tenant-based sharding, use the key as the tenant ID
      const tenantShard = Array.from(this.shards.values()).find(
        shard => shard.shardType === 'tenant' && shard.shardKey === key
      );

      if (tenantShard) {
        return {
          shardId: tenantShard.shardId,
          databaseId: tenantShard.databaseId,
        };
      }

      // If no shard exists for this tenant, return the first active shard
      // In production, this should create a new shard
      const fallbackShard = Array.from(this.shards.values()).find(
        shard => shard.status === 'active'
      );

      return fallbackShard ? {
        shardId: fallbackShard.shardId,
        databaseId: fallbackShard.databaseId,
      } : null;
    }

    // For range-based sharding (future implementation)
    return null;
  }

  private generateShardId(): string {
    return `shard_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  async updateShardMetrics(shardId: string, documentCount: number, sizeBytes: number): Promise<void> {
    const shard = this.shards.get(shardId);
    if (shard) {
      shard.documentCount = documentCount;
      shard.sizeBytes = sizeBytes;
      await this.saveShards();
    }
  }
}
