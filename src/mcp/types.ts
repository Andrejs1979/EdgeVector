/**
 * Model Context Protocol (MCP) 1.0 Types
 *
 * Based on MCP specification for AI agent communication
 */

/**
 * MCP Protocol version
 */
export const MCP_VERSION = '1.0';

/**
 * MCP Request types
 */
export type MCPRequestType =
  | 'initialize'
  | 'list_tools'
  | 'call_tool'
  | 'ping';

/**
 * MCP Response types
 */
export type MCPResponseType =
  | 'success'
  | 'error';

/**
 * Tool parameter definition
 */
export interface MCPToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  parameters: MCPToolParameter[];
  handler: (params: any) => Promise<any>;
}

/**
 * Base MCP Request
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: MCPRequestType;
  params?: any;
}

/**
 * Initialize request
 */
export interface MCPInitializeRequest extends MCPRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    clientInfo: {
      name: string;
      version: string;
    };
    capabilities?: {
      tools?: boolean;
      resources?: boolean;
    };
  };
}

/**
 * List tools request
 */
export interface MCPListToolsRequest extends MCPRequest {
  method: 'list_tools';
  params?: {
    cursor?: string;
  };
}

/**
 * Call tool request
 */
export interface MCPCallToolRequest extends MCPRequest {
  method: 'call_tool';
  params: {
    name: string;
    arguments: any;
  };
}

/**
 * Ping request
 */
export interface MCPPingRequest extends MCPRequest {
  method: 'ping';
}

/**
 * Base MCP Response
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

/**
 * Initialize response
 */
export interface MCPInitializeResponse extends MCPResponse {
  result: {
    protocolVersion: string;
    serverInfo: {
      name: string;
      version: string;
    };
    capabilities: {
      tools: boolean;
      resources: boolean;
    };
  };
}

/**
 * List tools response
 */
export interface MCPListToolsResponse extends MCPResponse {
  result: {
    tools: Array<{
      name: string;
      description: string;
      inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
      };
    }>;
    nextCursor?: string;
  };
}

/**
 * Call tool response
 */
export interface MCPCallToolResponse extends MCPResponse {
  result: {
    content: Array<{
      type: 'text' | 'json';
      text?: string;
      json?: any;
    }>;
  };
}

/**
 * Ping response
 */
export interface MCPPingResponse extends MCPResponse {
  result: {
    status: 'ok';
    timestamp: string;
  };
}

/**
 * MCP Error codes
 */
export enum MCPErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,
}

/**
 * MCP Error
 */
export interface MCPError {
  code: MCPErrorCode;
  message: string;
  data?: any;
}

/**
 * Tool execution context
 */
export interface MCPToolContext {
  env: any;
  user?: any;
}

/**
 * Tool execution result
 */
export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
