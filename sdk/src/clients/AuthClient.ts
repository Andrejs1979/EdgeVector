/**
 * Authentication Client
 *
 * Handles user registration, login, and token management
 */

import { HttpClient } from '../utils/http-client';
import {
  RegisterInput,
  LoginInput,
  AuthResponse,
  User,
} from '../types';

export class AuthClient {
  constructor(private http: HttpClient) {}

  /**
   * Register a new user
   *
   * @param input - Registration details (email, password, optional name)
   * @returns Authentication response with token and user info
   *
   * @example
   * ```typescript
   * const { token, user } = await client.auth.register({
   *   email: 'user@example.com',
   *   password: 'secure_password',
   *   name: 'John Doe'
   * });
   * ```
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const query = `
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
    `;

    const response = await this.http.request<{ register: AuthResponse }>(
      query,
      { input }
    );

    // Store token in client
    this.http.setToken(response.register.token);

    return response.register;
  }

  /**
   * Login with email and password
   *
   * @param input - Login credentials (email, password)
   * @returns Authentication response with token and user info
   *
   * @example
   * ```typescript
   * const { token, user } = await client.auth.login({
   *   email: 'user@example.com',
   *   password: 'secure_password'
   * });
   * ```
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const query = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
          user {
            id
            email
            name
            createdAt
            lastLogin
          }
        }
      }
    `;

    const response = await this.http.request<{ login: AuthResponse }>(
      query,
      { input }
    );

    // Store token in client
    this.http.setToken(response.login.token);

    return response.login;
  }

  /**
   * Get current authenticated user
   *
   * Requires a valid authentication token
   *
   * @returns Current user information
   *
   * @example
   * ```typescript
   * const user = await client.auth.me();
   * console.log(user.email);
   * ```
   */
  async me(): Promise<User> {
    const query = `
      query Me {
        me {
          id
          email
          name
          createdAt
          lastLogin
        }
      }
    `;

    const response = await this.http.request<{ me: User }>(query);
    return response.me;
  }

  /**
   * Set authentication token manually
   *
   * Useful when you have a token from a previous session
   *
   * @param token - JWT token
   *
   * @example
   * ```typescript
   * client.auth.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
   * ```
   */
  setToken(token: string): void {
    this.http.setToken(token);
  }

  /**
   * Get current authentication token
   *
   * @returns Current JWT token or undefined if not authenticated
   *
   * @example
   * ```typescript
   * const token = client.auth.getToken();
   * if (token) {
   *   // Save to localStorage
   *   localStorage.setItem('token', token);
   * }
   * ```
   */
  getToken(): string | undefined {
    return this.http.getToken();
  }

  /**
   * Logout (clear authentication token)
   *
   * @example
   * ```typescript
   * client.auth.logout();
   * ```
   */
  logout(): void {
    this.http.clearToken();
  }

  /**
   * Check if user is authenticated
   *
   * @returns True if a token is present
   *
   * @example
   * ```typescript
   * if (client.auth.isAuthenticated()) {
   *   console.log('User is logged in');
   * }
   * ```
   */
  isAuthenticated(): boolean {
    return !!this.http.getToken();
  }
}
