/**
 * Document CRUD Integration Tests
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  GraphQLTestClient,
  randomEmail,
  randomCollection,
} from './helpers/graphql-client';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787';

describe('Document CRUD Integration Tests', () => {
  let client: GraphQLTestClient;
  let collectionName: string;

  beforeAll(async () => {
    client = new GraphQLTestClient(BASE_URL);
    // Register and login a test user
    await client.register(randomEmail(), 'testPassword123', 'Document Test User');
  });

  beforeEach(async () => {
    // Create a fresh collection for each test
    collectionName = randomCollection();
    await client.createCollection(collectionName);
  });

  describe('Collection Management', () => {
    it('should create a new collection', async () => {
      const name = randomCollection();
      const collection = await client.createCollection(name);

      expect(collection.id).toBe(name);
      expect(collection.name).toBe(name);
      expect(collection.documentCount).toBe(0);
      expect(collection.createdAt).toBeDefined();
    });

    it('should list collections', async () => {
      const result = await client.query<{ collections: any[] }>(
        `query { collections { id name documentCount } }`
      );

      expect(Array.isArray(result.collections)).toBe(true);
      expect(result.collections.length).toBeGreaterThan(0);
    });
  });

  describe('Insert Operations', () => {
    it('should insert a single document', async () => {
      const document = {
        name: 'Test Product',
        price: 99.99,
        category: 'Electronics',
        inStock: true,
      };

      const result = await client.insertOne(collectionName, document);

      expect(result._id).toBeDefined();
      expect(result.acknowledged).toBe(true);
    });

    it('should insert document with nested objects', async () => {
      const document = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          address: {
            street: '123 Main St',
            city: 'New York',
            zip: '10001',
          },
        },
        metadata: {
          createdBy: 'system',
          version: 1,
        },
      };

      const result = await client.insertOne(collectionName, document);

      expect(result._id).toBeDefined();
      expect(result.acknowledged).toBe(true);
    });

    it('should insert document with arrays', async () => {
      const document = {
        title: 'Blog Post',
        tags: ['tech', 'programming', 'javascript'],
        comments: [
          { author: 'Alice', text: 'Great post!' },
          { author: 'Bob', text: 'Thanks for sharing' },
        ],
      };

      const result = await client.insertOne(collectionName, document);

      expect(result._id).toBeDefined();
    });

    it('should insert multiple documents', async () => {
      const response = await client.mutate<{ insertMany: any }>(
        `
          mutation InsertMany($collection: String!, $documents: [JSON!]!) {
            insertMany(collection: $collection, documents: $documents) {
              insertedIds
              insertedCount
              acknowledged
            }
          }
        `,
        {
          collection: collectionName,
          documents: [
            { name: 'Product 1', price: 10 },
            { name: 'Product 2', price: 20 },
            { name: 'Product 3', price: 30 },
          ],
        }
      );

      expect(response.insertMany.insertedCount).toBe(3);
      expect(response.insertMany.insertedIds).toHaveLength(3);
      expect(response.insertMany.acknowledged).toBe(true);
    });
  });

  describe('Find Operations', () => {
    beforeEach(async () => {
      // Insert test documents
      await client.insertOne(collectionName, {
        name: 'Laptop',
        price: 999.99,
        category: 'Electronics',
        inStock: true,
      });
      await client.insertOne(collectionName, {
        name: 'Mouse',
        price: 29.99,
        category: 'Electronics',
        inStock: true,
      });
      await client.insertOne(collectionName, {
        name: 'Desk',
        price: 299.99,
        category: 'Furniture',
        inStock: false,
      });
    });

    it('should find all documents', async () => {
      const result = await client.find(collectionName);

      expect(result.documents).toHaveLength(3);
      expect(result.count).toBe(3);
    });

    it('should find documents with equality filter', async () => {
      const result = await client.find(collectionName, {
        category: 'Electronics',
      });

      expect(result.documents).toHaveLength(2);
      expect(result.documents.every((doc: any) =>
        doc.data.category === 'Electronics'
      )).toBe(true);
    });

    it('should find documents with comparison operators', async () => {
      const result = await client.find(collectionName, {
        price: { $gte: 100 },
      });

      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.documents.every((doc: any) =>
        doc.data.price >= 100
      )).toBe(true);
    });

    it('should find documents with $in operator', async () => {
      const result = await client.find(collectionName, {
        name: { $in: ['Laptop', 'Mouse'] },
      });

      expect(result.documents).toHaveLength(2);
    });

    it('should find documents with $and operator', async () => {
      const result = await client.find(collectionName, {
        $and: [
          { category: 'Electronics' },
          { price: { $lt: 100 } },
        ],
      });

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].data.name).toBe('Mouse');
    });

    it('should find documents with $or operator', async () => {
      const result = await client.find(collectionName, {
        $or: [
          { category: 'Furniture' },
          { price: { $lt: 50 } },
        ],
      });

      expect(result.documents.length).toBeGreaterThanOrEqual(2);
    });

    it('should find documents with limit', async () => {
      const result = await client.find(collectionName, {}, { limit: 2 });

      expect(result.documents).toHaveLength(2);
    });

    it('should find documents with offset', async () => {
      const allResults = await client.find(collectionName);
      const offsetResults = await client.find(collectionName, {}, { offset: 1 });

      expect(offsetResults.documents).toHaveLength(allResults.documents.length - 1);
    });

    it('should find one document', async () => {
      const result = await client.query<{ findOne: any }>(
        `
          query FindOne($collection: String!, $filter: JSON) {
            findOne(collection: $collection, filter: $filter) {
              _id
              data
            }
          }
        `,
        {
          collection: collectionName,
          filter: { name: 'Laptop' },
        }
      );

      expect(result.findOne).toBeDefined();
      expect(result.findOne.data.name).toBe('Laptop');
    });
  });

  describe('Count Operations', () => {
    beforeEach(async () => {
      // Insert test documents
      for (let i = 0; i < 5; i++) {
        await client.insertOne(collectionName, {
          index: i,
          isEven: i % 2 === 0,
        });
      }
    });

    it('should count all documents', async () => {
      const count = await client.count(collectionName);

      expect(count).toBe(5);
    });

    it('should count documents with filter', async () => {
      const count = await client.count(collectionName, {
        isEven: true,
      });

      expect(count).toBe(3);
    });
  });

  describe('Update Operations', () => {
    let documentId: string;

    beforeEach(async () => {
      const result = await client.insertOne(collectionName, {
        name: 'Original Name',
        count: 10,
        status: 'active',
      });
      documentId = result._id;
    });

    it('should update document with $set', async () => {
      const result = await client.updateOne(
        collectionName,
        { _id: documentId },
        { $set: { name: 'Updated Name' } }
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);

      // Verify update
      const doc = await client.find(collectionName, { _id: documentId });
      expect(doc.documents[0].data.name).toBe('Updated Name');
    });

    it('should update document with $inc', async () => {
      const result = await client.updateOne(
        collectionName,
        { _id: documentId },
        { $inc: { count: 5 } }
      );

      expect(result.modifiedCount).toBe(1);

      // Verify update
      const doc = await client.find(collectionName, { _id: documentId });
      expect(doc.documents[0].data.count).toBe(15);
    });

    it('should update multiple fields', async () => {
      const result = await client.updateOne(
        collectionName,
        { _id: documentId },
        {
          $set: { name: 'New Name', status: 'inactive' },
          $inc: { count: 3 },
        }
      );

      expect(result.modifiedCount).toBe(1);

      // Verify updates
      const doc = await client.find(collectionName, { _id: documentId });
      expect(doc.documents[0].data.name).toBe('New Name');
      expect(doc.documents[0].data.status).toBe('inactive');
      expect(doc.documents[0].data.count).toBe(13);
    });

    it('should update many documents', async () => {
      // Insert more documents
      await client.insertOne(collectionName, { status: 'active', type: 'A' });
      await client.insertOne(collectionName, { status: 'active', type: 'B' });

      const result = await client.mutate<{ updateMany: any }>(
        `
          mutation UpdateMany($collection: String!, $filter: JSON!, $update: UpdateOperators!) {
            updateMany(collection: $collection, filter: $filter, update: $update) {
              matchedCount
              modifiedCount
              acknowledged
            }
          }
        `,
        {
          collection: collectionName,
          filter: { status: 'active' },
          update: { $set: { status: 'archived' } },
        }
      );

      expect(result.updateMany.matchedCount).toBeGreaterThanOrEqual(3);
      expect(result.updateMany.modifiedCount).toBeGreaterThanOrEqual(3);
    });

    it('should return 0 modified count when no changes made', async () => {
      const result = await client.updateOne(
        collectionName,
        { _id: documentId },
        { $set: { name: 'Original Name' } } // Same value
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(0); // No actual change
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      // Insert test documents
      await client.insertOne(collectionName, { name: 'Doc 1', category: 'A' });
      await client.insertOne(collectionName, { name: 'Doc 2', category: 'A' });
      await client.insertOne(collectionName, { name: 'Doc 3', category: 'B' });
    });

    it('should delete one document', async () => {
      const result = await client.deleteOne(collectionName, {
        name: 'Doc 1',
      });

      expect(result.deletedCount).toBe(1);
      expect(result.acknowledged).toBe(true);

      // Verify deletion
      const count = await client.count(collectionName);
      expect(count).toBe(2);
    });

    it('should delete many documents', async () => {
      const result = await client.mutate<{ deleteMany: any }>(
        `
          mutation DeleteMany($collection: String!, $filter: JSON!) {
            deleteMany(collection: $collection, filter: $filter) {
              deletedCount
              acknowledged
            }
          }
        `,
        {
          collection: collectionName,
          filter: { category: 'A' },
        }
      );

      expect(result.deleteMany.deletedCount).toBe(2);

      // Verify deletions
      const count = await client.count(collectionName);
      expect(count).toBe(1);
    });

    it('should return 0 deleted count when no match', async () => {
      const result = await client.deleteOne(collectionName, {
        name: 'NonExistent',
      });

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('Complex Queries', () => {
    beforeEach(async () => {
      // Insert complex documents
      await client.insertOne(collectionName, {
        product: 'Laptop',
        price: 1299,
        specs: { ram: 16, storage: 512 },
        tags: ['computer', 'portable', 'work'],
        inStock: true,
      });
      await client.insertOne(collectionName, {
        product: 'Desktop',
        price: 1599,
        specs: { ram: 32, storage: 1024 },
        tags: ['computer', 'powerful', 'gaming'],
        inStock: true,
      });
      await client.insertOne(collectionName, {
        product: 'Tablet',
        price: 499,
        specs: { ram: 8, storage: 256 },
        tags: ['portable', 'touch', 'media'],
        inStock: false,
      });
    });

    it('should query nested fields', async () => {
      const result = await client.find(collectionName, {
        'specs.ram': { $gte: 16 },
      });

      expect(result.documents.length).toBeGreaterThanOrEqual(2);
    });

    it('should query with complex logical operators', async () => {
      const result = await client.find(collectionName, {
        $and: [
          {
            $or: [
              { 'specs.ram': { $gte: 16 } },
              { price: { $lte: 500 } },
            ],
          },
          { inStock: true },
        ],
      });

      expect(result.documents.length).toBeGreaterThan(0);
    });
  });
});
