/**
 * LANCam Server — Session Management
 *
 * In-memory session store for MVP. Manages session lifecycle,
 * camera registration, and token validation.
 */

import { createLogger } from './logger.js';
import { createSessionId, createJoinCode, createSessionToken, createCameraId } from './security.js';
import {
  MAX_CAMERAS_PER_SESSION,
  MAX_ACTIVE_SESSIONS,
  SESSION_NAME_MAX_LENGTH,
  SESSION_TTL_HOURS,
} from '@lancam/shared';
import type { SessionState, CameraInfo, CameraStatus, SessionInfo } from '@lancam/shared';

const log = createLogger('session');

interface InternalSession {
  sessionId: string;
  sessionName: string;
  state: SessionState;
  createdAt: number;
  joinCode: string;
  joinToken: string;
  cameras: Map<string, CameraInfo>;
  /** Map of sessionToken → role for auth */
  tokens: Map<string, { role: 'camera' | 'viewer' | 'dashboard'; cameraId?: string }>;
}

export class SessionManager {
  private sessions = new Map<string, InternalSession>();
  private joinCodeIndex = new Map<string, string>(); // joinCode → sessionId
  private tokenIndex = new Map<string, string>(); // token → sessionId

  /**
   * Create a new session.
   */
  createSession(name: string): {
    sessionId: string;
    joinCode: string;
    joinToken: string;
    dashboardToken: string;
  } {
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

    const session: InternalSession = {
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
  joinSession(joinCode: string): {
    sessionId: string;
    sessionName: string;
    cameraId: string;
    sessionToken: string;
  } | null {
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
  createViewerToken(sessionId: string, cameraId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const viewerToken = createSessionToken();
    session.tokens.set(viewerToken, { role: 'viewer', cameraId });
    this.tokenIndex.set(viewerToken, sessionId);

    return viewerToken;
  }

  /**
   * Validate a session token. Returns session info and role if valid.
   */
  validateToken(token: string): {
    sessionId: string;
    role: 'camera' | 'viewer' | 'dashboard';
    cameraId?: string;
  } | null {
    const sessionId = this.tokenIndex.get(token);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const tokenInfo = session.tokens.get(token);
    if (!tokenInfo) return null;

    return {
      sessionId,
      role: tokenInfo.role,
      cameraId: tokenInfo.cameraId,
    };
  }

  /**
   * Register a camera's details after it connects via WebSocket.
   */
  registerCamera(sessionId: string, cameraId: string, cameraName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const camera: CameraInfo = {
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
  updateCameraStatus(sessionId: string, cameraId: string, status: CameraStatus): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const camera = session.cameras.get(cameraId);
    if (!camera) return;

    camera.status = status;
    log.debug('Camera status updated', { sessionId, cameraId, status });
  }

  /**
   * Update a camera's viewer count.
   */
  updateViewerCount(sessionId: string, cameraId: string, delta: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const camera = session.cameras.get(cameraId);
    if (!camera) return;

    camera.viewerCount = Math.max(0, camera.viewerCount + delta);
  }

  /**
   * Remove a camera from a session (e.g., on disconnect).
   */
  removeCamera(sessionId: string, cameraId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.cameras.delete(cameraId);
    log.info('Camera removed', { sessionId, cameraId });
  }

  /**
   * Get session info by ID.
   */
  getSession(sessionId: string): SessionInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

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
  getSessionByJoinCode(joinCode: string): SessionInfo | null {
    const sessionId = this.joinCodeIndex.get(joinCode.toUpperCase());
    if (!sessionId) return null;
    return this.getSession(sessionId);
  }

  /**
   * Get all active sessions.
   */
  getActiveSessions(): SessionInfo[] {
    const result: SessionInfo[] = [];
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
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'ended';
    log.info('Session ended', { sessionId });
  }

  /**
   * Clean up expired sessions. Called periodically.
   */
  cleanupExpired(ttlHours: number = SESSION_TTL_HOURS): number {
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
  getStats(): { activeSessions: number; totalCameras: number } {
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
