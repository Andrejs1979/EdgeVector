# Week 4 Plan: Vector Search & MCP Integration

**Duration:** 6 days
**Goal:** Implement basic vector search capabilities and MCP server foundation

## Overview

Week 4 will complete the Phase 1 MVP by adding:
1. Basic vector search with similarity algorithms
2. Cloudflare Workers AI integration for embeddings
3. Model Context Protocol (MCP) server foundation
4. Vector operations in GraphQL API

## Prerequisites Completed

- ✅ Week 1: Infrastructure (Cloudflare Workers, D1, Durable Objects, KV, R2)
- ✅ Week 2: Schema-free document engine
- ✅ Week 3: GraphQL API, JWT auth, rate limiting, documentation, tests

## Week 4 Tasks

### Day 1-2: Vector Storage & Basic Operations

#### Task 1.1: Vector Storage Schema
**File:** `migrations/0005_vector_support.sql`

Already have basic vector tables from Week 1, but need to add:
- Vector metadata indexing
- Dimension validation
- Vector normalization support

```sql
-- Enhance existing vectors table
ALTER TABLE vectors ADD COLUMN normalized BOOLEAN DEFAULT FALSE;
ALTER TABLE vectors ADD COLUMN model_name TEXT;
CREATE INDEX idx_vectors_collection ON vectors(collection);
CREATE INDEX idx_vectors_model ON vectors(model_name);
```

#### Task 1.2: Vector Storage Manager
**File:** `src/storage/VectorStore.ts`

Implement VectorStore class:
- Store vector embeddings in D1 BLOB fields
- Support dimensions up to 4096
- Metadata association (document_id, collection, model)
- CRUD operations for vectors

```typescript
class VectorStore {
  async insert(documentId, collection, vector, metadata)
  async find(documentId)
  async delete(documentId)
  async updateVector(documentId, newVector)
}
```

#### Task 1.3: Vector Utilities
**File:** `src/vector/utils.ts`

Helper functions:
- Vector normalization (L2 norm)
- Dimension validation
- Vector format conversion (Array ↔ BLOB)
- Batch vector operations

### Day 3-4: Similarity Search Algorithms

#### Task 2.1: Similarity Metrics
**File:** `src/vector/similarity.ts`

Implement similarity algorithms:
- **Cosine Similarity**: `cosine(a, b) = dot(a, b) / (||a|| * ||b||)`
- **Euclidean Distance**: `euclidean(a, b) = sqrt(sum((a - b)²))`
- **Dot Product**: `dot(a, b) = sum(a * b)`

```typescript
export function cosineSimilarity(a: number[], b: number[]): number
export function euclideanDistance(a: number[], b: number[]): number
export function dotProduct(a: number[], b: number[]): number
```

#### Task 2.2: Vector Search Engine
**File:** `src/vector/VectorSearch.ts`

Implement basic vector search:
- **Brute-force k-NN search** (MVP - sufficient for <10k vectors)
- Query vector against all stored vectors
- Return top-k most similar results
- Support filtering by collection/metadata

```typescript
class VectorSearch {
  async search(queryVector, options: {
    limit?: number,
    metric?: 'cosine' | 'euclidean' | 'dot',
    filter?: { collection?: string, metadata?: any }
  })
}
```

**Performance Note:** Brute-force is O(n*d) where n = vectors, d = dimensions.
For MVP with <10,000 vectors and 384-1536 dimensions, this is acceptable (<100ms).
Phase 2 will add ANN (Approximate Nearest Neighbor) with HNSW or IVF.

### Day 5: Workers AI Integration

#### Task 3.1: Embedding Generator
**File:** `src/ai/embeddings.ts`

Integrate Cloudflare Workers AI:
- Use `@cf/baai/bge-base-en-v1.5` model (768 dimensions)
- Generate embeddings from text
- Batch embedding generation
- Caching in KV for common queries

```typescript
class EmbeddingGenerator {
  async generateEmbedding(text: string): Promise<number[]>
  async generateBatch(texts: string[]): Promise<number[][]>
  async generateWithCache(text: string): Promise<number[]>
}
```

**Supported Models:**
- `@cf/baai/bge-base-en-v1.5` (768 dim) - Default
- `@cf/baai/bge-small-en-v1.5` (384 dim) - Faster, less accurate
- `@cf/baai/bge-large-en-v1.5` (1024 dim) - Slower, more accurate

#### Task 3.2: Auto-Embedding Pipeline
**File:** `src/ai/auto-embed.ts`

Automatic embedding generation:
- Watch document inserts/updates
- Extract text fields for embedding
- Generate and store vectors
- Optional: Enable/disable per collection

### Day 6: GraphQL API & MCP Foundation

#### Task 4.1: Vector GraphQL Schema
**File:** `src/graphql/schema.ts` (update)

Add vector types and operations:

```graphql
type Vector {
  id: ID!
  documentId: ID!
  collection: String!
  dimensions: Int!
  model: String!
  metadata: JSON
  createdAt: DateTime!
}

type VectorSearchResult {
  document: Document!
  similarity: Float!
  distance: Float!
}

input VectorSearchOptions {
  limit: Int
  metric: SimilarityMetric
  filter: JSON
}

enum SimilarityMetric {
  COSINE
  EUCLIDEAN
  DOT_PRODUCT
}

extend type Query {
  vectorSearch(
    collection: String!
    vector: [Float!]!
    options: VectorSearchOptions
  ): [VectorSearchResult!]!

  vectorSearchByText(
    collection: String!
    text: String!
    options: VectorSearchOptions
  ): [VectorSearchResult!]!
}

extend type Mutation {
  generateEmbedding(text: String!): [Float!]!

  addVectorToDocument(
    documentId: ID!
    vector: [Float!]!
    metadata: JSON
  ): Vector!
}
```

