/**
 * LANCam Server — WebSocket Signaling
 *
 * Handles WebSocket connections for cameras and viewers.
 * Routes signaling messages (offer/answer/ICE) between peers.
 * The server NEVER touches media — only signaling/control.
 */
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { SessionManager } from './session.js';
export declare class SignalingServer {
    private sessionManager;
    private wss;
    private peers;
    private wsToPeer;
    private pingInterval;
    constructor(serverOrServers: HttpsServer | HttpServer | (HttpsServer | HttpServer)[], sessionManager: SessionManager);
    private handleConnection;
    private handleMessage;
    private handleCameraRegister;
    private handleViewerRegister;
    private relayOffer;
    private relayAnswer;
    private relayIceCandidate;
    private handleCameraStatus;
    private handlePong;
    private handleDisconnect;
    private broadcastCameraListUpdate;
    private startPingLoop;
    private send;
    private sendError;
    /** Get count of connected peers */
    getConnectedCount(): number;
    /** Shutdown gracefully */
    shutdown(): void;
}
//# sourceMappingURL=signaling.d.ts.map