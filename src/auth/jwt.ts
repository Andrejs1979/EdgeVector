/**
 * JWT Authentication Utilities for Cloudflare Workers
 *
 * Uses Web Crypto API for token signing and verification
 */

export interface JWTPayload {
  sub: string; // Subject (user ID)
  email: string;
  name?: string;
  iat: number; // Issued at
  exp: number; // Expiration time
  iss?: string; // Issuer
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

/**
 * Generate a JWT token
 */
export async function generateToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
    iss: 'edgevector-db',
  };

  // Create JWT header
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Encode header and payload
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(signatureInput, secret);

  return `${signatureInput}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await sign(signatureInput, secret);

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload: JWTPayload = JSON.parse(base64urlDecode(encodedPayload));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Extract user from JWT payload
 */
export function extractUser(payload: JWTPayload): User {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}

/**
 * Sign data using HMAC-SHA256
 */
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataBuffer = encoder.encode(data);

  // Import key for signing
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the data
  const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);

  // Convert to base64url
  return base64urlEncode(signature);
}

/**
 * Base64URL encode
 */
function base64urlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }

  // Convert to base64url format
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64urlDecode(str: string): string {
  // Convert from base64url to base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  return atob(base64);
}

/**
 * Hash password using SHA-256
 * Note: For production, use a proper password hashing algorithm like bcrypt or Argon2
 * This is a simplified version for demonstration
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
