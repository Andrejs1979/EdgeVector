/**
 * HTTP Client Utility
 *
 * Handles GraphQL requests, authentication, retries, and error handling
 */

import {
  EdgeVectorConfig,
  GraphQLResponse,
  GraphQLError,
  EdgeVectorError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NetworkError,
} from '../types';

export class HttpClient {
  private baseUrl: string;
  private token?: string;
  private apiKey?: string;
  private timeout: number;
  private retry: boolean;
  private maxRetries: number;
  private customHeaders: Record<string, string>;

  constructor(config: EdgeVectorConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
    this.retry = config.retry !== false;
    this.maxRetries = config.maxRetries || 3;
    this.customHeaders = config.headers || {};
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Clear authentication token
   */
  clearToken(): void {
    this.token = undefined;
  }

  /**
   * Get current token
   */
  getToken(): string | undefined {
    return this.token;
  }

  /**
   * Execute a GraphQL query or mutation
   */
  async request<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    let lastError: Error | undefined;
    const maxAttempts = this.retry ? this.maxRetries : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.executeRequest<T>(query, variables);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication, validation, or rate limit errors
        if (
          error instanceof AuthenticationError ||
          error instanceof ValidationError ||
          error instanceof RateLimitError
        ) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await this.sleep(delay);
      }
    }

    throw lastError || new NetworkError('Request failed after retries');
  }

  /**
   * Execute a single GraphQL request
   */
  private async executeRequest<T>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.customHeaders,
      };

      // Add authentication
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      } else if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      // Make request
      const response = await fetch(`${this.baseUrl}/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const json = (await response.json()) as GraphQLResponse<T>;

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          { headers: Object.fromEntries(response.headers.entries()) }
        );
      }

      // Handle GraphQL errors
      if (json.errors && json.errors.length > 0) {
        throw this.handleGraphQLErrors(json.errors, response.status);
      }

      // Handle HTTP errors
      if (!response.ok) {
        throw new EdgeVectorError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status
        );
      }

      // Return data
      if (!json.data) {
        throw new EdgeVectorError(
          'No data in response',
          'INVALID_RESPONSE',
          response.status
        );
      }

      return json.data;
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw known errors
      if (error instanceof EdgeVectorError) {
        throw error;
      }

      // Handle abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError(`Request timeout after ${this.timeout}ms`);
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network request failed', error);
      }

      // Unknown error
      throw new EdgeVectorError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN_ERROR',
        0,
        error
      );
    }
  }

  /**
   * Handle GraphQL errors and convert to appropriate error types
   */
  private handleGraphQLErrors(
    errors: GraphQLError[],
    statusCode: number
  ): Error {
    const firstError = errors[0];
    const message = firstError.message;

    // Authentication errors
    if (
      message.includes('Authentication required') ||
      message.includes('Invalid token') ||
      message.includes('Unauthorized') ||
      statusCode === 401
    ) {
      return new AuthenticationError(message, firstError);
    }

    // Validation errors
    if (
      message.includes('Validation') ||
      message.includes('Invalid') ||
      statusCode === 400
    ) {
      return new ValidationError(message, firstError);
    }

    // Generic error
    return new EdgeVectorError(message, 'GRAPHQL_ERROR', statusCode, firstError);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
