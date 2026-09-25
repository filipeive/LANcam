/**
 * LANCam — Signaling Protocol
 *
 * Defines all WebSocket message types exchanged between
 * cameras, viewers, and the signaling server.
 */

import type { CameraCapabilities, CameraStatus, ViewerStatus, CameraInfo, IceCandidateInit } from './types.js';

// ─── Camera → Server Messages ──────────────────────────────────

export interface CameraRegisterMessage {
  type: 'camera-register';
  sessionToken: string;
  cameraId: string;
  cameraName: string;
  capabilities: CameraCapabilities;
}

export interface CameraOfferMessage {
  type: 'offer';
  targetViewerId: string;
  sdp: string;
}

export interface CameraIceCandidateMessage {
  type: 'ice-candidate';
  targetId: string;
  candidate: IceCandidateInit;
}

export interface CameraStatusMessage {
  type: 'camera-status';
  status: CameraStatus;
  details?: string;
}

export interface PongMessage {
  type: 'pong';
}

export type CameraToServerMessage =
  | CameraRegisterMessage
  | CameraOfferMessage
  | CameraIceCandidateMessage
  | CameraStatusMessage
  | PongMessage;

// ─── Viewer → Server Messages ──────────────────────────────────

export interface ViewerRegisterMessage {
  type: 'viewer-register';
  sessionToken: string;
  cameraId: string;
}

export interface ViewerAnswerMessage {
  type: 'answer';
  targetCameraId: string;
  sdp: string;
}

export interface ViewerIceCandidateMessage {
  type: 'ice-candidate';
  targetId: string;
  candidate: IceCandidateInit;
}

export interface ViewerStatusMessage {
  type: 'viewer-status';
  status: ViewerStatus;
}

export type ViewerToServerMessage =
  | ViewerRegisterMessage
  | ViewerAnswerMessage
  | ViewerIceCandidateMessage
  | ViewerStatusMessage
  | PongMessage;

// ─── Server → Client Messages ──────────────────────────────────

export interface SessionJoinedMessage {
  type: 'session-joined';
  sessionId: string;
  role: 'camera' | 'viewer';
}

export interface ViewerConnectedMessage {
  type: 'viewer-connected';
  viewerId: string;
}

export interface ViewerDisconnectedMessage {
  type: 'viewer-disconnected';
  viewerId: string;
}

export interface RelayOfferMessage {
  type: 'offer';
  fromCameraId: string;
  sdp: string;
}

export interface RelayAnswerMessage {
  type: 'answer';
  fromViewerId: string;
  sdp: string;
}

export interface RelayIceCandidateMessage {
  type: 'ice-candidate';
  from: string;
  candidate: IceCandidateInit;
}

export interface ServerErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface PingMessage {
  type: 'ping';
}

export interface CameraListUpdateMessage {
  type: 'camera-list-update';
  cameras: CameraInfo[];
}

export interface CameraStatusUpdateMessage {
  type: 'camera-status-update';
  cameraId: string;
  status: CameraStatus;
}

export type ServerToClientMessage =
  | SessionJoinedMessage
  | ViewerConnectedMessage
  | ViewerDisconnectedMessage
  | RelayOfferMessage
  | RelayAnswerMessage
  | RelayIceCandidateMessage
  | ServerErrorMessage
  | PingMessage
  | CameraListUpdateMessage
  | CameraStatusUpdateMessage;

// ─── Union of all messages ─────────────────────────────────────

export type SignalingMessage =
  | CameraToServerMessage
  | ViewerToServerMessage
  | ServerToClientMessage;
