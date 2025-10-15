# Vector Search Documentation

**EdgeVector DB** - Comprehensive Vector Search System

## Overview

EdgeVector DB includes a production-ready vector search system with semantic similarity search, multiple distance metrics, and automatic embedding generation using Cloudflare Workers AI.

## Table of Contents

1. [Architecture](#architecture)
2. [Vector Storage](#vector-storage)
3. [Similarity Metrics](#similarity-metrics)
4. [Vector Search](#vector-search)
5. [Embedding Generation](#embedding-generation)
6. [GraphQL API](#graphql-api)
7. [Performance](#performance)
8. [Use Cases](#use-cases)
9. [Best Practices](#best-practices)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    GraphQL API Layer                     │
│         (Query & Mutation Resolvers)                    │
└────────────────────┬────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───────┐  ┌────▼──────┐  ┌─────▼────────┐
│  Vector   │  │  Vector   │  │  Embedding   │
│  Store    │  │  Search   │  │  Generator   │
└───────────┘  └───────────┘  └──────────────┘
     │              │                │
     │         ┌────▼────┐          │
     │         │Similarity│         │
     │         │ Metrics │         │
     │         └─────────┘         │
     │                              │
     └──────────┬──────────────────┘
                │
        ┌───────▼────────┐
        │  D1 Database   │
        │  (SQLite)      │
        └────────────────┘
                │
        ┌───────▼────────┐
        │ Cloudflare     │
        │ Workers AI     │
        └────────────────┘
```

### Data Flow

1. **Text Input** → Embedding Generation → Vector
2. **Vector** → Vector Search → Similarity Calculation
3. **Results** → Ranking → Top-K Results

## Vector Storage

### Schema

Vectors are stored in D1 with the following schema:

```sql
CREATE TABLE vectors (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  vector BLOB NOT NULL,
  dimensions INTEGER NOT NULL,
  model_name TEXT NOT NULL,
  normalized BOOLEAN NOT NULL DEFAULT 1,
  metadata JSON,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(_id) ON DELETE CASCADE
);
```

### Features

- **BLOB Storage**: Vectors stored as binary data (Float32Array)
- **Dimensions**: Support for up to 4096 dimensions
- **Normalization**: Automatic L2 normalization
- **Metadata**: Flexible JSON metadata for filtering
- **Collection Organization**: Vectors grouped by collection
- **Model Tracking**: Records which embedding model generated the vector

### Storage Formats

**Float32 (Default)**:
- 4 bytes per dimension
- Full precision
- Example: 768D vector = 3.072 KB

**Uint8 (Quantized)**:
- 1 byte per dimension
- 75% storage savings
- Minimal accuracy loss
- Example: 768D vector = 768 bytes

## Similarity Metrics

### Supported Metrics

#### 1. Cosine Similarity (Default)

Measures the angle between two vectors.

```
cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)
```

- **Range**: [-1, 1]
- **Higher is better**: 1 = identical direction
- **Use case**: Text similarity, semantic search
- **Normalized vectors**: Equivalent to dot product

#### 2. Euclidean Distance

Straight-line distance between vectors.

```
euclidean_distance(A, B) = √(Σ(Ai - Bi)²)
```

- **Range**: [0, ∞)
- **Lower is better**: 0 = identical vectors
- **Use case**: Image similarity, general purpose

#### 3. Dot Product

Raw inner product of vectors.

```
dot_product(A, B) = Σ(Ai × Bi)
```

- **Range**: (-∞, ∞)
- **Higher is better** for normalized vectors
- **Use case**: Fast similarity for normalized vectors

#### 4. Manhattan Distance

Sum of absolute differences (L1 distance).

```
manhattan_distance(A, B) = Σ|Ai - Bi|
```

- **Range**: [0, ∞)
- **Lower is better**: 0 = identical vectors
- **Use case**: High-dimensional sparse vectors

#### 5. Squared Euclidean Distance

Euclidean distance without square root (faster).

```
squared_euclidean_distance(A, B) = Σ(Ai - Bi)²
```

- **Range**: [0, ∞)
- **Lower is better**
- **Use case**: Performance-critical applications

#### 6. Cosine Distance

Distance metric derived from cosine similarity.

```
cosine_distance(A, B) = 1 - cosine_similarity(A, B)
```

- **Range**: [0, 2]
- **Lower is better**: 0 = identical direction
- **Use case**: When distance metrics are preferred

### Metric Selection Guide

| Use Case | Recommended Metric | Reason |
|----------|-------------------|---------|
| Text similarity | Cosine | Direction matters more than magnitude |
| Image similarity | Euclidean | Pixel differences matter |
| Fast search | Dot product | Skip normalization step |
| Sparse vectors | Manhattan | Less sensitive to zeros |
| Ranking only | Squared Euclidean | Avoid sqrt computation |

## Vector Search

### Algorithm

EdgeVector uses **brute-force k-NN search** (O(n×d) complexity):

1. Fetch all vectors matching filters
2. Compute similarity/distance to query vector
3. Sort by score
4. Return top-k results

**Characteristics**:
- **Exact results**: No approximation
- **Performance**: <100ms for <10k vectors
- **Scalability**: Best for up to 100k vectors per collection

### Search Options

```typescript
interface VectorSearchOptions {
  collection?: string;      // Filter by collection
  limit?: number;          // Top-k results (default: 10)
  metric?: SimilarityMetric; // Similarity metric (default: cosine)
  threshold?: number;       // Minimum score (0-1)
  metadata?: Record<string, any>; // Metadata filters
  modelName?: string;       // Filter by embedding model
}
```

### Search Process

**By Vector**:
1. Validate vector dimensions
2. Apply filters (collection, model, metadata)
3. Compute similarities
4. Filter by threshold
5. Rank and return top-k

**By Text**:
1. Generate embedding from text
2. Execute vector search

### Filtering

**Collection Filtering**:
```graphql
query {
  vectorSearch(
    vector: [0.1, 0.2, ...]
    options: { collection: "articles" }
  ) {
    results { ... }
  }
}
```

**Metadata Filtering**:
```graphql
query {
  vectorSearch(
    vector: [0.1, 0.2, ...]
    options: {
      metadata: { category: "tech", language: "en" }
    }
  ) {
    results { ... }
  }
}
```

**Threshold Filtering**:
```graphql
query {
  vectorSearchByText(
    query: "machine learning"
    options: { threshold: 0.8 }
  ) {
    results {
      score  # Only results with score >= 0.8
      vector { documentId }
    }
  }
}
```

## Embedding Generation

### Cloudflare Workers AI Integration

EdgeVector uses **BGE (BAAI General Embedding)** models from Cloudflare Workers AI.

### Supported Models

| Model | Dimensions | Speed | Accuracy | Use Case |
|-------|-----------|-------|----------|----------|
| `bge-small-en-v1.5` | 384 | Fastest | Good | Real-time, mobile |
| `bge-base-en-v1.5` | 768 | Balanced | Better | General purpose (default) |
| `bge-large-en-v1.5` | 1024 | Slower | Best | High accuracy required |

### Features

**KV Caching**:
- 24-hour TTL
- Automatic cache management
- Reduces API calls and latency

**Batch Generation**:
- Process multiple texts efficiently
- Reduces round trips
- Up to 10 texts per batch

**Automatic Normalization**:
- Vectors normalized by default
- Ensures consistent similarity scores

### Example Usage

**Single Embedding**:
```typescript
const result = await client.vectors.generateEmbedding(
  'machine learning algorithms',
  {
    model: 'bge-base',
    normalize: true,
    useCache: true
  }
);
// result.embedding: number[]
// result.dimensions: 768
// result.cached: boolean
```

**Batch Embeddings**:
```typescript
const results = await client.vectors.generateEmbeddingBatch(
  ['document 1', 'document 2', 'document 3'],
  { model: 'bge-large' }
);
// results: EmbeddingResult[]
```

## GraphQL API

### Queries

#### vectorSearch

Search by vector embedding.

```graphql
query VectorSearch {
  vectorSearch(
    vector: [0.1, 0.2, 0.3, ...]
    options: {
      collection: "articles"
      limit: 10
      metric: COSINE
      threshold: 0.7
    }
  ) {
    results {
      vector {
        id
        documentId
        collection
        dimensions
        modelName
        metadata
      }
      score
      distance
    }
    stats {
      totalVectors
      searchTimeMs
    }
  }
}
```

#### vectorSearchByText

Semantic search from text query.

```graphql
query SemanticSearch {
  vectorSearchByText(
    query: "artificial intelligence and machine learning"
    options: {
      collection: "articles"
      limit: 5
      metric: COSINE
      threshold: 0.8
    }
  ) {
    results {
      vector {
        documentId
        metadata
      }
      score
    }
    stats {
      searchTimeMs
    }
  }
}
```

#### compareSimilarity

Compare similarity between two texts.

```graphql
query Compare {
  compareSimilarity(
    text1: "machine learning"
    text2: "artificial intelligence"
    metric: COSINE
  ) {
    similarity
    metric
  }
}
```

#### vectorCollectionStats

Get statistics for a collection.

```graphql
query Stats {
  vectorCollectionStats(collection: "articles") {
    collection
    totalVectors
    dimensions
    models
  }
}
```

### Mutations

#### generateEmbedding

Generate embedding from text.

```graphql
mutation Generate {
  generateEmbedding(
    text: "machine learning algorithms"
    model: BGE_BASE
    normalize: true
  ) {
    embedding
    dimensions
    model
    cached
  }
}
```

#### addVectorToDocument

Add vector to existing document.

```graphql
mutation AddVector {
  addVectorToDocument(
    collection: "articles"
    documentId: "doc123"
    vector: [0.1, 0.2, ...]
    metadata: { source: "manual" }
  )
}
```

#### deleteVector

Delete vector for document.

```graphql
mutation DeleteVector {
  deleteVector(
    collection: "articles"
    documentId: "doc123"
  ) {
    deletedCount
    acknowledged
  }
}
```

## Performance

### Benchmarks

| Operation | Vectors | Time | Throughput |
|-----------|---------|------|------------|
| Vector insert | 1 | <50ms | 20/sec |
| Vector search | 1,000 | <30ms | 33 searches/sec |
| Vector search | 10,000 | <100ms | 10 searches/sec |
| Embedding generation | 1 text | <200ms | 5/sec |
| Batch embedding | 10 texts | <500ms | 20/sec |

### Optimization Tips

**1. Use Normalized Vectors**:
- Enables faster dot product similarity
- Eliminates magnitude calculation

**2. Collection Partitioning**:
- Split large datasets into collections
- Search specific collections only

**3. Metadata Indexing**:
- Use metadata filters to reduce search space
- Pre-filter before similarity calculation

**4. Embedding Caching**:
- Enable KV caching for repeated queries
- 24-hour TTL reduces API calls

**5. Appropriate Metrics**:
- Dot product fastest for normalized vectors
- Squared Euclidean avoids sqrt
- Manhattan for sparse vectors

**6. Batch Operations**:
- Generate embeddings in batches
- Reduces network overhead

## Use Cases

### 1. Semantic Document Search

**Scenario**: Search articles by meaning, not keywords.

```typescript
// Search for articles about AI
const results = await client.vectors.searchByText(
  'artificial intelligence and neural networks',
  {
    collection: 'articles',
    limit: 10,
    threshold: 0.7
  }
);
```

### 2. Content Recommendation

**Scenario**: Find similar articles to recommend.

```typescript
// Get vector for current article
const currentVector = await client.vectors.get('articles', 'doc123');

// Find similar articles
const similar = await client.vectors.searchByVector(
  currentVector.vector,
  {
    collection: 'articles',
    limit: 5
  }
);
```

### 3. Duplicate Detection

**Scenario**: Find duplicate or near-duplicate content.

```typescript
const results = await client.vectors.searchByText(
  documentText,
  {
    threshold: 0.95, // High threshold for near-duplicates
    limit: 10
  }
);
```

### 4. Multilingual Search

**Scenario**: Search across languages using semantic meaning.

```typescript
// Search in English, find results in any language
const results = await client.vectors.searchByText(
  'machine learning tutorial',
  {
    collection: 'multilingual_docs',
    limit: 20
  }
);
```

### 5. Image Search by Description

**Scenario**: Find images based on text descriptions.

```typescript
// Search images by description
const results = await client.vectors.searchByText(
  'sunset over mountains',
  {
    collection: 'image_embeddings',
    metric: 'euclidean'
  }
);
```

### 6. Question Answering

**Scenario**: Find relevant documents to answer questions.

```typescript
const results = await client.vectors.searchByText(
  'How does machine learning work?',
  {
    collection: 'knowledge_base',
    threshold: 0.8,
    limit: 3
  }
);
```

## Best Practices

### 1. Embedding Strategy

**Consistency**:
- Use same model for indexing and search
- Don't mix embedding models in same collection

**Model Selection**:
- `bge-small`: Real-time applications, mobile apps
- `bge-base`: General purpose, balanced performance
- `bge-large`: High accuracy, offline processing

### 2. Vector Normalization

**Always normalize** for cosine similarity:
```typescript
const embedding = await generateEmbedding(text, {
  normalize: true
});
```

**Benefits**:
- Consistent similarity scores
- Faster dot product similarity
- Better ranking

### 3. Collection Organization

**Partition by**:
- Content type (articles, products, images)
- Language (en, es, fr)
- Domain (tech, health, finance)

**Benefits**:
- Faster search (fewer vectors)
- Better relevance (domain-specific)
- Easier management

### 4. Metadata Usage

**Store useful metadata**:
```typescript
await client.vectors.add(collection, documentId, embedding, {
  title: 'Article Title',
  category: 'tech',
  language: 'en',
  published: '2025-01-01',
  author: 'John Doe'
});
```

**Use for filtering**:
```typescript
const results = await searchByText(query, {
  metadata: {
    category: 'tech',
    language: 'en'
  }
});
```

### 5. Threshold Tuning

**Recommended thresholds** (cosine similarity):
- **0.9-1.0**: Near-duplicates
- **0.8-0.9**: Highly similar
- **0.7-0.8**: Moderately similar
- **0.5-0.7**: Somewhat related
- **<0.5**: Weakly related

**Test and adjust** based on your use case.

### 6. Error Handling

```typescript
try {
  const results = await client.vectors.searchByText(query);
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid input
  } else if (error instanceof NetworkError) {
    // Retry with backoff
  } else {
    // Log and handle
  }
}
```

### 7. Monitoring

**Track metrics**:
- Search latency
- Embedding generation time
- Cache hit rate
- Result relevance (user feedback)

**Optimize based on data**:
- Adjust thresholds
- Partition collections
- Update models

## Future Enhancements

### Planned Features

1. **ANN (Approximate Nearest Neighbors)**:
   - HNSW algorithm for faster search
   - Trade accuracy for speed
   - Support for millions of vectors

2. **Vector Quantization**:
   - PQ (Product Quantization)
   - Scalar quantization
   - 8x-10x storage reduction

3. **Hybrid Search**:
   - Combine vector + keyword search
   - Reciprocal Rank Fusion
   - Better relevance

4. **Multi-Vector Documents**:
   - Multiple vectors per document
   - Chunk-level embeddings
   - Better long-document support

5. **Online Learning**:
   - Update vectors from user feedback
   - Personalized embeddings
   - Adaptive ranking

## Resources

- **GitHub**: https://github.com/Andrejs1979/EdgeVector
- **API Documentation**: docs/API.md
- **SDK Documentation**: sdk/README.md
- **Quick Start**: docs/QUICK_START.md

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/Andrejs1979/EdgeVector/issues
- Documentation: https://edgevector.dev/docs

---

**EdgeVector DB** - Edge-native database with production-ready vector search
