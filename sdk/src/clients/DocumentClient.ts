/**
 * Document Client
 *
 * Handles all document CRUD operations with MongoDB-style queries
 */

import { HttpClient } from '../utils/http-client';
import {
  Document,
  InsertOneResult,
  InsertManyResult,
  FindOptions,
  FindResult,
  UpdateResult,
  DeleteResult,
  Filter,
  UpdateDocument,
} from '../types';

export class DocumentClient {
  constructor(private http: HttpClient) {}

  /**
   * Insert a single document
   *
   * @param collection - Collection name
   * @param document - Document to insert
   * @returns Insert result with generated ID
   *
   * @example
   * ```typescript
   * const result = await client.documents.insertOne('users', {
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   age: 30
   * });
   * console.log(`Document inserted with ID: ${result._id}`);
   * ```
   */
  async insertOne(
    collection: string,
    document: Document
  ): Promise<InsertOneResult> {
    const query = `
      mutation InsertOne($collection: String!, $document: JSON!) {
        insertOne(collection: $collection, document: $document) {
          _id
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      insertOne: InsertOneResult;
    }>(query, { collection, document });

    return response.insertOne;
  }

  /**
   * Insert multiple documents
   *
   * @param collection - Collection name
   * @param documents - Array of documents to insert
   * @returns Insert result with generated IDs
   *
   * @example
   * ```typescript
   * const result = await client.documents.insertMany('users', [
   *   { name: 'Alice', email: 'alice@example.com' },
   *   { name: 'Bob', email: 'bob@example.com' }
   * ]);
   * console.log(`Inserted ${result.insertedCount} documents`);
   * ```
   */
  async insertMany(
    collection: string,
    documents: Document[]
  ): Promise<InsertManyResult> {
    const query = `
      mutation InsertMany($collection: String!, $documents: [JSON!]!) {
        insertMany(collection: $collection, documents: $documents) {
          insertedIds
          insertedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      insertMany: InsertManyResult;
    }>(query, { collection, documents });

    return response.insertMany;
  }

  /**
   * Find documents matching a filter
   *
   * Supports MongoDB-style query operators like $eq, $gt, $lt, $in, $and, $or, etc.
   *
   * @param collection - Collection name
   * @param filter - MongoDB-style query filter (default: {})
   * @param options - Query options (limit, skip, sort)
   * @returns Find result with documents and count
   *
   * @example
   * ```typescript
   * // Find all users older than 25
   * const result = await client.documents.find('users', {
   *   age: { $gt: 25 }
   * }, { limit: 10 });
   *
   * // Complex query with multiple conditions
   * const users = await client.documents.find('users', {
   *   $and: [
   *     { age: { $gte: 18 } },
   *     { status: 'active' },
   *     { email: { $regex: '@example.com' } }
   *   ]
   * });
   * ```
   */
  async find<T = Document>(
    collection: string,
    filter: Filter = {},
    options: FindOptions = {}
  ): Promise<FindResult<T>> {
    const query = `
      query Find(
        $collection: String!
        $filter: JSON
        $limit: Int
        $skip: Int
        $sort: JSON
      ) {
        find(
          collection: $collection
          filter: $filter
          limit: $limit
          skip: $skip
          sort: $sort
        ) {
          documents
          count
        }
      }
    `;

    const response = await this.http.request<{
      find: FindResult<T>;
    }>(query, {
      collection,
      filter,
      ...options,
    });

    return response.find;
  }

  /**
   * Find a single document matching a filter
   *
   * @param collection - Collection name
   * @param filter - MongoDB-style query filter
   * @returns First matching document or null
   *
   * @example
   * ```typescript
   * const user = await client.documents.findOne('users', {
   *   email: 'john@example.com'
   * });
   *
   * if (user) {
   *   console.log(`Found user: ${user.name}`);
   * }
   * ```
   */
  async findOne<T = Document>(
    collection: string,
    filter: Filter
  ): Promise<T | null> {
    const result = await this.find<T>(collection, filter, { limit: 1 });
    return result.documents[0] || null;
  }

  /**
   * Find document by ID
   *
   * @param collection - Collection name
   * @param id - Document ID
   * @returns Document or null if not found
   *
   * @example
   * ```typescript
   * const user = await client.documents.findById('users', '123abc');
   * ```
   */
  async findById<T = Document>(
    collection: string,
    id: string
  ): Promise<T | null> {
    return this.findOne<T>(collection, { _id: id });
  }

  /**
   * Update a single document
   *
   * Supports MongoDB-style update operators like $set, $inc, $push, etc.
   *
   * @param collection - Collection name
   * @param filter - Query filter to match document
   * @param update - Update operations or replacement document
   * @returns Update result with match and modification counts
   *
   * @example
   * ```typescript
   * // Update with $set operator
   * const result = await client.documents.updateOne('users', {
   *   email: 'john@example.com'
   * }, {
   *   $set: { age: 31, status: 'active' }
   * });
   *
   * // Increment a value
   * await client.documents.updateOne('users', {
   *   _id: '123'
   * }, {
   *   $inc: { loginCount: 1 }
   * });
   * ```
   */
  async updateOne(
    collection: string,
    filter: Filter,
    update: UpdateDocument
  ): Promise<UpdateResult> {
    const query = `
      mutation UpdateOne(
        $collection: String!
        $filter: JSON!
        $update: JSON!
      ) {
        updateOne(
          collection: $collection
          filter: $filter
          update: $update
        ) {
          matchedCount
          modifiedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      updateOne: UpdateResult;
    }>(query, { collection, filter, update });

    return response.updateOne;
  }

  /**
   * Update multiple documents
   *
   * @param collection - Collection name
   * @param filter - Query filter to match documents
   * @param update - Update operations
   * @returns Update result with match and modification counts
   *
   * @example
   * ```typescript
   * // Update all inactive users
   * const result = await client.documents.updateMany('users', {
   *   status: 'inactive'
   * }, {
   *   $set: { status: 'archived', archivedAt: new Date().toISOString() }
   * });
   *
   * console.log(`Updated ${result.modifiedCount} documents`);
   * ```
   */
  async updateMany(
    collection: string,
    filter: Filter,
    update: UpdateDocument
  ): Promise<UpdateResult> {
    const query = `
      mutation UpdateMany(
        $collection: String!
        $filter: JSON!
        $update: JSON!
      ) {
        updateMany(
          collection: $collection
          filter: $filter
          update: $update
        ) {
          matchedCount
          modifiedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      updateMany: UpdateResult;
    }>(query, { collection, filter, update });

    return response.updateMany;
  }

  /**
   * Update document by ID
   *
   * @param collection - Collection name
   * @param id - Document ID
   * @param update - Update operations
   * @returns Update result
   *
   * @example
   * ```typescript
   * await client.documents.updateById('users', '123', {
   *   $set: { lastLogin: new Date().toISOString() }
   * });
   * ```
   */
  async updateById(
    collection: string,
    id: string,
    update: UpdateDocument
  ): Promise<UpdateResult> {
    return this.updateOne(collection, { _id: id }, update);
  }

  /**
   * Delete a single document
   *
   * @param collection - Collection name
   * @param filter - Query filter to match document
   * @returns Delete result with count
   *
   * @example
   * ```typescript
   * const result = await client.documents.deleteOne('users', {
   *   email: 'user@example.com'
   * });
   *
   * if (result.deletedCount > 0) {
   *   console.log('User deleted');
   * }
   * ```
   */
  async deleteOne(collection: string, filter: Filter): Promise<DeleteResult> {
    const query = `
      mutation DeleteOne($collection: String!, $filter: JSON!) {
        deleteOne(collection: $collection, filter: $filter) {
          deletedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      deleteOne: DeleteResult;
    }>(query, { collection, filter });

    return response.deleteOne;
  }

  /**
   * Delete multiple documents
   *
   * **Warning:** Be careful with this operation, especially with empty filters
   *
   * @param collection - Collection name
   * @param filter - Query filter to match documents
   * @returns Delete result with count
   *
   * @example
   * ```typescript
   * // Delete all inactive users
   * const result = await client.documents.deleteMany('users', {
   *   status: 'inactive'
   * });
   *
   * console.log(`Deleted ${result.deletedCount} users`);
   * ```
   */
  async deleteMany(collection: string, filter: Filter): Promise<DeleteResult> {
    const query = `
      mutation DeleteMany($collection: String!, $filter: JSON!) {
        deleteMany(collection: $collection, filter: $filter) {
          deletedCount
          acknowledged
        }
      }
    `;

    const response = await this.http.request<{
      deleteMany: DeleteResult;
    }>(query, { collection, filter });

    return response.deleteMany;
  }

  /**
   * Delete document by ID
   *
   * @param collection - Collection name
   * @param id - Document ID
   * @returns Delete result
   *
   * @example
   * ```typescript
   * await client.documents.deleteById('users', '123abc');
   * ```
   */
  async deleteById(collection: string, id: string): Promise<DeleteResult> {
    return this.deleteOne(collection, { _id: id });
  }

  /**
   * Count documents matching a filter
   *
   * @param collection - Collection name
   * @param filter - Query filter (default: {})
   * @returns Document count
   *
   * @example
   * ```typescript
   * const activeUserCount = await client.documents.count('users', {
   *   status: 'active'
   * });
   * ```
   */
  async count(collection: string, filter: Filter = {}): Promise<number> {
    const result = await this.find(collection, filter, { limit: 0 });
    return result.count;
  }
}
