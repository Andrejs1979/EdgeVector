# Authentication Guide

EdgeVector DB uses JWT (JSON Web Token) authentication to secure API access.

## Table of Contents

- [Overview](#overview)
- [Registration](#registration)
- [Login](#login)
- [Using Tokens](#using-tokens)
- [Token Refresh](#token-refresh)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

### Authentication Flow

```
1. User registers or logs in
   ↓
2. Server generates JWT token (24-hour expiration)
   ↓
3. Client stores token securely
   ↓
4. Client includes token in Authorization header
   ↓
5. Server validates token on each request
   ↓
6. Access granted to protected resources
```

### Token Structure

JWT tokens contain:
- **sub** (subject): User ID
- **email**: User email address
- **name**: User display name (optional)
- **iat** (issued at): Token creation timestamp
- **exp** (expiration): Token expiration timestamp (24 hours)
- **iss** (issuer): "edgevector-db"

### Token Format

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTc2MDUyNTA3NiwiZXhwIjoxNzYwNjExNDc2LCJpc3MiOiJlZGdldmVjdG9yLWRiIn0.signature
```

Parts:
1. **Header**: Algorithm and token type
2. **Payload**: User data and claims
3. **Signature**: HMAC-SHA256 signature

## Registration

### Endpoint

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

### Input Requirements

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| email | String | Yes | Valid email format, unique |
| password | String | Yes | Minimum 8 characters |
| name | String | No | Display name |

### Example Request

```javascript
const response = await fetch('http://localhost:8787/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `
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
    `,
    variables: {
      input: {
        email: 'user@example.com',
        password: 'securepassword123',
        name: 'John Doe'
      }
    }
  })
});

const data = await response.json();
const token = data.data.register.token;

// Store token securely
localStorage.setItem('edgevector_token', token);
```

### Response

**Success (200 OK):**
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

**Error - Email Already Exists:**
```json
{
  "errors": [
    {
      "message": "User with this email already exists"
    }
  ]
}
```

**Error - Weak Password:**
```json
{
  "errors": [
    {
      "message": "Password must be at least 8 characters long"
    }
  ]
}
```

## Login

### Endpoint

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

### Example Request

```javascript
const response = await fetch('http://localhost:8787/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
          user {
            id
            email
            name
          }
        }
      }
    `,
    variables: {
      input: {
        email: 'user@example.com',
        password: 'securepassword123'
      }
    }
  })
});

const data = await response.json();
const token = data.data.login.token;
```

### Response

**Success:**
```json
{
  "data": {
    "login": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "user_1760525076782_w7i04a17a7c",
        "email": "user@example.com",
        "name": "John Doe",
        "createdAt": "2025-10-15T10:44:36.782Z"
      }
    }
  }
}
```

**Error - Invalid Credentials:**
```json
{
  "errors": [
    {
      "message": "Invalid email or password"
    }
  ]
}
```

**Error - Account Deactivated:**
```json
{
  "errors": [
    {
      "message": "Account is deactivated"
    }
  ]
}
```

## Using Tokens

### Authorization Header

Include the token in the `Authorization` header with the `Bearer` scheme:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### JavaScript Example

```javascript
const token = localStorage.getItem('edgevector_token');

const response = await fetch('http://localhost:8787/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: `
      query {
        me {
          id
          email
          name
        }
      }
    `
  })
});
```

### cURL Example

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "query { me { id email name } }"
  }'
```

### Protected Endpoints

The following queries/mutations require authentication:

- `query { me }` - Get current user profile
- Any mutations that modify data (optional but recommended)

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

**Response:**
```json
{
  "data": {
    "me": {
      "id": "user_1760525076782_w7i04a17a7c",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2025-10-15T10:44:36.782Z"
    }
  }
}
```

**Error - Missing Token:**
```json
{
  "errors": [
    {
      "message": "Authentication required. Please provide a valid token."
    }
  ]
}
```

## Token Refresh

Currently, tokens expire after 24 hours. To refresh:

1. Detect token expiration
2. Call login mutation with stored credentials
3. Update stored token

### Automatic Refresh Example

```javascript
class EdgeVectorClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('edgevector_token');
  }

  async refreshToken(email, password) {
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              token
              user { id }
            }
          }
        `,
        variables: {
          input: { email, password }
        }
      })
    });

    const data = await response.json();
    this.token = data.data.login.token;
    localStorage.setItem('edgevector_token', this.token);
    return this.token;
  }

  async query(query, variables) {
    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();

    // Check for authentication errors
    if (data.errors?.some(e => e.message.includes('Authentication required'))) {
      // Token expired - refresh and retry
      await this.refreshToken(/* stored credentials */);
      return this.query(query, variables);
    }

    return data;
  }
}
```

## Security Best Practices

### 1. Token Storage

