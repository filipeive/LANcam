/**
 * LANCam Server — WebSocket Signaling
 *
 * Handles WebSocket connections for cameras and viewers.
 * Routes signaling messages (offer/answer/ICE) between peers.
 * The server NEVER touches media — only signaling/control.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { createLogger } from './logger.js';
import { SessionManager } from './session.js';
import { createViewerId } from './security.js';
import { WS_PING_INTERVAL_MS, WS_PONG_TIMEOUT_MS } from '@lancam/shared';
import type {
  CameraToServerMessage,
  ViewerToServerMessage,
  ServerToClientMessage,
  IceCandidateInit,
} from '@lancam/shared';

const log = createLogger('signaling');

interface PeerConnection {
  ws: WebSocket;
  sessionId: string;
  role: 'camera' | 'viewer';
  peerId: string; // cameraId or viewerId
  targetPeerId?: string; // the camera a viewer is watching
  alive: boolean;
}

export class SignalingServer {
  private wss: WebSocketServer;
  private peers = new Map<string, PeerConnection>(); // peerId → connection
  private wsToPeer = new Map<WebSocket, string>(); // ws → peerId
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    serverOrServers: HttpsServer | HttpServer | (HttpsServer | HttpServer)[],
    private sessionManager: SessionManager,
  ) {
    const servers = Array.isArray(serverOrServers) ? serverOrServers : [serverOrServers];

    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 256 * 1024, // 256 KB max message (SDP can be large)
    });

    const handleUpgrade = (req: IncomingMessage, socket: any, head: Buffer) => {
      const url = req.url || '';
      if (url.startsWith('/ws')) {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
      }
    };

    for (const server of servers) {
      server.on('upgrade', handleUpgrade);
    }

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.startPingLoop();

    log.info('WebSocket signaling server initialized', { path: '/ws' });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientIp = req.socket.remoteAddress || 'unknown';
    log.debug('New WebSocket connection', { ip: clientIp });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch {
        this.sendError(ws, 'PARSE_ERROR', 'Invalid message format');
      }
    });

    ws.on('close', () => this.handleDisconnect(ws));

    ws.on('error', (err) => {
      log.error('WebSocket error', { error: err.message });
    });
  }

  private handleMessage(ws: WebSocket, message: CameraToServerMessage | ViewerToServerMessage): void {
    switch (message.type) {
      case 'camera-register':
        this.handleCameraRegister(ws, message);
        break;

      case 'viewer-register':
        this.handleViewerRegister(ws, message);
        break;

      case 'offer':
        this.relayOffer(ws, message);
        break;

      case 'answer':
        this.relayAnswer(ws, message);
        break;

      case 'ice-candidate':
        this.relayIceCandidate(ws, message);
        break;

      case 'camera-status':
        this.handleCameraStatus(ws, message);
        break;

      case 'pong':
        this.handlePong(ws);
        break;

      default:
        this.sendError(ws, 'UNKNOWN_MESSAGE', `Unknown message type: ${(message as { type: string }).type}`);
    }
  }

  private handleCameraRegister(
    ws: WebSocket,
    msg: { sessionToken: string; cameraId: string; cameraName: string },
  ): void {
    const auth = this.sessionManager.validateToken(msg.sessionToken);
    if (!auth || (auth.role !== 'camera' && auth.role !== 'dashboard')) {
      this.sendError(ws, 'AUTH_FAILED', 'Invalid or expired session token');
      ws.close(4001, 'Authentication failed');
      return;
    }

    if (auth.role === 'camera') {
      // Register camera in session
      this.sessionManager.registerCamera(auth.sessionId, msg.cameraId, msg.cameraName);
    }

    // Track the peer connection
    const peer: PeerConnection = {
      ws,
      sessionId: auth.sessionId,
      role: auth.role === 'camera' ? 'camera' : 'viewer',
      peerId: msg.cameraId,
      alive: true,
    };

    this.peers.set(msg.cameraId, peer);
    this.wsToPeer.set(ws, msg.cameraId);

    // Confirm registration
    this.send(ws, {
      type: 'session-joined',
      sessionId: auth.sessionId,
      role: auth.role === 'camera' ? 'camera' : 'viewer',
    });

    // Broadcast camera list update to dashboard viewers
    this.broadcastCameraListUpdate(auth.sessionId);

    // Notify camera of any viewers already waiting for this camera
    for (const [vId, p] of this.peers) {
      if (p.role === 'viewer' && p.targetPeerId === msg.cameraId && p.ws.readyState === WebSocket.OPEN) {
        log.info('Notifying camera of waiting viewer', { cameraId: msg.cameraId, viewerId: vId });
        this.send(ws, {
          type: 'viewer-connected',
          viewerId: vId,
        });
      }
    }

    log.info('Camera registered via WebSocket', {
      sessionId: auth.sessionId,
      cameraId: msg.cameraId,
    });
  }

  private handleViewerRegister(
    ws: WebSocket,
    msg: { sessionToken: string; cameraId: string },
  ): void {
    const auth = this.sessionManager.validateToken(msg.sessionToken);
    if (!auth) {
      this.sendError(ws, 'AUTH_FAILED', 'Invalid or expired session token');
      ws.close(4001, 'Authentication failed');
      return;
    }

    const viewerId = createViewerId();

    // Track the peer connection
    const peer: PeerConnection = {
      ws,
      sessionId: auth.sessionId,
      role: 'viewer',
      peerId: viewerId,
      targetPeerId: msg.cameraId,
      alive: true,
    };

    this.peers.set(viewerId, peer);
    this.wsToPeer.set(ws, viewerId);

    // Update viewer count
    this.sessionManager.updateViewerCount(auth.sessionId, msg.cameraId, 1);

    // Confirm registration
    this.send(ws, {
      type: 'session-joined',
      sessionId: auth.sessionId,
      role: 'viewer',
    });

    // Notify the camera that a viewer connected
    const cameraPeer = this.peers.get(msg.cameraId);
    if (cameraPeer && cameraPeer.ws.readyState === WebSocket.OPEN) {
      this.send(cameraPeer.ws, {
        type: 'viewer-connected',
        viewerId,
      });
    }

    log.info('Viewer registered', {
      sessionId: auth.sessionId,
      viewerId,
      cameraId: msg.cameraId,
    });
  }

  private relayOffer(ws: WebSocket, msg: { targetViewerId: string; sdp: string }): void {
    const senderId = this.wsToPeer.get(ws);
    if (!senderId) return;

    const sender = this.peers.get(senderId);
    if (!sender || sender.role !== 'camera') return;

    const targetPeer = this.peers.get(msg.targetViewerId);
    if (!targetPeer || targetPeer.ws.readyState !== WebSocket.OPEN) {
      log.warn('Offer target not found', { targetViewerId: msg.targetViewerId });
      return;
    }

    this.send(targetPeer.ws, {
      type: 'offer',
      fromCameraId: senderId,
      sdp: msg.sdp,
    });

    log.debug('Relayed offer', { from: senderId, to: msg.targetViewerId });
  }

  private relayAnswer(ws: WebSocket, msg: { targetCameraId: string; sdp: string }): void {
    const senderId = this.wsToPeer.get(ws);
    if (!senderId) return;

    const sender = this.peers.get(senderId);
    if (!sender || sender.role !== 'viewer') return;

    const targetPeer = this.peers.get(msg.targetCameraId);
    if (!targetPeer || targetPeer.ws.readyState !== WebSocket.OPEN) {
      log.warn('Answer target not found', { targetCameraId: msg.targetCameraId });
      return;
    }

    this.send(targetPeer.ws, {
      type: 'answer',
      fromViewerId: senderId,
      sdp: msg.sdp,
    });

    log.debug('Relayed answer', { from: senderId, to: msg.targetCameraId });
  }

  private relayIceCandidate(
    ws: WebSocket,
    msg: { targetId: string; candidate: IceCandidateInit },
  ): void {
    const senderId = this.wsToPeer.get(ws);
    if (!senderId) return;

    const targetPeer = this.peers.get(msg.targetId);
    if (!targetPeer || targetPeer.ws.readyState !== WebSocket.OPEN) {
      return; // ICE candidates can arrive for disconnected peers — not an error
    }

    this.send(targetPeer.ws, {
      type: 'ice-candidate',
      from: senderId,
      candidate: msg.candidate,
    });
  }

  private handleCameraStatus(
    ws: WebSocket,
    msg: { status: string; details?: string },
  ): void {
    const peerId = this.wsToPeer.get(ws);
    if (!peerId) return;

    const peer = this.peers.get(peerId);
    if (!peer || peer.role !== 'camera') return;

    this.sessionManager.updateCameraStatus(
      peer.sessionId,
      peerId,
      msg.status as 'ready' | 'live' | 'stopped' | 'error',
    );

    this.broadcastCameraListUpdate(peer.sessionId);
  }

  private handlePong(ws: WebSocket): void {
    const peerId = this.wsToPeer.get(ws);
    if (!peerId) return;
    const peer = this.peers.get(peerId);
    if (peer) peer.alive = true;
  }

  private handleDisconnect(ws: WebSocket): void {
    const peerId = this.wsToPeer.get(ws);
    if (!peerId) return;

    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.role === 'camera') {
      // Notify all viewers watching this camera
      for (const [, otherPeer] of this.peers) {
        if (
          otherPeer.role === 'viewer' &&
          otherPeer.targetPeerId === peerId &&
          otherPeer.ws.readyState === WebSocket.OPEN
        ) {
          this.send(otherPeer.ws, {
            type: 'camera-status-update',
            cameraId: peerId,
            status: 'stopped',
          });
        }
      }

      this.sessionManager.updateCameraStatus(peer.sessionId, peerId, 'stopped');
      this.broadcastCameraListUpdate(peer.sessionId);
    } else if (peer.role === 'viewer' && peer.targetPeerId) {
      // Notify the camera this viewer left
      this.sessionManager.updateViewerCount(peer.sessionId, peer.targetPeerId, -1);

      const cameraPeer = this.peers.get(peer.targetPeerId);
      if (cameraPeer && cameraPeer.ws.readyState === WebSocket.OPEN) {
        this.send(cameraPeer.ws, {
          type: 'viewer-disconnected',
          viewerId: peerId,
        });
      }
    }

    this.peers.delete(peerId);
    this.wsToPeer.delete(ws);

    log.info('Peer disconnected', {
      peerId,
      role: peer.role,
      sessionId: peer.sessionId,
    });
  }

  private broadcastCameraListUpdate(sessionId: string): void {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    const message: ServerToClientMessage = {
      type: 'camera-list-update',
      cameras: session.cameras,
    };

    // Send to all dashboard connections in this session
    for (const [, peer] of this.peers) {
      if (peer.sessionId === sessionId && peer.ws.readyState === WebSocket.OPEN) {
        this.send(peer.ws, message);
      }
    }
  }

  private startPingLoop(): void {
    this.pingInterval = setInterval(() => {
      for (const [peerId, peer] of this.peers) {
        if (!peer.alive) {
          log.warn('Peer did not respond to ping, disconnecting', { peerId });
          peer.ws.terminate();
          this.handleDisconnect(peer.ws);
          continue;
        }

        peer.alive = false;
        if (peer.ws.readyState === WebSocket.OPEN) {
          this.send(peer.ws, { type: 'ping' });
        }
      }
    }, WS_PING_INTERVAL_MS);
  }

  private send(ws: WebSocket, message: ServerToClientMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { type: 'error', code, message });
  }

  /** Get count of connected peers */
  getConnectedCount(): number {
    return this.peers.size;
  }

  /** Shutdown gracefully */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    for (const [, peer] of this.peers) {
      peer.ws.close(1001, 'Server shutting down');
    }

    this.wss.close();
    log.info('Signaling server shut down');
  }
}
