/**
 * LANCam — Shared Type Definitions
 *
 * Types used across server and client for signaling protocol,
 * session management, camera state, and WebRTC configuration.
 */

// ─── Connection & Camera States ────────────────────────────────

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'live'
  | 'degraded'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export type SessionState = 'created' | 'active' | 'ended' | 'expired';

export type CameraStatus = 'registering' | 'ready' | 'live' | 'stopped' | 'error';

export type ViewerStatus = 'connecting' | 'watching' | 'reconnecting' | 'disconnected';

// ─── Camera & Session Models ───────────────────────────────────

export interface CameraCapabilities {
  facingModes: string[];
  resolutions: Resolution[];
  maxFrameRate: number;
  hasZoom: boolean;
  hasTorch: boolean;
}

export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export interface VideoPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  targetBitrate: number;
}

export interface CameraInfo {
  cameraId: string;
  cameraName: string;
  status: CameraStatus;
  capabilities?: CameraCapabilities;
  currentPreset?: string;
  connectedAt?: number;
  viewerCount: number;
}

export interface SessionInfo {
  sessionId: string;
  sessionName: string;
  state: SessionState;
  createdAt: number;
  cameras: CameraInfo[];
  joinToken: string;
  joinCode: string;
}

// ─── WebRTC Stats ──────────────────────────────────────────────

export interface WebRTCStats {
  rtt: number | null;
  jitter: number | null;
  packetsLost: number;
  packetsReceived: number;
  packetsSent: number;
  framesDecoded: number;
  framesDropped: number;
  fps: number | null;
  bitrate: number | null;
  codec: string | null;
  resolution: { width: number; height: number } | null;
  connectionState: string;
  iceState: string;
  timestamp: number;
}

// ─── Health Check ──────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  signaling: boolean;
  uptime: number;
  activeSessions: number;
  connectedCameras: number;
  version: string;
}

// ─── API Types ─────────────────────────────────────────────────

export interface CreateSessionRequest {
  name: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  joinToken: string;
  joinUrl: string;
  qrCodeDataUrl: string;
}

export interface JoinSessionResponse {
  sessionId: string;
  sessionName: string;
  cameraId: string;
  wsUrl: string;
  sessionToken: string;
}

export interface SessionDetailsResponse {
  session: SessionInfo;
  obsUrls: Record<string, string>;
}

// ─── WebRTC Types (Platform-agnostic) ──────────────────────────

export interface IceCandidateInit {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RtcConfiguration {
  iceServers?: IceServer[];
  iceCandidatePoolSize?: number;
  iceTransportPolicy?: 'all' | 'relay';
}


