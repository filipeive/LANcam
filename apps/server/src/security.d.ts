/**
 * LANCam Server — Security
 *
 * Token generation and validation for sessions and cameras.
 * Uses nanoid for cryptographically random, URL-safe IDs.
 */
/** Generate a secure session token */
export declare function createSessionToken(): string;
/** Generate a join code for QR/URL (6 chars, no ambiguous characters) */
export declare function createJoinCode(): string;
/** Generate a camera ID like CAM-A7F29C */
export declare function createCameraId(): string;
/** Generate a unique viewer ID */
export declare function createViewerId(): string;
/** Generate a session ID */
export declare function createSessionId(): string;
/**
 * Validate a token format. Does not check existence — that's the
 * session manager's job.
 */
export declare function isValidToken(token: string): boolean;
//# sourceMappingURL=security.d.ts.map