# EdgeVector DB API Documentation

**Version:** 0.1.0
**Last Updated:** October 15, 2025

EdgeVector DB provides a GraphQL API for managing schema-free documents, vectors, and time series data on Cloudflare's edge network.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [GraphQL Endpoint](#graphql-endpoint)
- [Queries](#queries)
- [Mutations](#mutations)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Quick Start

### Base URL

```
# Development
http://localhost:8787

# Production
https://your-worker.your-subdomain.workers.dev
```

### GraphQL Endpoint

All GraphQL operations are sent to:

```
POST /graphql
Content-Type: application/json
```

### Health Check

```
GET /health
```

Returns API health status without authentication.

## Authentication

EdgeVector DB uses JWT (JSON Web Token) authentication with bearer tokens.

### Register a New User

```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user {
      id
      email
      name
      createdAt
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "John Doe"
  }
}
```

**Requirements:**
- Email must be unique
- Password must be at least 8 characters

**Response:**
```json
{
  "data": {
    "register": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "user_1760525076782_w7i04a17a7c",
        "email": "user@example.com",
        "name": "John Doe",
        "createdAt": "2025-10-15T10:44:36.790Z"
      }
    }
  }
}
```

### Login

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user {
      id
      email
      name
      createdAt
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "email": "user@example.com",
    "password": "securepassword123"
  }
}
```

**Response:**
Returns the same structure as register, with a new JWT token.

### Using Authentication Tokens

Include the token in the Authorization header for all authenticated requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Properties:**
- Expiration: 24 hours
- Algorithm: HMAC-SHA256
- Issuer: edgevector-db

### Get Current User

```graphql
query {
  me {
    id
    email
    name
    createdAt
  }
}
```

**Note:** Requires authentication. Returns current user's profile.

## Rate Limiting

EdgeVector DB enforces rate limits to prevent abuse and ensure fair usage.

### Rate Limit Tiers

| Endpoint | Unauthenticated | Authenticated | Window |
|----------|----------------|---------------|--------|
| GraphQL  | 100 requests   | 500 requests  | 1 min  |
| Health   | 300 requests   | 300 requests  | 1 min  |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1760528358605
```

- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp (ms) when the window resets

### Rate Limit Exceeded

When you exceed the rate limit, you'll receive:

**Status:** `429 Too Many Requests`

**Headers:**
```
Retry-After: 45
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1760528418605
```

**Response:**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "limit": 100,
  "resetAt": "2025-10-15T11:33:38.605Z"
}
```

## GraphQL Endpoint

### Endpoint Details

- **URL:** `/graphql`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **GraphQL Playground:** Available at `/graphql` in browser

### Request Format

```json
{
  "query": "query { ... }",
  "variables": { ... },
  "operationName": "OptionalOperationName"
}
```

### Response Format

**Success:**
```json
{
  "data": {
    "fieldName": { ... }
  }
}
```

**Error:**
```json
{
  "errors": [
    {
      "message": "Error message",
      "locations": [{ "line": 1, "column": 9 }],
      "path": ["fieldName"],
      "extensions": {
        "code": "ERROR_CODE"
      }
    }
  ],
  "data": null
}
```

## Queries

### Health Check

Get system health and database statistics.

```graphql
query {
  health {
    status
    version
    environment
    timestamp
    database {
      connected
      collections
      totalDocuments
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "health": {
      "status": "ok",
      "version": "0.1.0",
      "environment": "development",
      "timestamp": "2025-10-15T10:52:18.082Z",
      "database": {
        "connected": true,
        "collections": 3,
        "totalDocuments": 125
      }
    }
  }
}
```

### List Collections

Get all collections in the database.

```graphql
query {
  collections {
    id
    name
    documentCount
    createdAt
    updatedAt
  }
}
```

### Get Collection Info

Get detailed information about a specific collection.

```graphql
query GetCollection($name: String!) {
  collection(name: $name) {
    id
    name
    documentCount
    createdAt
    updatedAt
    schemaStats {
      totalDocuments
      indexedFields {
        fieldPath
        indexColumn
        dataType
        useCount
      }
      fieldFrequency
      sampleDocuments
    }
  }
}
```

### Find Documents

Query documents with MongoDB-style filters.

```graphql
query FindUsers($filter: JSON, $options: QueryOptions) {
  find(collection: "users", filter: $filter, options: $options) {
    documents {
      _id
      data
    }
    count
    hasMore
  }
}
```

**Variables:**
```json
{
  "filter": {
    "age": { "$gte": 18 },
    "status": "active"
  },
  "options": {
    "limit": 10,
    "offset": 0,
    "sort": { "createdAt": -1 }
  }
}
```

**Supported Operators:**
- `$eq`: Equal to
- `$ne`: Not equal to
- `$gt`: Greater than
- `$gte`: Greater than or equal
- `$lt`: Less than
- `$lte`: Less than or equal
- `$in`: In array
- `$nin`: Not in array
- `$exists`: Field exists
- `$regex`: Regular expression match
- `$and`: Logical AND
- `$or`: Logical OR
- `$not`: Logical NOT

### Find One Document

Find a single document matching the filter.

```graphql
query FindUser($filter: JSON) {
  findOne(collection: "users", filter: $filter) {
    _id
    data
  }
}
```

### Count Documents

Count documents matching a filter.

```graphql
query CountActiveUsers {
  count(collection: "users", filter: { "status": "active" })
}
```

### Schema Statistics

Get schema evolution statistics for a collection.

```graphql
query SchemaStats($collection: String!) {
  schemaStats(collection: $collection) {
    totalDocuments
    indexedFields {
      fieldPath
      indexColumn
      dataType
      useCount
    }
    fieldFrequency
    sampleDocuments
  }
}
```

## Mutations

### Create Collection

Create a new collection.

```graphql
mutation CreateCollection($name: String!) {
  createCollection(name: $name) {
    id
    name
    documentCount
    createdAt
  }
}
```

**Variables:**
```json
{
  "name": "products"
}
```

### Insert One Document

Insert a single document into a collection.

```graphql
mutation InsertProduct($document: JSON!) {
  insertOne(collection: "products", document: $document) {
    _id
    acknowledged
  }
}
```

**Variables:**
```json
{
  "document": {
    "name": "Laptop",
    "price": 999.99,
    "category": "Electronics",
    "inStock": true,
    "tags": ["computer", "portable"]
  }
}
```

### Insert Many Documents

Insert multiple documents at once.

```graphql
mutation InsertProducts($documents: [JSON!]!) {
  insertMany(collection: "products", documents: $documents) {
    insertedIds
    insertedCount
    acknowledged
  }
}
```

**Variables:**
```json
{
  "documents": [
    { "name": "Mouse", "price": 29.99 },
    { "name": "Keyboard", "price": 79.99 }
  ]
}
```

### Update One Document

Update a single document matching the filter.

```graphql
mutation UpdateProduct($filter: JSON!, $update: UpdateOperators!) {
  updateOne(collection: "products", filter: $filter, update: $update) {
    matchedCount
    modifiedCount
    acknowledged
  }
}
```

**Variables:**
```json
{
  "filter": { "_id": "1760524234914_7sq34ucodp" },
  "update": {
    "$set": { "price": 899.99, "onSale": true },
    "$inc": { "views": 1 }
  }
}
```

**Update Operators:**
- `$set`: Set field values
- `$unset`: Remove fields
- `$inc`: Increment numeric values
- `$push`: Add to array
- `$pull`: Remove from array

### Update Many Documents

Update all documents matching the filter.

```graphql
mutation UpdateProducts($filter: JSON!, $update: UpdateOperators!) {
  updateMany(collection: "products", filter: $filter, update: $update) {
    matchedCount
    modifiedCount
    acknowledged
  }
}
```

### Delete One Document

Delete a single document matching the filter.

```graphql
mutation DeleteProduct($filter: JSON!) {
  deleteOne(collection: "products", filter: $filter) {
    deletedCount
    acknowledged
  }
}
```

### Delete Many Documents

Delete all documents matching the filter.

```graphql
mutation DeleteProducts($filter: JSON!) {
  deleteMany(collection: "products", filter: $filter) {
    deletedCount
    acknowledged
  }
}
```

### Drop Collection

Delete an entire collection and all its documents.

```graphql
mutation DropCollection($name: String!) {
  dropCollection(name: $name) {
    success
    message
  }
}
```

## Error Handling

### Common Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `UNAUTHENTICATED` | Missing or invalid auth token | Login and provide valid token |
| `GRAPHQL_VALIDATION_FAILED` | Invalid query syntax | Check query structure |
| `BAD_REQUEST` | Invalid request format | Verify JSON and variables |
| `INTERNAL_SERVER_ERROR` | Server error | Check logs, retry |

### Error Response Example

```json
{
  "errors": [
    {
      "message": "Authentication required. Please provide a valid token.",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

### Rate Limit Error

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "limit": 100,
  "resetAt": "2025-10-15T11:33:38.605Z"
}
```

## Best Practices

### Authentication

1. **Store tokens securely**: Use secure storage (e.g., httpOnly cookies, secure storage APIs)
2. **Refresh before expiry**: JWT tokens expire after 24 hours
3. **Handle 401 errors**: Redirect to login on authentication failures
4. **Don't embed tokens in URLs**: Always use Authorization header

### Rate Limiting

1. **Monitor rate limit headers**: Check `X-RateLimit-Remaining` to avoid limits
2. **Implement exponential backoff**: When rate limited, wait before retrying
3. **Authenticate when possible**: Get 5x higher limits with authentication
4. **Batch operations**: Use `insertMany` instead of multiple `insertOne` calls

### Query Optimization

1. **Use indexed fields**: Queries on indexed fields are faster
2. **Limit result sets**: Always use `limit` to avoid large responses
3. **Project only needed fields**: Don't fetch unnecessary data
4. **Use specific filters**: More specific queries perform better

### Data Modeling

1. **Denormalize when appropriate**: Schema-free allows flexible data structures
2. **Use consistent field names**: Helps with automatic index promotion
3. **Consider query patterns**: Frequently queried fields get auto-indexed
4. **Avoid deeply nested objects**: Keep documents relatively flat

### Error Handling

1. **Always check for errors**: GraphQL can return partial data with errors
2. **Log errors appropriately**: Include request IDs for debugging
3. **Provide user-friendly messages**: Don't expose technical details to users
4. **Implement retry logic**: For transient failures

### Security

1. **Validate input data**: Don't trust client input
2. **Use parameterized queries**: Prevent injection attacks
3. **Implement proper authorization**: Check user permissions
4. **Monitor for abuse**: Watch for unusual patterns
5. **Keep tokens secret**: Never commit tokens to version control

## Example Applications

### User Management System

```graphql
# Register user
mutation {
  register(input: {
    email: "alice@example.com"
    password: "securepass123"
    name: "Alice"
  }) {
    token
    user { id email }
  }
}

# Create users collection
mutation {
  createCollection(name: "users") {
    id
    name
  }
}

# Insert user profile
mutation {
  insertOne(collection: "users", document: {
    userId: "user_123",
    bio: "Software Developer",
    location: "San Francisco",
    interests: ["coding", "hiking"]
  }) {
    _id
  }
}

# Find users by interest
query {
  find(collection: "users", filter: {
    interests: { "$in": ["coding"] }
  }) {
    documents {
      data
    }
  }
}
```

### E-Commerce Product Catalog

```graphql
# Create products collection
mutation {
  createCollection(name: "products") {
    id
  }
}

# Insert products
mutation {
  insertMany(collection: "products", documents: [
    {
      name: "Laptop",
      price: 999.99,
      category: "Electronics",
      inStock: true,
      tags: ["computer", "portable"]
    },
    {
      name: "Mouse",
      price: 29.99,
      category: "Electronics",
      inStock: true,
      tags: ["accessory"]
    }
  ]) {
    insertedCount
  }
}

# Search products
query {
  find(collection: "products", filter: {
    "$and": [
      { "category": "Electronics" },
      { "price": { "$lte": 1000 } },
      { "inStock": true }
    ]
  }, options: {
    limit: 20,
    sort: { "price": 1 }
  }) {
    documents {
      data
    }
    count
  }
}

# Update product price
mutation {
  updateOne(
    collection: "products"
    filter: { "name": "Laptop" }
    update: {
      "$set": { "price": 899.99, "onSale": true }
      "$inc": { "views": 1 }
    }
  ) {
    modifiedCount
  }
}
```

## Support

For issues, questions, or feature requests:
- GitHub: https://github.com/Andrejs1979/EdgeVector
- Documentation: See CLAUDE.md and README.md in the repository

## Version History

- **0.1.0** (October 2025)
  - Initial GraphQL API
  - JWT authentication
  - Rate limiting with KV
  - Schema-free document storage
  - MongoDB-compatible query operators
