# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EdgeVector DB is a globally distributed, edge-native database platform built on Cloudflare's infrastructure. It combines:
- NoSQL document storage with MongoDB-like schema-free architecture
- Vector search capabilities for AI applications
- Time series data management
- Real-time streaming via SSE and WebSocket
- Model Context Protocol (MCP) support for AI agents

The platform is designed to overcome traditional database limitations by leveraging Cloudflare Workers, D1 (SQLite), Durable Objects, R2, KV, and Queues.

## Technology Stack

**Cloudflare Infrastructure:**
- **Workers**: Compute layer for query processing and API endpoints
- **D1**: Core SQL engine (SQLite) with 10GB per database limit
- **Durable Objects**: Coordination, state management, vector indexes, agent sessions
- **R2**: Blob storage for large objects and cold data tier
- **KV**: Metadata, cache storage, and warm data tier
- **Queues**: Async processing and inter-agent messaging
- **Workers AI**: Embedding generation

**APIs & Protocols:**
- GraphQL (required - no REST APIs)
- Model Context Protocol (MCP) 1.0
- WebSocket for real-time bi-directional streaming
- Server-Sent Events (SSE) for real-time updates

**SDKs (planned):**
- JavaScript/TypeScript (primary)
- Python
- Go
- Rust

## Core Architecture Principles

### 1. Schema-Free Design
The database implements a MongoDB-like schema-free approach:
- No SQL migrations required
- Documents stored in JSON with dynamic field indexing
- Frequently queried fields automatically promoted to indexed columns
- Query pattern analyzer suggests indexes based on usage
- Zero-downtime schema evolution

### 2. Tiered Storage Strategy
```
Hot Tier (D1): Recently accessed, performance-critical data
Warm Tier (KV): Less frequent access, compressed
Cold Tier (R2): Archival data, highly compressed
```

### 3. Horizontal Sharding
To overcome D1's 10GB limit:
- **Tenant-based sharding**: Each tenant gets dedicated D1 instance(s)
- **Key-range sharding**: Distribute data by primary key ranges with consistent hashing
- **Geographic sharding**: Shard by region for compliance and latency
- **Time-based sharding**: New shard per time period (for time series)

### 4. Hybrid Data Models
Single unified API for querying:
- Structured data (SQL via D1)
- Document store (MongoDB-like queries)
- Vector embeddings (ANN search with cosine, euclidean, dot product)
- Time series (specialized columnar storage with Gorilla compression)

### 5. Real-Time First
- Server-Sent Events for one-way streaming
- WebSocket for bi-directional communication
- Live queries that update automatically
- Change Data Capture (CDC) streams
- Stream processing with windowing and joins

## Development Commands

**Note:** This is currently a greenfield project. Development commands will be added as the implementation progresses.

### Planned Development Workflow
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy

# Run tests
npm test

# Run specific test suite
npm test -- <pattern>
```

## Key Implementation Patterns

### Document Storage
Documents are stored in a universal table with dynamic indexing:
```sql
CREATE TABLE documents (
    _id TEXT PRIMARY KEY,
    _collection TEXT NOT NULL,
    _data JSON NOT NULL,
    _idx_field_1 TEXT,  -- Dynamically managed
    _idx_field_2 REAL,
    -- ... more indexed fields
    _vector BLOB,
    _search_text TEXT
);
```

### Query Translation Layer
MongoDB-style queries are translated to SQL:
- Indexed fields use SQL WHERE clauses for performance
- Non-indexed fields use JSON queries
- Automatic field promotion based on query patterns

### Vector Search Architecture
```
Query Vector
    ↓
Hot Vectors (D1 shards) ← Parallel search
    ↓
Warm Vectors (KV) ← If needed
    ↓
Cold Vectors (R2) ← Fallback
    ↓
Merge & Rank Results
```

### Time Series Storage
- Ingestion via batch API or WebSocket streaming
- Automatic downsampling with configurable retention
- Gorilla compression for timestamps and values (12.5:1 ratio typical)
- Time-based sharding for efficient range queries

### MCP Integration
The database provides native MCP tools for AI agents:
- `query_structured`: SQL query execution
- `search_documents`: Document search with filters
- `vector_search`: Semantic similarity search
- `hybrid_search`: Combined search across all data types
- `store_memory`: Persist agent memories
- `retrieve_memory`: Fetch relevant memories
- `query_timeseries`: Time series data queries

### Real-Time Subscriptions
```javascript
// Live query subscription
const sub = await db.subscribe({
  query: "SELECT * FROM sensors WHERE temp > 25",
  onChange: (results) => updateUI(results)
});

// Document change subscription
const docSub = await db.documents.subscribe({
  collection: 'orders',
  filter: { status: 'pending' },
  onEvent: (event) => handleChange(event)
});
```

## Critical Constraints

1. **D1 Limitations:**
   - 10GB per database (use sharding for larger)
   - 1000 databases per account
   - Must implement tiered storage for scale

2. **GraphQL Only:**
   - Do NOT build REST APIs
   - All external APIs must be GraphQL

3. **Schema-Free Philosophy:**
   - No migrations required
   - Support dynamic field addition
   - Automatic index management

4. **Edge-First Design:**
   - Optimize for global distribution
   - Minimize latency through edge compute
   - Use Cloudflare Workers for all compute

5. **Real-Time Capabilities:**
   - Support SSE for one-way streaming
   - WebSocket for bi-directional
   - Sub-10ms event delivery latency target

## Implementation Phases

**Phase 1 (Months 1-3):** MVP
- Basic D1 integration
- Document storage
- Simple vector search
- GraphQL API
- JavaScript SDK

**Phase 2 (Months 4-6):** Enhanced
- Advanced vector search (ANN)
- Multi-region replication
- Python/Go SDKs
- Basic MCP server
- Web console

**Phase 3 (Months 7-9):** Enterprise
- Security certifications
- Advanced access controls
- Full MCP 1.0 compliance
- Agent workflow engine
- Migration tools

**Phase 4 (Months 10-12):** AI Platform
- Native AI model integration
- Advanced agent memory types
- Agent marketplace
- Real-time streaming

**Phase 5 (Months 13-15):** Real-Time
- SSE infrastructure
- WebSocket support
- Basic subscriptions
- Streaming APIs

**Phase 6 (Months 16-18):** Advanced Streaming
- Complex event processing
- Stream joins and windows
- CDC implementation
- Stream analytics

## Performance Targets

- <1ms read latency at edge
- <10ms write latency globally
- <10ms p99 latency globally
- 1M+ queries per second per database
- 100M+ vectors with maintained performance
- <100ms MCP tool execution time
- 1M data points/second time series ingestion
- <10ms event delivery latency (SSE/WebSocket)
- 99.99% availability SLA

## Security & Compliance

- Row-level security (RLS)
- API key and JWT authentication
- OAuth2/OIDC integration
- Data residency controls
- GDPR-compliant data deletion
- Encryption at rest and in transit
- SOC2, HIPAA, PCI compliance targets

## Important Notes

- This is a greenfield project - the codebase structure will emerge during implementation
- All deployment must use Cloudflare Workers (not Cloudflare Pages)
- Vector quantization reduces storage by 75% (Float32 → Uint8)
- Time series data uses three-tier storage (hot/warm/cold)
- MCP agents can coordinate via Queues for multi-agent workflows
- Query pattern analyzer runs in background to optimize indexes
- Shard manager handles automatic splitting when approaching 10GB limit

## Related Documentation

See `edgevector-db-prd.md` for comprehensive product requirements, use cases, and detailed technical specifications.
