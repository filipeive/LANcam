/**
 * LANCam Server — Security
 *
 * Token generation and validation for sessions and cameras.
 * Uses nanoid for cryptographically random, URL-safe IDs.
 */

import { nanoid, customAlphabet } from 'nanoid';

/** Generate a session ID (short, human-friendly for QR codes) */
const generateJoinCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);

/** Generate a camera ID with prefix */
const generateCameraHex = customAlphabet('0123456789ABCDEF', 6);

/** Generate a secure session token */
export function createSessionToken(): string {
  return nanoid(32);
}

/** Generate a join code for QR/URL (6 chars, no ambiguous characters) */
export function createJoinCode(): string {
  return generateJoinCode();
}

/** Generate a camera ID like CAM-A7F29C */
export function createCameraId(): string {
  return `CAM-${generateCameraHex()}`;
}

/** Generate a unique viewer ID */
export function createViewerId(): string {
  return `VWR-${nanoid(8)}`;
}

/** Generate a session ID */
export function createSessionId(): string {
  return nanoid(16);
}

/**
 * Validate a token format. Does not check existence — that's the
 * session manager's job.
 */
export function isValidToken(token: string): boolean {
  return typeof token === 'string' && token.length >= 6 && token.length <= 64;
}
