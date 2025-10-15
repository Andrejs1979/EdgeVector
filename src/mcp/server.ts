/**
 * Model Context Protocol (MCP) Server
 *
 * Implements MCP 1.0 protocol for AI agent communication
 */

import {
  MCP_VERSION,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPErrorCode,
  MCPTool,
  MCPToolContext,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPListToolsRequest,
  MCPListToolsResponse,
  MCPCallToolRequest,
  MCPCallToolResponse,
  MCPPingRequest,
  MCPPingResponse,
} from './types';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
  };
}

/**
 * MCP Server class
 */
export class MCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private config: MCPServerConfig;
  private initialized: boolean = false;

  constructor(config: MCPServerConfig) {
    this.config = {
      capabilities: {
        tools: true,
        resources: false,
        ...config.capabilities,
      },
      ...config,
    };
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Handle MCP request
   */
  async handleRequest(
    request: MCPRequest,
    context: MCPToolContext
  ): Promise<MCPResponse> {
    try {
      // Validate request
      if (!this.validateRequest(request)) {
        return this.createErrorResponse(
          request.id,
          MCPErrorCode.InvalidRequest,
          'Invalid request format'
        );
      }

      // Route request based on method
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request as MCPInitializeRequest);

        case 'list_tools':
          return this.handleListTools(request as MCPListToolsRequest);

        case 'call_tool':
          return this.handleCallTool(
            request as MCPCallToolRequest,
            context
          );

        case 'ping':
          return this.handlePing(request as MCPPingRequest);

        default:
          return this.createErrorResponse(
            request.id,
            MCPErrorCode.MethodNotFound,
            `Method ${request.method} not found`
          );
      }
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InternalError,
        error instanceof Error ? error.message : 'Internal server error',
        error
      );
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(
    request: MCPInitializeRequest
  ): MCPInitializeResponse {
    this.initialized = true;

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: MCP_VERSION,
        serverInfo: {
          name: this.config.name,
          version: this.config.version,
        },
        capabilities: {
          tools: this.config.capabilities?.tools || false,
          resources: this.config.capabilities?.resources || false,
        },
      },
    };
  }

  /**
   * Handle list_tools request
   */
  private handleListTools(
    request: MCPListToolsRequest
  ): MCPListToolsResponse {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const tools = this.listTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object' as const,
        properties: tool.parameters.reduce(
          (acc, param) => {
            acc[param.name] = {
              type: param.type,
              description: param.description,
              ...(param.default !== undefined && { default: param.default }),
            };
            return acc;
          },
          {} as Record<string, any>
        ),
        required: tool.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    }));

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools,
      },
    };
  }

  /**
   * Handle call_tool request
   */
  private async handleCallTool(
    request: MCPCallToolRequest,
    context: MCPToolContext
  ): Promise<MCPCallToolResponse> {
    if (!this.initialized) {
      throw new Error('Server not initialized');
    }

    const { name, arguments: args } = request.params;

    // Get tool
    const tool = this.getTool(name);
    if (!tool) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.MethodNotFound,
        `Tool ${name} not found`
      ) as MCPCallToolResponse;
    }

    // Validate parameters
    const validation = this.validateToolParameters(tool, args);
    if (!validation.valid) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InvalidParams,
        validation.error || 'Invalid parameters'
      ) as MCPCallToolResponse;
    }

    // Execute tool
    try {
      const result = await tool.handler(args);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'json',
              json: result,
            },
          ],
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      ) as MCPCallToolResponse;
    }
  }

  /**
   * Handle ping request
   */
  private handlePing(request: MCPPingRequest): MCPPingResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Validate request format
   */
  private validateRequest(request: MCPRequest): boolean {
    if (!request) return false;
    if (request.jsonrpc !== '2.0') return false;
    if (!request.id) return false;
    if (!request.method) return false;
    return true;
  }

  /**
   * Validate tool parameters
   */
  private validateToolParameters(
    tool: MCPTool,
    args: any
  ): { valid: boolean; error?: string } {
    if (!args || typeof args !== 'object') {
      return { valid: false, error: 'Arguments must be an object' };
    }

    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in args)) {
        return {
          valid: false,
          error: `Missing required parameter: ${param.name}`,
        };
      }

      // Type check
      if (param.name in args) {
        const value = args[param.name];
        const actualType = Array.isArray(value)
          ? 'array'
          : typeof value;

        if (actualType !== param.type) {
          return {
            valid: false,
            error: `Parameter ${param.name} must be of type ${param.type}, got ${actualType}`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string | number,
    code: MCPErrorCode,
    message: string,
    data?: any
  ): MCPResponse {
    const error: MCPError = {
      code,
      message,
      ...(data && { data }),
    };

    return {
      jsonrpc: '2.0',
      id,
      error,
    };
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get server info
   */
  getServerInfo() {
    return {
      name: this.config.name,
      version: this.config.version,
      capabilities: this.config.capabilities,
      toolCount: this.tools.size,
      initialized: this.initialized,
    };
  }
}
