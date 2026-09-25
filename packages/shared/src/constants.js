/**
 * LANCam — Shared Constants
 *
 * Application-wide constants for configuration defaults,
 * video presets, timing, and limits.
 */
// ─── Application ───────────────────────────────────────────────
export const APP_NAME = 'LANCam';
export const APP_VERSION = '0.1.0';
export const DEFAULT_PORT = 3478;
// ─── Video Presets ─────────────────────────────────────────────
export const VIDEO_PRESETS = {
    LOW: {
        id: 'LOW',
        label: '360p',
        width: 640,
        height: 360,
        frameRate: 30,
        targetBitrate: 1_000_000,
    },
    BALANCED: {
        id: 'BALANCED',
        label: '720p',
        width: 1280,
        height: 720,
        frameRate: 30,
        targetBitrate: 2_500_000,
    },
    HIGH: {
        id: 'HIGH',
        label: '1080p',
        width: 1920,
        height: 1080,
        frameRate: 30,
        targetBitrate: 4_500_000,
    },
    HIGH_FPS: {
        id: 'HIGH_FPS',
        label: '1080p60',
        width: 1920,
        height: 1080,
        frameRate: 60,
        targetBitrate: 6_000_000,
    },
};
// ─── Timing ────────────────────────────────────────────────────
/** WebSocket ping interval in milliseconds */
export const WS_PING_INTERVAL_MS = 5_000;
/** WebSocket pong timeout — disconnect if no pong within this time */
export const WS_PONG_TIMEOUT_MS = 10_000;
/** Session TTL in hours (default) */
export const SESSION_TTL_HOURS = 24;
/** Reconnection delays (exponential backoff) */
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
/** Max reconnection attempts before giving up */
export const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length;
/** Stats collection interval in milliseconds */
export const STATS_INTERVAL_MS = 2_000;
// ─── Limits ────────────────────────────────────────────────────
/** Maximum cameras per session */
export const MAX_CAMERAS_PER_SESSION = 10;
/** Maximum active sessions */
export const MAX_ACTIVE_SESSIONS = 20;
/** Session name max length */
export const SESSION_NAME_MAX_LENGTH = 100;
/** Camera name max length */
export const CAMERA_NAME_MAX_LENGTH = 50;
// ─── Camera ID Prefix ──────────────────────────────────────────
export const CAMERA_ID_PREFIX = 'CAM-';
// ─── ICE Configuration ────────────────────────────────────────
/**
 * LAN-only ICE configuration.
 * Empty iceServers forces browser to gather only host candidates,
 * keeping all traffic on the local network.
 */
export const LAN_ICE_CONFIG = {
    iceServers: [],
    iceCandidatePoolSize: 0,
};
//# sourceMappingURL=constants.js.map