**✅ Recommended:**
- HTTP-only cookies (server-side)
- Secure storage APIs (mobile apps)
- IndexedDB with encryption (web apps)

**❌ Avoid:**
- Plain localStorage (vulnerable to XSS)
- URL parameters (visible in logs)
- Local Storage without encryption

### 2. HTTPS Only

Always use HTTPS in production:
```javascript
const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-worker.workers.dev'
  : 'http://localhost:8787';
```

### 3. Token Validation

Implement client-side token expiration checks:

```javascript
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch (e) {
    return true;
  }
}

if (isTokenExpired(token)) {
  // Refresh or redirect to login
}
```

### 4. Secure Password Requirements

Enforce strong passwords:
- Minimum 8 characters (server enforces this)
- Recommended: Mix of uppercase, lowercase, numbers, symbols
- Use password strength checkers (client-side)

### 5. Rate Limiting

Authenticated users get higher rate limits:
- Unauthenticated: 100 requests/min
- Authenticated: 500 requests/min

### 6. Don't Log Tokens

Never log tokens in production:
```javascript
// ❌ Don't do this
console.log('Token:', token);

// ✅ Do this
console.log('Token received:', token ? 'yes' : 'no');
```

### 7. Environment Variables

Store JWT secret securely:
```bash
# .env (never commit to git)
JWT_SECRET=your-secret-key-here-minimum-32-characters
```

## Troubleshooting

### Error: "Invalid or expired token"

**Causes:**
- Token expired (>24 hours old)
- Invalid token format
- Token signature verification failed

**Solutions:**
1. Check token expiration timestamp
2. Login again to get new token
3. Verify Authorization header format

### Error: "Authentication required"

**Causes:**
- Missing Authorization header
- Token not included
- Bearer prefix missing

**Solutions:**
```javascript
// ✅ Correct
headers: {
  'Authorization': `Bearer ${token}`
}

// ❌ Wrong
headers: {
  'Authorization': token  // Missing "Bearer"
}
```

### Error: "User with this email already exists"

**Causes:**
- Attempting to register with existing email

**Solutions:**
- Use login mutation instead
- Use a different email address

### Error: "Password must be at least 8 characters long"

**Causes:**
- Password too short

**Solutions:**
- Use a longer password (minimum 8 characters)

### Token Not Working After Restart

**Causes:**
- Using localStorage which persists
- Token expired during downtime

**Solutions:**
1. Check token expiration
2. Implement automatic refresh
3. Clear storage and login again

## Example: Complete Auth Flow

```javascript
class AuthService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this.token = null;
  }

  // Register new user
  async register(email, password, name) {
    const response = await fetch(`${this.apiUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              token
              user { id email name }
            }
          }
        `,
        variables: { input: { email, password, name } }
      })
    });

    const data = await response.json();
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    this.token = data.data.register.token;
    this.saveToken(this.token);
    return data.data.register.user;
  }

  // Login existing user
  async login(email, password) {
    const response = await fetch(`${this.apiUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              token
              user { id email name }
            }
          }
        `,
        variables: { input: { email, password } }
      })
    });

    const data = await response.json();
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    this.token = data.data.login.token;
    this.saveToken(this.token);
    return data.data.login.user;
  }

  // Get current user
  async getCurrentUser() {
    if (!this.token) {
      this.token = this.loadToken();
    }

    if (!this.token) {
      return null;
    }

    const response = await fetch(`${this.apiUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        query: `query { me { id email name createdAt } }`
      })
    });

    const data = await response.json();
    if (data.errors) {
      this.logout();
      return null;
    }

    return data.data.me;
  }

  // Logout
  logout() {
    this.token = null;
    localStorage.removeItem('edgevector_token');
  }

  // Check if authenticated
  isAuthenticated() {
    return !!this.loadToken();
  }

  // Private methods
  saveToken(token) {
    localStorage.setItem('edgevector_token', token);
  }

  loadToken() {
    return localStorage.getItem('edgevector_token');
  }
}

// Usage
const auth = new AuthService('http://localhost:8787');

// Register
try {
  const user = await auth.register(
    'user@example.com',
    'securepass123',
    'John Doe'
  );
  console.log('Registered:', user);
} catch (error) {
  console.error('Registration failed:', error.message);
}

// Login
try {
  const user = await auth.login('user@example.com', 'securepass123');
  console.log('Logged in:', user);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Get current user
const currentUser = await auth.getCurrentUser();
if (currentUser) {
  console.log('Current user:', currentUser);
} else {
  console.log('Not authenticated');
}

// Logout
auth.logout();
```

## Next Steps

- Read the full [API Documentation](./API.md)
- Review [Quick Start Guide](./QUICK_START.md)
- Check [Security Best Practices](#security-best-practices)
- See [Rate Limiting Documentation](./API.md#rate-limiting)