#### Task 4.2: Vector Resolvers
**File:** `src/graphql/resolvers.ts` (update)

Implement resolvers for vector operations.

#### Task 4.3: MCP Server Foundation
**File:** `src/mcp/server.ts`

Create basic MCP server:
- MCP 1.0 protocol implementation
- Tool registration
- Request/response handling
- Error handling

```typescript
class MCPServer {
  registerTool(name: string, handler: Function)
  async handleRequest(request: MCPRequest): Promise<MCPResponse>
}
```

#### Task 4.4: MCP Tools
**File:** `src/mcp/tools.ts`

Implement MCP tools:
- `search_documents`: Document search with filters
- `vector_search`: Semantic similarity search
- `store_memory`: Persist agent memories
- `retrieve_memory`: Fetch relevant memories

```typescript
export const mcpTools = {
  search_documents: async (params) => { /* ... */ },
  vector_search: async (params) => { /* ... */ },
  store_memory: async (params) => { /* ... */ },
  retrieve_memory: async (params) => { /* ... */ },
}
```

### Testing & Documentation

#### Task 5.1: Vector Search Tests
**File:** `tests/vector-search.test.ts`

Unit tests:
- Similarity metric correctness
- Vector normalization
- Search accuracy (known similar vectors)
- Performance benchmarks

#### Task 5.2: Integration Tests
**File:** `tests/integration/vector.test.ts`

Integration tests:
- End-to-end vector storage and search
- Workers AI embedding generation
- GraphQL vector operations
- MCP tool invocation

#### Task 5.3: Documentation
**File:** `docs/VECTOR_SEARCH.md`

Documentation:
- Vector search concepts
- Embedding generation
- Similarity metrics explained
- API usage examples
- Performance characteristics
- Future ANN implementation plan

## Success Criteria

✅ **Vector Storage:**
- Store and retrieve vectors up to 4096 dimensions
- Support for BLOB storage in D1
- Metadata association

✅ **Similarity Search:**
- Cosine, Euclidean, and Dot Product metrics
- k-NN search with configurable k
- <100ms search time for <10k vectors

✅ **Workers AI Integration:**
- Generate embeddings from text
- Multiple model support
- Batch generation capability

✅ **GraphQL API:**
- Vector search queries
- Text-to-vector search
- Vector operations (add, update, delete)

✅ **MCP Foundation:**
- Basic MCP server running
- 4+ tools implemented
- Compatible with MCP 1.0 clients

✅ **Testing:**
- 20+ unit tests for vector operations
- 10+ integration tests
- Performance benchmarks documented

✅ **Documentation:**
- Vector search guide
- API examples
- Performance characteristics

## Technical Decisions

### Why Brute-Force k-NN for MVP?

**Pros:**
- Simple implementation
- Exact results (no approximation)
- Sufficient for <10k vectors
- Easy to understand and debug

**Cons:**
- O(n*d) complexity
- Not scalable to millions of vectors

**Future:** Phase 2 will add ANN algorithms (HNSW, IVF) for scalability.

### Vector Storage in D1 vs KV vs R2

**D1 (Hot Tier):**
- Recently accessed vectors
- Active collections
- Fast BLOB retrieval

**KV (Warm Tier):**
- Less frequent access
- Compressed vectors
- Good for caching

**R2 (Cold Tier):**
- Archived vectors
- Batch processing
- Cost-effective storage

### Embedding Model Choice

**Default: bge-base-en-v1.5 (768 dim)**
- Good balance of speed and accuracy
- English language optimized
- Proven performance

**Alternative: bge-small-en-v1.5 (384 dim)**
- Faster generation
- Lower storage requirements
- Acceptable for simple use cases

## Performance Targets

- Vector insert: <50ms
- Vector search (1k vectors): <30ms
- Vector search (10k vectors): <100ms
- Embedding generation: <200ms per text
- Batch embedding (10 texts): <500ms

## Risks & Mitigation

**Risk:** Workers AI rate limits
**Mitigation:** KV caching, batch operations, fallback to client-provided embeddings

**Risk:** D1 BLOB size limits
**Mitigation:** Vector quantization (Phase 2), R2 overflow for large vectors

**Risk:** Poor search performance with many vectors
**Mitigation:** Document performance, set expectations, plan for ANN in Phase 2

## Dependencies

- Cloudflare Workers AI binding (already configured)
- D1 BLOB support (available)
- MCP protocol specification (https://spec.modelcontextprotocol.io)

## Next Steps After Week 4

Week 4 completes Phase 1 MVP. Next priorities:
1. JavaScript SDK (Phase 1 remaining item)
2. ANN vector search (Phase 2)
3. Multi-region replication (Phase 2)
4. Time series data management
5. Real-time subscriptions (Phase 5)

## Resources

- MCP Specification: https://spec.modelcontextprotocol.io
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/
- Vector similarity metrics: Standard algorithms
- SQLite BLOB storage: D1 documentation
