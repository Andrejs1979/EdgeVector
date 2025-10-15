# EdgeVector DB - Quick Start Guide

Get started with EdgeVector DB in 5 minutes.

## 1. Start the Server

```bash
# Development
npm run dev

# Production
npm run deploy
```

Server runs at: `http://localhost:8787` (development)

## 2. Register a User

```bash
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation Register($input: RegisterInput!) { register(input: $input) { token user { id email } } }",
    "variables": {
      "input": {
        "email": "user@example.com",
        "password": "password123",
        "name": "Your Name"
      }
    }
  }'
```

**Save the token** from the response!

## 3. Create a Collection

```bash
TOKEN="your_token_here"

curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { createCollection(name: \"todos\") { id name } }"
  }'
```

## 4. Insert a Document

```bash
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation InsertTodo($doc: JSON!) { insertOne(collection: \"todos\", document: $doc) { _id } }",
    "variables": {
      "doc": {
        "title": "Learn EdgeVector DB",
        "completed": false,
        "priority": "high"
      }
    }
  }'
```

## 5. Query Documents

```bash
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "query { find(collection: \"todos\", filter: { \"completed\": false }) { documents { data } count } }"
  }'
```

## Common Operations

### Update a Document

```graphql
mutation {
  updateOne(
    collection: "todos"
    filter: { "title": "Learn EdgeVector DB" }
    update: { "$set": { "completed": true } }
  ) {
    modifiedCount
  }
}
```

### Delete a Document

```graphql
mutation {
  deleteOne(
    collection: "todos"
    filter: { "completed": true }
  ) {
    deletedCount
  }
}
```

### Count Documents

```graphql
query {
  count(collection: "todos", filter: { "completed": false })
}
```

## Query Filters

EdgeVector DB supports MongoDB-style query operators:

```graphql
# Equal
{ "status": "active" }

# Comparison
{ "age": { "$gte": 18 } }

# In array
{ "category": { "$in": ["electronics", "computers"] } }

# Logical AND
{
  "$and": [
    { "price": { "$gte": 10 } },
    { "price": { "$lte": 100 } }
  ]
}

# Logical OR
{
  "$or": [
    { "status": "active" },
    { "priority": "high" }
  ]
}

# Regex
{ "email": { "$regex": "@example\\.com$" } }

# Field exists
{ "phoneNumber": { "$exists": true } }
```

## Rate Limits

| Status | GraphQL | Health |
|--------|---------|--------|
| Unauthenticated | 100/min | 300/min |
| Authenticated | 500/min | 300/min |

Check headers:
- `X-RateLimit-Remaining`: Requests left
- `X-RateLimit-Reset`: When limit resets

## GraphQL Playground

Visit `http://localhost:8787/graphql` in your browser for an interactive GraphQL playground.

## Next Steps

- Read full [API Documentation](./API.md)
- See [Authentication Guide](./AUTHENTICATION.md)
- Check [Examples](../examples/)
- Review [CLAUDE.md](../CLAUDE.md) for architecture details

## Need Help?

- GitHub: https://github.com/Andrejs1979/EdgeVector
- Issues: https://github.com/Andrejs1979/EdgeVector/issues
