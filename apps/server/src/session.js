/**
 * LANCam Server — Session Management
 *
 * In-memory session store for MVP. Manages session lifecycle,
 * camera registration, and token validation.
 */
import { createLogger } from './logger.js';
import { createSessionId, createJoinCode, createSessionToken, createCameraId } from './security.js';
import { MAX_CAMERAS_PER_SESSION, MAX_ACTIVE_SESSIONS, SESSION_NAME_MAX_LENGTH, SESSION_TTL_HOURS, } from '@lancam/shared';
const log = createLogger('session');
export class SessionManager {
    sessions = new Map();
    joinCodeIndex = new Map(); // joinCode → sessionId
    tokenIndex = new Map(); // token → sessionId
    /**
     * Create a new session.
     */
    createSession(name) {
        if (this.getActiveSessions().length >= MAX_ACTIVE_SESSIONS) {
            throw new Error(`Maximum active sessions (${MAX_ACTIVE_SESSIONS}) reached`);
        }
        const sanitizedName = name.trim().slice(0, SESSION_NAME_MAX_LENGTH);
        if (sanitizedName.length === 0) {
            throw new Error('Session name is required');
        }
        const sessionId = createSessionId();
        const joinCode = createJoinCode();
        const joinToken = createSessionToken();
        const dashboardToken = createSessionToken();
        const session = {
            sessionId,
            sessionName: sanitizedName,
            state: 'created',
            createdAt: Date.now(),
            joinCode,
            joinToken,
            cameras: new Map(),
            tokens: new Map(),
        };
        // Register the dashboard token
        session.tokens.set(dashboardToken, { role: 'dashboard' });
        this.tokenIndex.set(dashboardToken, sessionId);
        this.sessions.set(sessionId, session);
        this.joinCodeIndex.set(joinCode, sessionId);
        log.info('Session created', { sessionId, name: sanitizedName, joinCode });
        return { sessionId, joinCode, joinToken, dashboardToken };
    }
    /**
     * Join a session using a join code. Returns a camera ID and session token.
     */
    joinSession(joinCode) {
        const sessionId = this.joinCodeIndex.get(joinCode.toUpperCase());
        if (!sessionId) {
            log.warn('Join attempt with invalid code', { joinCode });
            return null;
        }
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        if (session.state === 'ended' || session.state === 'expired') {
            log.warn('Join attempt on inactive session', { sessionId, state: session.state });
            return null;
        }
        if (session.cameras.size >= MAX_CAMERAS_PER_SESSION) {
            log.warn('Session camera limit reached', { sessionId, limit: MAX_CAMERAS_PER_SESSION });
            return null;
        }
        const cameraId = createCameraId();
        const sessionToken = createSessionToken();
        session.tokens.set(sessionToken, { role: 'camera', cameraId });
        this.tokenIndex.set(sessionToken, sessionId);
        // Activate session on first join
        if (session.state === 'created') {
            session.state = 'active';
        }
        log.info('Camera joined session', { sessionId, cameraId });
        return {
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            cameraId,
            sessionToken,
        };
    }
    /**
     * Create a viewer token for watching a specific camera.
     */
    createViewerToken(sessionId, cameraId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const viewerToken = createSessionToken();
        session.tokens.set(viewerToken, { role: 'viewer', cameraId });
        this.tokenIndex.set(viewerToken, sessionId);
        return viewerToken;
    }
    /**
     * Validate a session token. Returns session info and role if valid.
     */
    validateToken(token) {
        const sessionId = this.tokenIndex.get(token);
        if (!sessionId)
            return null;
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const tokenInfo = session.tokens.get(token);
        if (!tokenInfo)
            return null;
        return {
            sessionId,
            role: tokenInfo.role,
            cameraId: tokenInfo.cameraId,
        };
    }
    /**
     * Register a camera's details after it connects via WebSocket.
     */
    registerCamera(sessionId, cameraId, cameraName) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        const camera = {
            cameraId,
            cameraName: cameraName.trim().slice(0, 50) || cameraId,
            status: 'ready',
            viewerCount: 0,
            connectedAt: Date.now(),
        };
        session.cameras.set(cameraId, camera);
        log.info('Camera registered', { sessionId, cameraId, cameraName: camera.cameraName });
        return true;
    }
    /**
     * Update a camera's status.
     */
    updateCameraStatus(sessionId, cameraId, status) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const camera = session.cameras.get(cameraId);
        if (!camera)
            return;
        camera.status = status;
        log.debug('Camera status updated', { sessionId, cameraId, status });
    }
    /**
     * Update a camera's viewer count.
     */
    updateViewerCount(sessionId, cameraId, delta) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        const camera = session.cameras.get(cameraId);
        if (!camera)
            return;
        camera.viewerCount = Math.max(0, camera.viewerCount + delta);
    }
    /**
     * Remove a camera from a session (e.g., on disconnect).
     */
    removeCamera(sessionId, cameraId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.cameras.delete(cameraId);
        log.info('Camera removed', { sessionId, cameraId });
    }
    /**
     * Get session info by ID.
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        return {
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            state: session.state,
            createdAt: session.createdAt,
            cameras: Array.from(session.cameras.values()),
            joinToken: session.joinToken,
            joinCode: session.joinCode,
        };
    }
    /**
     * Get session by join code.
     */
    getSessionByJoinCode(joinCode) {
        const sessionId = this.joinCodeIndex.get(joinCode.toUpperCase());
        if (!sessionId)
            return null;
        return this.getSession(sessionId);
    }
    /**
     * Get all active sessions.
     */
    getActiveSessions() {
        const result = [];
        for (const session of this.sessions.values()) {
            if (session.state === 'created' || session.state === 'active') {
                result.push({
                    sessionId: session.sessionId,
                    sessionName: session.sessionName,
                    state: session.state,
                    createdAt: session.createdAt,
                    cameras: Array.from(session.cameras.values()),
                    joinToken: session.joinToken,
                    joinCode: session.joinCode,
                });
            }
        }
        return result;
    }
    /**
     * End a session.
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.state = 'ended';
        log.info('Session ended', { sessionId });
    }
    /**
     * Clean up expired sessions. Called periodically.
     */
    cleanupExpired(ttlHours = SESSION_TTL_HOURS) {
        const cutoff = Date.now() - ttlHours * 60 * 60 * 1000;
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions) {
            if (session.createdAt < cutoff) {
                // Clean up indexes
                this.joinCodeIndex.delete(session.joinCode);
                for (const token of session.tokens.keys()) {
                    this.tokenIndex.delete(token);
                }
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            log.info('Cleaned up expired sessions', { count: cleaned });
        }
        return cleaned;
    }
    /**
     * Get summary stats for health check.
     */
    getStats() {
        let totalCameras = 0;
        let activeSessions = 0;
        for (const session of this.sessions.values()) {
            if (session.state === 'created' || session.state === 'active') {
                activeSessions++;
                totalCameras += session.cameras.size;
            }
        }
        return { activeSessions, totalCameras };
    }
}
//# sourceMappingURL=session.js.map