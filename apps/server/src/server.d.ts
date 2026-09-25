/**
 * LANCam Server — HTTP Server & API Routes
 *
 * HTTPS server serving:
 * - Static frontend files (Vite build output)
 * - REST API for session management
 * - WebSocket upgrade for signaling
 * - Health check endpoint
 */
import https from 'https';
import http from 'http';
import { SessionManager } from './session.js';
import { SignalingServer } from './signaling.js';
import type { ServerConfig } from './config.js';
export declare function getLocalIPs(): string[];
export declare function createServer(config: ServerConfig): Promise<{
    server: https.Server | http.Server;
    httpServer?: http.Server;
    signaling: SignalingServer;
    sessionManager: SessionManager;
}>;
//# sourceMappingURL=server.d.ts.map