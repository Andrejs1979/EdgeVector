/**
 * SSEManager Durable Object
 * Manages Server-Sent Events connections for real-time updates
 */

import { Env } from '../types/env';

export interface SSEConnection {
  id: string;
  clientId: string;
  establishedAt: number;
  lastHeartbeat: number;
  lastEventId: string;
  compressionEnabled: boolean;
  subscriptions: string[];
}

export interface SSEEvent {
  id: string;
  type: string;
  data: unknown;
  retry?: number;
}

export class SSEManager implements DurableObject {
  private state: DurableObjectState;
  private _env: Env;
  private connections: Map<string, SSEConnection>;
  private sessions: Map<string, ReadableStreamDefaultController>;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this._env = env;
    this.connections = new Map();
    this.sessions = new Map();

    // Set up periodic heartbeat
    this.state.storage.setAlarm(Date.now() + this.HEARTBEAT_INTERVAL).catch(console.error);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    switch (path) {
      case '/sse/connect':
        return this.handleSSEConnection(request);

      case '/sse/broadcast':
        return this.handleBroadcast(request);

      case '/sse/connections':
        return this.handleListConnections();

      case '/sse/disconnect':
        return this.handleDisconnect(request);

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  }

  async alarm(): Promise<void> {
    // Send heartbeat to all active connections
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      // Check for stale connections (no heartbeat in 2 minutes)
      if (now - connection.lastHeartbeat > 120000) {
        staleConnections.push(connectionId);
        continue;
      }

      // Send heartbeat
      const controller = this.sessions.get(connectionId);
      if (controller) {
        try {
          controller.enqueue(`: heartbeat\n\n`);
          connection.lastHeartbeat = now;
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
          staleConnections.push(connectionId);
        }
      }
    }

    // Clean up stale connections
    for (const connectionId of staleConnections) {
      this.connections.delete(connectionId);
      this.sessions.delete(connectionId);
    }

    // Schedule next heartbeat
    await this.state.storage.setAlarm(Date.now() + this.HEARTBEAT_INTERVAL);
  }

  private async handleSSEConnection(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId') || this.generateClientId();
    const connectionId = this.generateConnectionId();

    // Create connection metadata
    const connection: SSEConnection = {
      id: connectionId,
      clientId,
      establishedAt: Date.now(),
      lastHeartbeat: Date.now(),
      lastEventId: '0',
      compressionEnabled: false,
      subscriptions: [],
    };

    this.connections.set(connectionId, connection);

    // Store writer for broadcasting
    const stream = new ReadableStream({
      start: (controller) => {
        this.sessions.set(connectionId, controller);

        // Send initial connection event
        const connectEvent = this.formatSSEEvent({
          id: '0',
          type: 'connected',
          data: {
            connectionId,
            clientId,
            timestamp: new Date().toISOString(),
          },
        });

        controller.enqueue(connectEvent);
      },
      cancel: () => {
        // Clean up on disconnect
        this.connections.delete(connectionId);
        this.sessions.delete(connectionId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const body = await request.json();

    let targetConnections: SSEConnection[];

    if (body.clientIds) {
      // Send to specific clients
      targetConnections = Array.from(this.connections.values()).filter(
        conn => body.clientIds!.includes(conn.clientId)
      );
    } else if (body.subscriptionFilter) {
      // Send to clients with matching subscription
      targetConnections = Array.from(this.connections.values()).filter(
        conn => conn.subscriptions.includes(body.subscriptionFilter)
      );
    } else {
      // Broadcast to all
      targetConnections = Array.from(this.connections.values());
    }

    const formattedEvent = this.formatSSEEvent(body.event);
    let sent = 0;
    let failed = 0;

    for (const connection of targetConnections) {
      const controller = this.sessions.get(connection.id);
      if (controller) {
        try {
          controller.enqueue(formattedEvent);
          connection.lastEventId = body.event.id;
          sent++;
        } catch (error) {
          console.error('Failed to send event:', error);
          failed++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      totalConnections: this.connections.size,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleListConnections(): Promise<Response> {
    const connections = Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      clientId: conn.clientId,
      establishedAt: conn.establishedAt,
      lastHeartbeat: conn.lastHeartbeat,
      subscriptions: conn.subscriptions,
      age: Date.now() - conn.establishedAt,
    }));

    return new Response(JSON.stringify({
      success: true,
      connections,
      count: connections.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleDisconnect(request: Request): Promise<Response> {
    const body = await request.json();

    let disconnected = 0;

    if (body.connectionId) {
      if (this.connections.delete(body.connectionId)) {
        this.sessions.delete(body.connectionId);
        disconnected = 1;
      }
    } else if (body.clientId) {
      for (const [connId, conn] of this.connections.entries()) {
        if (conn.clientId === body.clientId) {
          this.connections.delete(connId);
          this.sessions.delete(connId);
          disconnected++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      disconnected,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private formatSSEEvent(event: SSEEvent): string {
    let formatted = '';

    if (event.id) {
      formatted += `id: ${event.id}\n`;
    }

    if (event.type) {
      formatted += `event: ${event.type}\n`;
    }

    if (event.retry) {
      formatted += `retry: ${event.retry}\n`;
    }

    // Handle data field - can be multi-line
    const dataStr = typeof event.data === 'string'
      ? event.data
      : JSON.stringify(event.data);

    const dataLines = dataStr.split('\n');
    for (const line of dataLines) {
      formatted += `data: ${line}\n`;
    }

    formatted += '\n';
    return formatted;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
