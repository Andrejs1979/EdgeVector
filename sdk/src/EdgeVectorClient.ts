/**
 * EdgeVector DB Client
 *
 * Main client for interacting with EdgeVector DB
 */

import { EdgeVectorConfig } from './types';
import { HttpClient } from './utils/http-client';
import { AuthClient } from './clients/AuthClient';
import { CollectionClient } from './clients/CollectionClient';
import { DocumentClient } from './clients/DocumentClient';
import { VectorClient } from './clients/VectorClient';

/**
 * EdgeVector DB Client
 *
 * Provides a comprehensive interface to interact with EdgeVector DB
 *
 * @example
 * ```typescript
 * import { EdgeVectorClient } from '@edgevector/sdk';
 *
 * // Initialize client
 * const client = new EdgeVectorClient({
 *   baseUrl: 'https://your-worker.workers.dev'
 * });
 *
 * // Authenticate
 * await client.auth.login({
 *   email: 'user@example.com',
 *   password: 'password'
 * });
 *
 * // Insert documents
 * await client.documents.insertOne('users', {
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 *
 * // Search by text
 * const results = await client.vectors.searchByText('machine learning', {
 *   collection: 'articles',
 *   limit: 10
 * });
 * ```
 */
export class EdgeVectorClient {
  private http: HttpClient;

  /** Authentication operations (register, login, token management) */
  public readonly auth: AuthClient;

  /** Collection operations (create, list, delete) */
  public readonly collections: CollectionClient;

  /** Document operations (CRUD, query with MongoDB-style filters) */
  public readonly documents: DocumentClient;

  /** Vector search operations (semantic search, embeddings, similarity) */
  public readonly vectors: VectorClient;

  /**
   * Create a new EdgeVector DB client
   *
   * @param config - Client configuration
   *
   * @example
   * ```typescript
   * // With JWT token
   * const client = new EdgeVectorClient({
   *   baseUrl: 'https://your-worker.workers.dev',
   *   token: 'your-jwt-token'
   * });
   *
   * // With API key
   * const client = new EdgeVectorClient({
   *   baseUrl: 'https://your-worker.workers.dev',
   *   apiKey: 'your-api-key'
   * });
   *
   * // With custom options
   * const client = new EdgeVectorClient({
   *   baseUrl: 'https://your-worker.workers.dev',
   *   timeout: 60000,
   *   maxRetries: 5,
   *   headers: {
   *     'X-Custom-Header': 'value'
   *   }
   * });
   * ```
   */
  constructor(config: EdgeVectorConfig) {
    // Validate required config
    if (!config.baseUrl) {
      throw new Error('baseUrl is required in EdgeVectorConfig');
    }

    // Create HTTP client
    this.http = new HttpClient(config);

    // Initialize sub-clients
    this.auth = new AuthClient(this.http);
    this.collections = new CollectionClient(this.http);
    this.documents = new DocumentClient(this.http);
    this.vectors = new VectorClient(this.http);
  }

  /**
   * Check database health and connectivity
   *
   * @returns Health check response with system information
   *
   * @example
   * ```typescript
   * const health = await client.health();
   * console.log(`Status: ${health.status}`);
   * console.log(`Environment: ${health.environment}`);
   * ```
   */
  async health(): Promise<{
    status: string;
    service: string;
    version: string;
    environment: string;
    timestamp: string;
  }> {
    const query = `
      query Health {
        health {
          status
          service
          version
          environment
          timestamp
          database {
            connected
            collections
            documents
          }
        }
      }
    `;

    const response = await this.http.request<{
      health: {
        status: string;
        service: string;
        version: string;
        environment: string;
        timestamp: string;
      };
    }>(query);

    return response.health;
  }

  /**
   * Execute a raw GraphQL query
   *
   * For advanced use cases where you need direct GraphQL access
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Query response data
   *
   * @example
   * ```typescript
   * const data = await client.rawQuery(`
   *   query GetUser($id: String!) {
   *     findOne(collection: "users", filter: { _id: $id }) {
   *       documents
   *     }
   *   }
   * `, { id: '123' });
   * ```
   */
  async rawQuery<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    return this.http.request<T>(query, variables);
  }

  /**
   * Set authentication token
   *
   * @param token - JWT token
   *
   * @example
   * ```typescript
   * // Restore session from localStorage
   * const token = localStorage.getItem('token');
   * if (token) {
   *   client.setToken(token);
   * }
   * ```
   */
  setToken(token: string): void {
    this.auth.setToken(token);
  }

  /**
   * Get current authentication token
   *
   * @returns Current JWT token or undefined
   *
   * @example
   * ```typescript
   * const token = client.getToken();
   * if (token) {
   *   // Save to localStorage
   *   localStorage.setItem('token', token);
   * }
   * ```
   */
  getToken(): string | undefined {
    return this.auth.getToken();
  }

  /**
   * Clear authentication (logout)
   *
   * @example
   * ```typescript
   * client.logout();
   * localStorage.removeItem('token');
   * ```
   */
  logout(): void {
    this.auth.logout();
  }

  /**
   * Check if user is authenticated
   *
   * @returns True if a token is present
   *
   * @example
   * ```typescript
   * if (!client.isAuthenticated()) {
   *   // Redirect to login
   *   window.location.href = '/login';
   * }
   * ```
   */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }
}
