/**
 * LANCam — Shared Constants
 *
 * Application-wide constants for configuration defaults,
 * video presets, timing, and limits.
 */
import type { VideoPreset, RtcConfiguration } from './types.js';
export declare const APP_NAME = "LANCam";
export declare const APP_VERSION = "0.1.0";
export declare const DEFAULT_PORT = 3478;
export declare const VIDEO_PRESETS: Record<string, VideoPreset>;
/** WebSocket ping interval in milliseconds */
export declare const WS_PING_INTERVAL_MS = 5000;
/** WebSocket pong timeout — disconnect if no pong within this time */
export declare const WS_PONG_TIMEOUT_MS = 10000;
/** Session TTL in hours (default) */
export declare const SESSION_TTL_HOURS = 24;
/** Reconnection delays (exponential backoff) */
export declare const RECONNECT_DELAYS_MS: number[];
/** Max reconnection attempts before giving up */
export declare const MAX_RECONNECT_ATTEMPTS: number;
/** Stats collection interval in milliseconds */
export declare const STATS_INTERVAL_MS = 2000;
/** Maximum cameras per session */
export declare const MAX_CAMERAS_PER_SESSION = 10;
/** Maximum active sessions */
export declare const MAX_ACTIVE_SESSIONS = 20;
/** Session name max length */
export declare const SESSION_NAME_MAX_LENGTH = 100;
/** Camera name max length */
export declare const CAMERA_NAME_MAX_LENGTH = 50;
export declare const CAMERA_ID_PREFIX = "CAM-";
/**
 * LAN-only ICE configuration.
 * Empty iceServers forces browser to gather only host candidates,
 * keeping all traffic on the local network.
 */
export declare const LAN_ICE_CONFIG: RtcConfiguration;
//# sourceMappingURL=constants.d.ts.map