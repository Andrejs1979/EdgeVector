/**
 * Collection Client
 *
 * Manages database collections (create, list, delete)
 */

import { HttpClient } from '../utils/http-client';
import {
  Collection,
  CreateCollectionResult,
  DeleteResult,
} from '../types';

export class CollectionClient {
  constructor(private http: HttpClient) {}

  /**
   * Create a new collection
   *
   * @param name - Collection name
   * @returns Collection creation result
   *
   * @example
   * ```typescript
   * const result = await client.collections.create('users');
   * console.log(`Collection ${result.name} created`);
   * ```
   */
  async create(name: string): Promise<CreateCollectionResult> {
    const query = `
      mutation CreateCollection($name: String!) {
        createCollection(name: $name) {
          name
          created
        }
      }
    `;

    const response = await this.http.request<{
      createCollection: CreateCollectionResult;
    }>(query, { name });

    return response.createCollection;
  }

  /**
   * List all collections
   *
   * @returns Array of collections
   *
   * @example
   * ```typescript
   * const collections = await client.collections.list();
   * collections.forEach(col => {
   *   console.log(`${col.name}: ${col.documentCount} documents`);
   * });
   * ```
   */
  async list(): Promise<Collection[]> {
    const query = `
      query ListCollections {
        listCollections {
          name
          documentCount
          createdAt
          indexes
        }
      }
    `;

    const response = await this.http.request<{
      listCollections: Collection[];
    }>(query);

    return response.listCollections;
  }

  /**
   * Delete a collection and all its documents
   *
   * **Warning:** This operation is irreversible and will delete all documents in the collection
   *
   * @param name - Collection name to delete
   * @returns Deletion result with count of deleted documents
   *
   * @example
   * ```typescript
   * const result = await client.collections.delete('old_collection');
   * console.log(`Deleted ${result.deletedCount} documents`);
   * ```
   */
  async delete(name: string): Promise<DeleteResult> {
    const query = `
      mutation DeleteCollection($name: String!) {
        deleteCollection(name: $name) {
          deletedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      deleteCollection: DeleteResult;
    }>(query, { name });

    return response.deleteCollection;
  }

  /**
   * Check if a collection exists
   *
   * @param name - Collection name to check
   * @returns True if collection exists
   *
   * @example
   * ```typescript
   * if (await client.collections.exists('users')) {
   *   console.log('Users collection exists');
   * }
   * ```
   */
  async exists(name: string): Promise<boolean> {
    const collections = await this.list();
    return collections.some((col) => col.name === name);
  }

  /**
   * Get collection details
   *
   * @param name - Collection name
   * @returns Collection details or null if not found
   *
   * @example
   * ```typescript
   * const collection = await client.collections.get('users');
   * if (collection) {
   *   console.log(`${collection.name} has ${collection.documentCount} documents`);
   * }
   * ```
   */
  async get(name: string): Promise<Collection | null> {
    const collections = await this.list();
    return collections.find((col) => col.name === name) || null;
  }
}
