/**
 * GraphQL Schema for EdgeVector DB
 *
 * Provides a type-safe API for schema-free document operations
 */

export const typeDefs = `#graphql
  # JSON scalar for flexible document data
  scalar JSON
  scalar DateTime

  # Query filter input (MongoDB-style)
  input QueryFilter {
    # Field-level filters
    field: String

    # Comparison operators
    eq: JSON
    ne: JSON
    gt: JSON
    gte: JSON
    lt: JSON
    lte: JSON
    in: [JSON]
    nin: [JSON]
    exists: Boolean
    regex: String

    # Logical operators
    and: [QueryFilter]
    or: [QueryFilter]
    not: QueryFilter
  }

  # Update operators (MongoDB-style)
  input UpdateOperators {
    set: JSON
    unset: [String]
    inc: JSON
    push: JSON
    pull: JSON
    addToSet: JSON
  }

  # Query options
  input QueryOptions {
    limit: Int
    skip: Int
    sort: JSON
    projection: JSON
  }

  # Document metadata
  type DocumentMetadata {
    id: ID!
    collection: String!
    version: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    deleted: Boolean!
  }

  # Generic document type
  type Document {
    _id: ID!
    _metadata: DocumentMetadata
    data: JSON!
  }

  # Insert result
  type InsertResult {
    _id: ID!
    acknowledged: Boolean!
  }

  # Update result
  type UpdateResult {
    acknowledged: Boolean!
    matchedCount: Int!
    modifiedCount: Int!
  }

  # Delete result
  type DeleteResult {
    acknowledged: Boolean!
    deletedCount: Int!
  }

  # Find result with pagination
  type FindResult {
    documents: [Document!]!
    count: Int!
    hasMore: Boolean!
  }

  # Schema evolution stats
  type IndexedField {
    field: String!
    column: String!
    usageCount: Int!
  }

  type SchemaStats {
    totalIndexed: Int!
    availableSlots: Int!
    indexedFields: [IndexedField!]!
  }

  # Collection info
  type Collection {
    id: ID!
    name: String!
    documentCount: Int!
    totalSizeBytes: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    schemaStats: SchemaStats
  }

  # Query type
  type Query {
    # Health check
    health: HealthStatus!

    # List collections
    collections: [Collection!]!

    # Get collection info
    collection(name: String!): Collection

    # Find documents
    find(
      collection: String!
      filter: JSON
      options: QueryOptions
    ): FindResult!

    # Find one document
    findOne(
      collection: String!
      filter: JSON
    ): Document

    # Count documents
    count(
      collection: String!
      filter: JSON
    ): Int!

    # Get schema evolution stats
    schemaStats(collection: String!): SchemaStats!
  }

  # Mutation type
  type Mutation {
    # Insert one document
    insertOne(
      collection: String!
      document: JSON!
    ): InsertResult!

    # Insert multiple documents
    insertMany(
      collection: String!
      documents: [JSON!]!
    ): [InsertResult!]!

    # Update one document
    updateOne(
      collection: String!
      filter: JSON!
      update: UpdateOperators!
    ): UpdateResult!

    # Update many documents
    updateMany(
      collection: String!
      filter: JSON!
      update: UpdateOperators!
    ): UpdateResult!

    # Delete one document
    deleteOne(
      collection: String!
      filter: JSON!
    ): DeleteResult!

    # Delete many documents
    deleteMany(
      collection: String!
      filter: JSON!
    ): DeleteResult!

    # Create collection (optional, auto-created on first insert)
    createCollection(name: String!): Collection!

    # Drop collection
    dropCollection(name: String!): Boolean!
  }

  # Subscription type for real-time updates
  type Subscription {
    # Subscribe to document changes
    documentChanges(
      collection: String!
      filter: JSON
    ): DocumentChangeEvent!

    # Subscribe to collection stats
    collectionStats(name: String!): Collection!
  }

  # Document change event
  type DocumentChangeEvent {
    operation: String!
    collection: String!
    documentId: ID!
    before: JSON
    after: JSON
    timestamp: DateTime!
  }

  # Health status
  type HealthStatus {
    status: String!
    version: String!
    environment: String!
    timestamp: DateTime!
    database: DatabaseStatus!
  }

  type DatabaseStatus {
    connected: Boolean!
    collections: Int!
    totalDocuments: Int!
    totalSize: Int!
  }
`;
