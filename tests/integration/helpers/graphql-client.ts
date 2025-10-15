/**
 * GraphQL Test Client
 * Utilities for integration testing GraphQL endpoints
 */

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: { code: string };
  }>;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

/**
 * GraphQL test client
 */
export class GraphQLTestClient {
  private token: string | null = null;

  constructor(private baseUrl: string) {}

  /**
   * Set authentication token
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Execute GraphQL query/mutation
   */
  async request<T = any>(
    query: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<GraphQLResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables,
        operationName,
      }),
    });

    return response.json();
  }

  /**
   * Execute query and assert success
   */
  async query<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    const response = await this.request<T>(query, variables);

    if (response.errors) {
      throw new Error(
        `GraphQL query failed: ${response.errors[0].message}`
      );
    }

    if (!response.data) {
      throw new Error('GraphQL query returned no data');
    }

    return response.data;
  }

  /**
   * Execute mutation and assert success
   */
  async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>
  ): Promise<T> {
    const response = await this.request<T>(mutation, variables);

    if (response.errors) {
      throw new Error(
        `GraphQL mutation failed: ${response.errors[0].message}`
      );
    }

    if (!response.data) {
      throw new Error('GraphQL mutation returned no data');
    }

    return response.data;
  }

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<{ token: string; user: any }> {
    const result = await this.mutate<{ register: any }>(
      `
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
      {
        input: { email, password, name },
      }
    );

    this.token = result.register.token;
    return result.register;
  }

  /**
   * Login user
   */
  async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: any }> {
    const result = await this.mutate<{ login: any }>(
      `
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
      `,
      {
        input: { email, password },
      }
    );

    this.token = result.login.token;
    return result.login;
  }

  /**
   * Get current user
   */
  async me(): Promise<any> {
    const result = await this.query<{ me: any }>(
      `
        query {
          me {
            id
            email
            name
            createdAt
          }
        }
      `
    );

    return result.me;
  }

  /**
   * Get health status
   */
  async health(): Promise<any> {
    const result = await this.query<{ health: any }>(
      `
        query {
          health {
            status
            version
            environment
            timestamp
            database {
              connected
              collections
              totalDocuments
            }
          }
        }
      `
    );

    return result.health;
  }

  /**
   * Create collection
   */
  async createCollection(name: string): Promise<any> {
    const result = await this.mutate<{ createCollection: any }>(
      `
        mutation CreateCollection($name: String!) {
          createCollection(name: $name) {
            id
            name
            documentCount
            createdAt
          }
        }
      `,
      { name }
    );

    return result.createCollection;
  }

  /**
   * Insert one document
   */
  async insertOne(collection: string, document: any): Promise<any> {
    const result = await this.mutate<{ insertOne: any }>(
      `
        mutation InsertOne($collection: String!, $document: JSON!) {
          insertOne(collection: $collection, document: $document) {
            _id
            acknowledged
          }
        }
      `,
      { collection, document }
    );

    return result.insertOne;
  }

  /**
   * Find documents
   */
  async find(collection: string, filter?: any, options?: any): Promise<any> {
    const result = await this.query<{ find: any }>(
      `
        query Find($collection: String!, $filter: JSON, $options: QueryOptions) {
          find(collection: $collection, filter: $filter, options: $options) {
            documents {
              _id
              data
            }
            count
            hasMore
          }
        }
      `,
      { collection, filter, options }
    );

    return result.find;
  }

  /**
   * Update one document
   */
  async updateOne(
    collection: string,
    filter: any,
    update: any
  ): Promise<any> {
    const result = await this.mutate<{ updateOne: any }>(
      `
        mutation UpdateOne($collection: String!, $filter: JSON!, $update: UpdateOperators!) {
          updateOne(collection: $collection, filter: $filter, update: $update) {
            matchedCount
            modifiedCount
            acknowledged
          }
        }
      `,
      { collection, filter, update }
    );

    return result.updateOne;
  }

  /**
   * Delete one document
   */
  async deleteOne(collection: string, filter: any): Promise<any> {
    const result = await this.mutate<{ deleteOne: any }>(
      `
        mutation DeleteOne($collection: String!, $filter: JSON!) {
          deleteOne(collection: $collection, filter: $filter) {
            deletedCount
            acknowledged
          }
        }
      `,
      { collection, filter }
    );

    return result.deleteOne;
  }

  /**
   * Count documents
   */
  async count(collection: string, filter?: any): Promise<number> {
    const result = await this.query<{ count: number }>(
      `
        query Count($collection: String!, $filter: JSON) {
          count(collection: $collection, filter: $filter)
        }
      `,
      { collection, filter }
    );

    return result.count;
  }
}

/**
 * Generate random email for testing
 */
export function randomEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Generate random collection name
 */
export function randomCollection(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test_${timestamp}_${random}`;
}

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
