/**
 * LANCam Server — Session Management
 *
 * In-memory session store for MVP. Manages session lifecycle,
 * camera registration, and token validation.
 */
import type { CameraStatus, SessionInfo } from '@lancam/shared';
export declare class SessionManager {
    private sessions;
    private joinCodeIndex;
    private tokenIndex;
    /**
     * Create a new session.
     */
    createSession(name: string): {
        sessionId: string;
        joinCode: string;
        joinToken: string;
        dashboardToken: string;
    };
    /**
     * Join a session using a join code. Returns a camera ID and session token.
     */
    joinSession(joinCode: string): {
        sessionId: string;
        sessionName: string;
        cameraId: string;
        sessionToken: string;
    } | null;
    /**
     * Create a viewer token for watching a specific camera.
     */
    createViewerToken(sessionId: string, cameraId: string): string | null;
    /**
     * Validate a session token. Returns session info and role if valid.
     */
    validateToken(token: string): {
        sessionId: string;
        role: 'camera' | 'viewer' | 'dashboard';
        cameraId?: string;
    } | null;
    /**
     * Register a camera's details after it connects via WebSocket.
     */
    registerCamera(sessionId: string, cameraId: string, cameraName: string): boolean;
    /**
     * Update a camera's status.
     */
    updateCameraStatus(sessionId: string, cameraId: string, status: CameraStatus): void;
    /**
     * Update a camera's viewer count.
     */
    updateViewerCount(sessionId: string, cameraId: string, delta: number): void;
    /**
     * Remove a camera from a session (e.g., on disconnect).
     */
    removeCamera(sessionId: string, cameraId: string): void;
    /**
     * Get session info by ID.
     */
    getSession(sessionId: string): SessionInfo | null;
    /**
     * Get session by join code.
     */
    getSessionByJoinCode(joinCode: string): SessionInfo | null;
    /**
     * Get all active sessions.
     */
    getActiveSessions(): SessionInfo[];
    /**
     * End a session.
     */
    endSession(sessionId: string): void;
    /**
     * Clean up expired sessions. Called periodically.
     */
    cleanupExpired(ttlHours?: number): number;
    /**
     * Get summary stats for health check.
     */
    getStats(): {
        activeSessions: number;
        totalCameras: number;
    };
}
//# sourceMappingURL=session.d.ts.map