/**
 * Model Context Protocol (MCP) Module
 *
 * Exports MCP server, tools, and types for AI agent communication
 */

export * from './types';
export * from './server';
export * from './tools';

// Re-export for convenience
export { MCPServer } from './server';
export {
  getAllTools,
  registerAllTools,
  searchDocumentsTool,
  vectorSearchTool,
  storeMemoryTool,
  retrieveMemoryTool,
} from './tools';
