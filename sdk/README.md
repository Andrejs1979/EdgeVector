# EdgeVector DB JavaScript/TypeScript SDK

Official JavaScript/TypeScript SDK for [EdgeVector DB](https://github.com/Andrejs1979/EdgeVector) - a globally distributed, edge-native database platform with schema-free documents and vector search capabilities.

## Features

- 🚀 **Full TypeScript Support** - Complete type definitions for all operations
- 📦 **Tree-shakeable** - Import only what you need
- 🔄 **Automatic Retries** - Built-in retry logic with exponential backoff
- 🔐 **JWT Authentication** - Secure token-based authentication
- 📝 **MongoDB-style Queries** - Familiar query syntax with operators like $eq, $gt, $in, $and, $or
- 🔍 **Vector Search** - Semantic similarity search with multiple metrics
- 🤖 **AI Embeddings** - Automatic embedding generation via Cloudflare Workers AI
- ⚡ **Rate Limit Handling** - Automatic handling of rate limits with retry-after
- 🌐 **Universal** - Works in Node.js and browsers

## Installation

```bash
npm install @edgevector/sdk
```

```bash
yarn add @edgevector/sdk
```

```bash
pnpm add @edgevector/sdk
```

## Quick Start

```typescript
import { EdgeVectorClient } from '@edgevector/sdk';

// Initialize client
const client = new EdgeVectorClient({
  baseUrl: 'https://your-worker.workers.dev'
});

// Register and login
const { token, user } = await client.auth.register({
  email: 'user@example.com',
  password: 'secure_password',
  name: 'John Doe'
});

// Insert documents
await client.documents.insertOne('users', {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  interests: ['AI', 'databases', 'edge computing']
});

// Query documents (MongoDB-style)
const users = await client.documents.find('users', {
  age: { $gte: 25 },
  interests: { $in: ['AI', 'databases'] }
}, { limit: 10 });

// Vector search
const results = await client.vectors.searchByText(
  'articles about machine learning',
  {
    collection: 'articles',
    limit: 5,
    metric: 'cosine',
    threshold: 0.7
  }
);
```

## Configuration

```typescript
const client = new EdgeVectorClient({
  baseUrl: 'https://your-worker.workers.dev',

  // Optional: JWT token for authenticated requests
  token: 'your-jwt-token',

  // Optional: API key authentication
  apiKey: 'your-api-key',

  // Optional: Request timeout in milliseconds (default: 30000)
  timeout: 60000,

  // Optional: Enable automatic retry (default: true)
  retry: true,

  // Optional: Maximum number of retries (default: 3)
  maxRetries: 5,

  // Optional: Custom headers
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

## Authentication

### Register

```typescript
const { token, user } = await client.auth.register({
  email: 'user@example.com',
  password: 'secure_password',
  name: 'John Doe' // optional
});

// Token is automatically stored in client
console.log(user.id, user.email);
```

### Login

```typescript
const { token, user } = await client.auth.login({
  email: 'user@example.com',
  password: 'secure_password'
});
```

### Token Management

```typescript
// Set token manually (e.g., from localStorage)
client.setToken(savedToken);

// Get current token
const token = client.getToken();

// Save token to localStorage
if (token) {
  localStorage.setItem('token', token);
}

// Check if authenticated
if (client.isAuthenticated()) {
  console.log('User is logged in');
}

// Logout
client.logout();
```

### Get Current User

```typescript
const user = await client.auth.me();
console.log(user.email, user.name, user.lastLogin);
```

## Collections

### Create Collection

```typescript
const result = await client.collections.create('articles');
console.log(`Collection ${result.name} created`);
```

### List Collections

```typescript
const collections = await client.collections.list();
collections.forEach(col => {
  console.log(`${col.name}: ${col.documentCount} documents`);
});
```

### Check if Collection Exists

```typescript
if (await client.collections.exists('articles')) {
  console.log('Articles collection exists');
}
```

### Get Collection Details

```typescript
const collection = await client.collections.get('articles');
if (collection) {
  console.log(`${collection.name} has ${collection.documentCount} documents`);
}
```

### Delete Collection

```typescript
const result = await client.collections.delete('old_collection');
console.log(`Deleted ${result.deletedCount} documents`);
```

## Documents

### Insert One

```typescript
const result = await client.documents.insertOne('users', {
  name: 'Alice Smith',
  email: 'alice@example.com',
  age: 28,
  roles: ['admin', 'editor']
});

console.log(`Inserted with ID: ${result._id}`);
```

### Insert Many

```typescript
const result = await client.documents.insertMany('users', [
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
]);

console.log(`Inserted ${result.insertedCount} documents`);
console.log(`IDs: ${result.insertedIds.join(', ')}`);
```

### Find Documents

```typescript
// Simple query
const users = await client.documents.find('users', {
  age: 30
});

// Complex query with operators
const activeAdults = await client.documents.find('users', {
  $and: [
    { age: { $gte: 18 } },
    { status: 'active' },
    { email: { $regex: '@example.com' } }
  ]
}, {
  limit: 20,
  skip: 0,
  sort: { age: -1 }
});

console.log(`Found ${activeAdults.count} users`);
activeAdults.documents.forEach(user => {
  console.log(`${user.name} (${user.age})`);
});
```

### Find One

```typescript
const user = await client.documents.findOne('users', {
  email: 'alice@example.com'
});

if (user) {
  console.log(`Found: ${user.name}`);
}
```

### Find by ID

```typescript
const user = await client.documents.findById('users', '123abc');
```

### Update One

```typescript
const result = await client.documents.updateOne('users', {
  email: 'alice@example.com'
}, {
  $set: { age: 29, status: 'active' },
  $inc: { loginCount: 1 }
});

console.log(`Modified ${result.modifiedCount} documents`);
```

### Update Many

```typescript
const result = await client.documents.updateMany('users', {
  status: 'inactive'
}, {
  $set: {
    status: 'archived',
    archivedAt: new Date().toISOString()
  }
});
```

### Update by ID

```typescript
await client.documents.updateById('users', '123', {
  $set: { lastLogin: new Date().toISOString() }
});
```

### Delete One

```typescript
const result = await client.documents.deleteOne('users', {
  email: 'user@example.com'
});

if (result.deletedCount > 0) {
  console.log('User deleted');
}
```

### Delete Many

```typescript
const result = await client.documents.deleteMany('users', {
  status: 'inactive'
});

console.log(`Deleted ${result.deletedCount} users`);
```

### Delete by ID

```typescript
await client.documents.deleteById('users', '123abc');
```

### Count Documents

```typescript
const activeCount = await client.documents.count('users', {
  status: 'active'
});

console.log(`Active users: ${activeCount}`);
```

## Vector Search

### Search by Text

```typescript
const results = await client.vectors.searchByText(
  'machine learning algorithms',
  {
    collection: 'articles',
    limit: 10,
    metric: 'cosine',
    threshold: 0.7
  }
);

results.results.forEach(result => {
  console.log(`Document ${result.vector.documentId}`);
  console.log(`Score: ${result.score}`);
  console.log(`Distance: ${result.distance}`);
  console.log(`Metadata:`, result.vector.metadata);
});

console.log(`Search took ${results.stats.searchTimeMs}ms`);
console.log(`Scanned ${results.stats.totalVectors} vectors`);
```

### Search by Vector

```typescript
const embedding = [0.1, 0.2, 0.3, ...]; // 768-dimensional vector
const results = await client.vectors.searchByVector(embedding, {
  limit: 5,
  metric: 'euclidean'
});
```

### Generate Embeddings

```typescript
// Single embedding
const result = await client.vectors.generateEmbedding(
  'The quick brown fox jumps over the lazy dog',
  {
    model: 'bge-base',
    normalize: true,
    useCache: true
  }
);

console.log(`Generated ${result.dimensions}-dimensional vector`);
console.log(`Model: ${result.model}`);
console.log(`Cached: ${result.cached}`);

// Batch embeddings (more efficient)
const results = await client.vectors.generateEmbeddingBatch([
  'First document',
  'Second document',
  'Third document'
], { model: 'bge-large' });

console.log(`Generated ${results.length} embeddings`);
```

### Compare Similarity

```typescript
const result = await client.vectors.compareSimilarity(
  'machine learning',
  'artificial intelligence',
  { metric: 'cosine' }
);

console.log(`Similarity: ${result.similarity}`);
console.log(`Metric: ${result.metric}`);
```

### Add Vector to Document

```typescript
const embedding = await client.vectors.generateEmbedding('Article content...');
await client.vectors.add('articles', 'doc123', embedding.embedding, {
  source: 'manual',
  generated: new Date().toISOString()
});
```

### Update Vector

```typescript
const newEmbedding = [0.2, 0.3, ...];
await client.vectors.update('articles', 'doc123', newEmbedding);
```

### Delete Vector

```typescript
await client.vectors.delete('articles', 'doc123');
```

### Get Vector Stats

```typescript
const stats = await client.vectors.getStats('articles');
console.log(`Total vectors: ${stats.totalVectors}`);
console.log(`Dimensions: ${stats.dimensions}`);
console.log(`Models: ${stats.models.join(', ')}`);
```

## Query Operators

EdgeVector DB supports MongoDB-style query operators:

### Comparison Operators

- `$eq` - Equal to
- `$ne` - Not equal to
- `$gt` - Greater than
- `$gte` - Greater than or equal to
- `$lt` - Less than
- `$lte` - Less than or equal to
- `$in` - In array
- `$nin` - Not in array

```typescript
const users = await client.documents.find('users', {
  age: { $gte: 18, $lt: 65 },
  status: { $in: ['active', 'pending'] },
  role: { $ne: 'admin' }
});
```

### Logical Operators

- `$and` - Logical AND
- `$or` - Logical OR
- `$not` - Logical NOT

```typescript
const users = await client.documents.find('users', {
  $or: [
    { age: { $lt: 18 } },
    { status: 'inactive' }
  ]
});
```

### Element Operators

- `$exists` - Field exists
- `$type` - Field type check

```typescript
const users = await client.documents.find('users', {
  phoneNumber: { $exists: true },
  age: { $type: 'number' }
});
```

### Array Operators

- `$all` - Array contains all elements
- `$elemMatch` - Element matches condition
- `$size` - Array size

```typescript
const users = await client.documents.find('users', {
  roles: { $all: ['admin', 'editor'] },
  tags: { $size: 3 }
});
```

### String Operators

- `$regex` - Regular expression match

```typescript
const users = await client.documents.find('users', {
  email: { $regex: '@example\\.com$' }
});
```

## Update Operators

### Field Update Operators

- `$set` - Set field value
- `$unset` - Remove field
- `$inc` - Increment numeric value
- `$mul` - Multiply numeric value

```typescript
await client.documents.updateOne('users', { _id: '123' }, {
  $set: { status: 'active', lastLogin: new Date().toISOString() },
  $inc: { loginCount: 1 },
  $unset: { tempField: '' }
});
```

### Array Update Operators

- `$push` - Add element to array
- `$pull` - Remove element from array
- `$addToSet` - Add unique element to array

```typescript
await client.documents.updateOne('users', { _id: '123' }, {
  $push: { tags: 'verified' },
  $pull: { tags: 'pending' },
  $addToSet: { roles: 'editor' }
});
```

## Error Handling

```typescript
import {
  EdgeVectorError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NetworkError
} from '@edgevector/sdk';

try {
  await client.documents.insertOne('users', { ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Please login first');
    // Redirect to login
  } else if (error instanceof ValidationError) {
    console.error('Invalid data:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded');
    console.log(`Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof EdgeVectorError) {
    console.error('EdgeVector error:', error.message);
    console.log('Error code:', error.code);
    console.log('Status code:', error.statusCode);
  }
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import { EdgeVectorClient, Document, FindResult, User } from '@edgevector/sdk';

// Type-safe document operations
interface UserDoc extends Document {
  name: string;
  email: string;
  age: number;
  roles: string[];
}

const users: FindResult<UserDoc> = await client.documents.find<UserDoc>('users', {
  age: { $gte: 18 }
});

users.documents.forEach((user: UserDoc) => {
  console.log(`${user.name} (${user.age})`);
});
```

## Examples

See the [examples](./examples) directory for complete examples:

- [Basic CRUD](./examples/basic-crud.ts) - Document operations
- [Vector Search](./examples/vector-search.ts) - Semantic search
- [Authentication](./examples/authentication.ts) - User authentication
- [Advanced Queries](./examples/advanced-queries.ts) - Complex queries

## API Reference

Complete API reference available at [https://edgevector.dev/docs/sdk](https://edgevector.dev/docs/sdk)

## License

MIT

## Support

- Documentation: [https://edgevector.dev/docs](https://edgevector.dev/docs)
- GitHub Issues: [https://github.com/Andrejs1979/EdgeVector/issues](https://github.com/Andrejs1979/EdgeVector/issues)
- Discord: [https://discord.gg/edgevector](https://discord.gg/edgevector)
