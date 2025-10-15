/**
 * Authentication Integration Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GraphQLTestClient, randomEmail } from './helpers/graphql-client';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787';

describe('Authentication Integration Tests', () => {
  let client: GraphQLTestClient;

  beforeAll(() => {
    client = new GraphQLTestClient(BASE_URL);
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const email = randomEmail();
      const password = 'testPassword123';
      const name = 'Test User';

      const result = await client.register(email, password, name);

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT format
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.user.name).toBe(name);
      expect(result.user.createdAt).toBeDefined();
    });

    it('should register a user without optional name', async () => {
      const email = randomEmail();
      const password = 'testPassword123';

      const result = await client.register(email, password);

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.user.name).toBeNull();
    });

    it('should fail with short password', async () => {
      const email = randomEmail();
      const password = 'short';

      await expect(
        client.register(email, password)
      ).rejects.toThrow(/at least 8 characters/i);
    });

    it('should fail with duplicate email', async () => {
      const email = randomEmail();
      const password = 'testPassword123';

      // Register first user
      await client.register(email, password);

      // Try to register again with same email
      await expect(
        client.register(email, password)
      ).rejects.toThrow(/already exists/i);
    });

    it('should fail with missing email', async () => {
      const response = await client.request(
        `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              token
            }
          }
        `,
        {
          input: {
            password: 'testPassword123',
          },
        }
      );

      expect(response.errors).toBeDefined();
    });

    it('should fail with missing password', async () => {
      const email = randomEmail();

      const response = await client.request(
        `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              token
            }
          }
        `,
        {
          input: {
            email,
          },
        }
      );

      expect(response.errors).toBeDefined();
    });
  });

  describe('User Login', () => {
    const testEmail = randomEmail();
    const testPassword = 'testPassword123';

    beforeAll(async () => {
      // Create a test user
      await client.register(testEmail, testPassword, 'Login Test User');
      client.setToken(null); // Clear token for login tests
    });

    it('should login with valid credentials', async () => {
      const result = await client.login(testEmail, testPassword);

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(result.user.email).toBe(testEmail);
    });

    it('should fail with invalid email', async () => {
      await expect(
        client.login('nonexistent@example.com', testPassword)
      ).rejects.toThrow(/Invalid email or password/i);
    });

    it('should fail with invalid password', async () => {
      await expect(
        client.login(testEmail, 'wrongPassword')
      ).rejects.toThrow(/Invalid email or password/i);
    });

    it('should fail with empty email', async () => {
      await expect(
        client.login('', testPassword)
      ).rejects.toThrow();
    });

    it('should fail with empty password', async () => {
      await expect(
        client.login(testEmail, '')
      ).rejects.toThrow();
    });
  });

  describe('Token Authentication', () => {
    let testToken: string;
    const testEmail = randomEmail();

    beforeAll(async () => {
      // Create and login user
      const result = await client.register(
        testEmail,
        'testPassword123',
        'Token Test User'
      );
      testToken = result.token;
    });

    it('should access protected endpoint with valid token', async () => {
      client.setToken(testToken);
      const user = await client.me();

      expect(user.email).toBe(testEmail);
      expect(user.name).toBe('Token Test User');
    });

    it('should fail to access protected endpoint without token', async () => {
      client.setToken(null);

      await expect(client.me()).rejects.toThrow();
    });

    it('should fail with invalid token', async () => {
      client.setToken('invalid.token.here');

      await expect(client.me()).rejects.toThrow();
    });

    it('should fail with malformed token', async () => {
      client.setToken('not-a-jwt-token');

      await expect(client.me()).rejects.toThrow();
    });
  });

  describe('JWT Token Structure', () => {
    it('should return valid JWT with correct payload', async () => {
      const email = randomEmail();
      const name = 'JWT Test User';
      const result = await client.register(email, 'testPassword123', name);

      // Decode JWT payload (without verification)
      const parts = result.token.split('.');
      expect(parts).toHaveLength(3);

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );

      expect(payload.sub).toBeDefined(); // User ID
      expect(payload.email).toBe(email);
      expect(payload.name).toBe(name);
      expect(payload.iat).toBeDefined(); // Issued at
      expect(payload.exp).toBeDefined(); // Expiration
      expect(payload.iss).toBe('edgevector-db'); // Issuer

      // Verify expiration is ~24 hours from now
      const expiresIn = payload.exp - payload.iat;
      expect(expiresIn).toBeGreaterThan(86000); // At least 23h 53m
      expect(expiresIn).toBeLessThan(86500); // At most 24h 1m
    });
  });

  describe('User Profile', () => {
    let testEmail: string;

    beforeAll(async () => {
      testEmail = randomEmail();
      await client.register(testEmail, 'testPassword123', 'Profile Test User');
    });

    it('should retrieve current user profile', async () => {
      const user = await client.me();

      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.name).toBe('Profile Test User');
      expect(user.createdAt).toBeDefined();
      expect(new Date(user.createdAt).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });

    it('should return same user after multiple me queries', async () => {
      const user1 = await client.me();
      const user2 = await client.me();

      expect(user1.id).toBe(user2.id);
      expect(user1.email).toBe(user2.email);
    });
  });

  describe('Session Management', () => {
    it('should allow multiple sessions with different tokens', async () => {
      const email = randomEmail();
      const password = 'testPassword123';

      // Register user
      const registration = await client.register(email, password);
      const token1 = registration.token;

      // Login to get second token
      const login = await client.login(email, password);
      const token2 = login.token;

      // Both tokens should work
      client.setToken(token1);
      const user1 = await client.me();

      client.setToken(token2);
      const user2 = await client.me();

      expect(user1.id).toBe(user2.id);
      expect(user1.email).toBe(user2.email);
    });
  });
});
