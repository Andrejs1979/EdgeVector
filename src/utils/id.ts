/**
 * ID Generation Utilities
 *
 * Provides functions for generating unique IDs for database records.
 */

/**
 * Generate a unique ID using crypto.randomUUID()
 * Falls back to timestamp-based ID if crypto is not available
 */
export function generateId(): string {
  // Use crypto.randomUUID() if available (Node.js 14.17+, Cloudflare Workers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: timestamp + random
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a short ID (for use where full UUID is not needed)
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a prefixed ID (e.g., "doc_abc123")
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateShortId()}`;
}
