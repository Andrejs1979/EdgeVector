# EdgeVector DB Setup Guide

This guide walks you through setting up EdgeVector DB for development and production.

## Prerequisites

- Node.js 18+ or Bun
- Cloudflare account (for production deployment)
- Wrangler CLI 3.96.0+

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Local D1 Database

```bash
# This creates a local SQLite database for development
npx wrangler d1 execute edgevector-db --local --file=./migrations/0001_initial_schema.sql
npx wrangler d1 execute edgevector-db --local --file=./migrations/0002_vector_indexes.sql
npx wrangler d1 execute edgevector-db --local --file=./migrations/0003_real_time.sql
```

### 3. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:8787`

Test the health endpoint:
```bash
curl http://localhost:8787/health
```

## Production Setup

### 1. Login to Cloudflare

```bash
npx wrangler login
```

### 2. Create Production D1 Database

```bash
# Create the D1 database
npx wrangler d1 create edgevector-db

# Copy the database_id from the output and update wrangler.toml
# Replace "placeholder-id" with your actual database_id
```

Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "edgevector-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Apply Migrations

```bash
# Apply all migrations to production
npx wrangler d1 execute edgevector-db --file=./migrations/0001_initial_schema.sql
npx wrangler d1 execute edgevector-db --file=./migrations/0002_vector_indexes.sql
npx wrangler d1 execute edgevector-db --file=./migrations/0003_real_time.sql
```

### 4. Create KV Namespaces

```bash
# Create KV namespaces for cache and metadata
npx wrangler kv:namespace create "CACHE"
npx wrangler kv:namespace create "METADATA"

# Update wrangler.toml with the returned IDs
```

### 5. Create R2 Bucket

```bash
# Create R2 bucket for cold storage
npx wrangler r2 bucket create edgevector-cold-storage
```

### 6. Deploy to Production

```bash
npm run deploy
```

## Environment-Specific Deployment

### Staging

```bash
# Deploy to staging environment
npx wrangler deploy --env staging
```

### Production

```bash
# Deploy to production
npx wrangler deploy --env production
```

## Database Management

### Run Queries Locally

```bash
npx wrangler d1 execute edgevector-db --local --command="SELECT * FROM collections"
```

### Run Queries in Production

```bash
npx wrangler d1 execute edgevector-db --command="SELECT * FROM collections"
```

### Backup Database

```bash
# Export database to SQL
npx wrangler d1 export edgevector-db --output=backup.sql
```

### Restore Database

```bash
# Import from SQL file
npx wrangler d1 execute edgevector-db --file=backup.sql
```

## Durable Objects Setup

Durable Objects are automatically configured in `wrangler.toml`. No additional setup required for local development.

For production, ensure your Cloudflare Workers plan supports Durable Objects (Workers Paid plan required).

## Troubleshooting

### Local Database Not Found

If you get "database not found" errors locally:
```bash
# Delete local state and recreate
rm -rf .wrangler/state
npx wrangler d1 execute edgevector-db --local --file=./migrations/0001_initial_schema.sql
```

### Migration Errors

If migrations fail:
```bash
# Check existing tables
npx wrangler d1 execute edgevector-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"

# Drop all tables and reapply (CAUTION: destroys data)
npx wrangler d1 execute edgevector-db --local --command="DROP TABLE IF EXISTS documents"
```

### Wrangler Login Issues

If `wrangler login` fails:
```bash
# Use API token authentication instead
export CLOUDFLARE_API_TOKEN=your_api_token
```

## Next Steps

After setup:
1. Review the [Architecture Documentation](./CLAUDE.md)
2. Check out [Example Applications](./examples)
3. Read the [API Documentation](./docs/api.md) (coming soon)
4. Join our community (coming soon)

## Development Workflow

```bash
# Make changes to code
# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint:fix

# Test locally
npm run dev

# Deploy to staging for testing
npx wrangler deploy --env staging

# Deploy to production
npm run deploy
```

## Monitoring

After deployment, monitor your Workers at:
- Cloudflare Dashboard: https://dash.cloudflare.com
- Workers Analytics: View metrics, errors, and performance
- Logs: `npx wrangler tail` for real-time logs
