# EdgeVector DB

Edge-native database platform built on Cloudflare infrastructure, combining schema-free document storage, vector search, time series data management, and real-time streaming capabilities.

## Features

- **Schema-Free Documents**: MongoDB-like document storage without migrations
- **Vector Search**: AI-powered semantic search with embeddings
- **Time Series**: Optimized storage and querying for time-stamped data
- **Real-Time Streaming**: SSE and WebSocket support for live updates
- **Edge-Native**: Globally distributed on Cloudflare's network
- **GraphQL API**: Type-safe, flexible query interface
- **MCP Support**: Native Model Context Protocol for AI agents (coming soon)

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Cloudflare account
- Wrangler CLI installed globally

### Installation

```bash
# Install dependencies
npm install

# Create D1 database
npm run db:create

# Apply database migrations
npm run db:migrations:apply

# Start development server
npm run dev
```

### Development

```bash
# Run development server with live reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test:coverage

# Type checking
npm run typecheck

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Deployment

```bash
# Deploy to production
npm run deploy

# Deploy to staging
wrangler deploy --env staging
```

## Project Structure

```
edgevector-db/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types/             # TypeScript type definitions
│   ├── graphql/           # GraphQL schema and resolvers
│   ├── storage/           # Storage layer (documents, vectors, time series)
│   ├── query/             # Query translation and optimization
│   ├── sharding/          # Shard management and routing
│   ├── real-time/         # SSE and WebSocket handlers
│   ├── durable-objects/   # Durable Object implementations
│   └── utils/             # Shared utilities
├── migrations/            # D1 database migrations
├── tests/                 # Test files
├── wrangler.toml         # Cloudflare Workers configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Architecture

EdgeVector DB leverages Cloudflare's edge infrastructure:

- **Workers**: Compute layer for query processing
- **D1**: SQLite-based database with 10GB per instance
- **Durable Objects**: Coordination and state management
- **KV**: Caching and warm storage tier
- **R2**: Cold storage for large objects
- **Workers AI**: Embedding generation

### Sharding Strategy

To overcome D1's 10GB limit, EdgeVector uses tenant-based sharding:
- Each tenant can span multiple D1 databases
- Automatic shard creation and routing
- Transparent cross-shard queries

### Tiered Storage

```
Hot Tier (D1)  → Recently accessed, performance-critical
Warm Tier (KV) → Less frequent access, compressed
Cold Tier (R2) → Archival data, highly compressed
```

## Documentation

- **[Quick Start Guide](./docs/QUICK_START.md)** - Get started in 5 minutes
- **[API Documentation](./docs/API.md)** - Complete GraphQL API reference
- **[Authentication Guide](./docs/AUTHENTICATION.md)** - JWT auth flows and security
- [Architecture Guide](./CLAUDE.md) - System architecture and design decisions
- [Setup Instructions](./SETUP.md) - Detailed setup and configuration
- [Project Status](./PROJECT_STATUS.md) - Current progress and metrics

## License

MIT

## Contributing

This project is currently in early development. Contribution guidelines coming soon.
