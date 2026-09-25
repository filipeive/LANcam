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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import QRCode from 'qrcode';
import { createLogger } from './logger.js';
import { SessionManager } from './session.js';
import { SignalingServer } from './signaling.js';
import type { ServerConfig } from './config.js';
import { APP_NAME, APP_VERSION } from '@lancam/shared';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  HealthStatus,
} from '@lancam/shared';
import { networkInterfaces } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = createLogger('server');

export function getLocalIPs(): string[] {
  const interfaces = networkInterfaces();
  const ips: string[] = [];

  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }

  return ips;
}

export async function createServer(config: ServerConfig): Promise<{
  server: https.Server | http.Server;
  httpServer?: http.Server;
  signaling: SignalingServer;
  sessionManager: SessionManager;
}> {
  const app = express();
  const sessionManager = new SessionManager();

  // ─── Middleware ─────────────────────────────────────────────

  app.use(express.json());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // ─── API Routes ────────────────────────────────────────────

  const localIPs = getLocalIPs();
  const primaryIP = localIPs[0] || '127.0.0.1';
  const baseUrl = `https://${config.publicHost || primaryIP}:${config.port}`;
  const httpBaseUrl = `http://${config.publicHost || primaryIP}:${config.httpPort}`;

  // Health check
  app.get('/health', (_req, res) => {
    const stats = sessionManager.getStats();
    const health: HealthStatus = {
      status: 'ok',
      signaling: true,
      uptime: process.uptime(),
      activeSessions: stats.activeSessions,
      connectedCameras: stats.totalCameras,
      version: APP_VERSION,
    };
    res.json(health);
  });

  // Get server info (for client bootstrapping)
  app.get('/api/info', (_req, res) => {
    res.json({
      name: APP_NAME,
      version: APP_VERSION,
      wsUrl: `wss://${config.publicHost || primaryIP}:${config.port}/ws`,
      wsHttpUrl: `ws://${config.publicHost || primaryIP}:${config.httpPort}/ws`,
      localIPs,
    });
  });

  // Helper to determine public base path prefix (e.g. /lancam)
  function getPublicBasePath(req: express.Request): string {
    if (process.env.PUBLIC_BASE_PATH) {
      const envPath = process.env.PUBLIC_BASE_PATH.trim();
      if (envPath && envPath !== '/') {
        return envPath.startsWith('/') ? envPath.replace(/\/$/, '') : `/${envPath.replace(/\/$/, '')}`;
      }
    }

    const forwardedPrefix = req.headers['x-forwarded-prefix'];
    if (typeof forwardedPrefix === 'string' && forwardedPrefix) {
      return forwardedPrefix.replace(/\/$/, '');
    }

    const referer = req.headers.referer;
    if (typeof referer === 'string' && referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.pathname.startsWith('/lancam')) {
          return '/lancam';
        }
      } catch {
        // ignore
      }
    }

    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin) {
      try {
        const origUrl = new URL(origin);
        if (origUrl.pathname.startsWith('/lancam')) {
          return '/lancam';
        }
      } catch {
        // ignore
      }
    }

    return '';
  }

  function getRequestBaseUrl(req: express.Request, fallbackBaseUrl: string, isHttps: boolean = true): string {
    const pathPrefix = getPublicBasePath(req);
    const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;

    if (hostHeader) {
      const forwardedProto = req.headers['x-forwarded-proto'] as string | undefined;
      let proto = forwardedProto || (req.secure ? 'https' : 'http');
      if (isHttps && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')) {
        proto = 'https';
      }
      return `${proto}://${hostHeader}${pathPrefix}`;
    }

    if (req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        let proto = isHttps ? refUrl.protocol : 'http:';
        if (isHttps && !refUrl.host.includes('localhost') && !refUrl.host.includes('127.0.0.1')) {
          proto = 'https:';
        }
        return `${proto}//${refUrl.host}${pathPrefix}`;
      } catch {
        // ignore
      }
    }

    return `${fallbackBaseUrl}${pathPrefix}`;
  }

  // Create session
  app.post('/api/sessions', async (req, res) => {
    try {
      const body = req.body as CreateSessionRequest;
      if (!body.name || typeof body.name !== 'string') {
        res.status(400).json({ error: 'Session name is required' });
        return;
      }

      const { sessionId, joinCode, joinToken, dashboardToken } =
        sessionManager.createSession(body.name);

      const requestBase = getRequestBaseUrl(req, baseUrl, true);
      const joinUrl = `${requestBase}/join/${joinCode}`;

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });

      const response: CreateSessionResponse & { dashboardToken: string; joinCode: string } = {
        sessionId,
        joinToken,
        joinUrl,
        qrCodeDataUrl,
        dashboardToken,
        joinCode,
      };

      res.status(201).json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error('Failed to create session', { error: message });
      res.status(500).json({ error: message });
    }
  });

  // Get session details (for dashboard)
  app.get('/api/sessions/:sessionId', (req, res) => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const requestBase = getRequestBaseUrl(req, baseUrl, true);
    const httpReqBase = getRequestBaseUrl(req, httpBaseUrl, false);

    // Build OBS URLs for each camera (HTTP by default for OBS CEF SSL compatibility, plus HTTPS option)
    const obsUrls: Record<string, string> = {};
    const obsHttpsUrls: Record<string, string> = {};
    for (const camera of session.cameras) {
      const viewerToken = sessionManager.createViewerToken(session.sessionId, camera.cameraId);
      if (viewerToken) {
        obsUrls[camera.cameraId] =
          `${httpReqBase}/camera/${camera.cameraId}/view?token=${viewerToken}&session=${session.sessionId}`;
        obsHttpsUrls[camera.cameraId] =
          `${requestBase}/camera/${camera.cameraId}/view?token=${viewerToken}&session=${session.sessionId}`;
      }
    }

    res.json({ session, obsUrls, obsHttpsUrls });
  });

  // List active sessions
  app.get('/api/sessions', (_req, res) => {
    const sessions = sessionManager.getActiveSessions();
    res.json({ sessions });
  });

  // Join session (returns camera page data)
  app.get('/api/join/:joinCode', (req, res) => {
    const result = sessionManager.joinSession(req.params.joinCode);
    if (!result) {
      res.status(404).json({ error: 'Invalid or expired join code' });
      return;
    }

    const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
    const isHttps = (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')) === 'https';
    const proto = isHttps ? 'wss' : 'ws';
    const wsUrl = hostHeader ? `${proto}://${hostHeader}/ws` : `wss://${config.publicHost || primaryIP}:${config.port}/ws`;

    res.json({
      ...result,
      wsUrl,
    });
  });

  // Create viewer token for a camera
  app.post('/api/sessions/:sessionId/cameras/:cameraId/viewer-token', (req, res) => {
    const token = sessionManager.createViewerToken(req.params.sessionId, req.params.cameraId);
    if (!token) {
      res.status(404).json({ error: 'Session or camera not found' });
      return;
    }

    const viewUrl = `${httpBaseUrl}/camera/${req.params.cameraId}/view?token=${token}&session=${req.params.sessionId}`;
    const viewHttpsUrl = `${baseUrl}/camera/${req.params.cameraId}/view?token=${token}&session=${req.params.sessionId}`;
    res.json({ token, viewUrl, viewHttpsUrl });
  });

  // ─── Static File Serving ───────────────────────────────────

  // Serve the Vite build output (check multiple possible locations for dev, standalone, and electron packaged app)
  const candidateDistPaths = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(__dirname, '../../../web/dist'),
    path.resolve(__dirname, '../web/dist'),
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), 'web/dist'),
  ];
  const webDistPath = candidateDistPaths.find((p) => fs.existsSync(p)) || candidateDistPaths[0];

  const candidatePublicPaths = [
    path.resolve(__dirname, '../../web/public'),
    path.resolve(__dirname, '../../../web/public'),
    path.resolve(__dirname, '../web/public'),
    path.resolve(process.cwd(), 'apps/web/public'),
  ];
  const webPublicPath = candidatePublicPaths.find((p) => fs.existsSync(p)) || candidatePublicPaths[0];

  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
  } else if (fs.existsSync(webPublicPath)) {
    app.use(express.static(webPublicPath));
  }

  // SPA fallback — serve index.html for all unmatched routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const indexPath = fs.existsSync(webDistPath)
      ? path.join(webDistPath, 'index.html')
      : path.join(webPublicPath, 'index.html');

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>${APP_NAME}</title></head>
        <body>
          <h1>${APP_NAME} Server v${APP_VERSION}</h1>
          <p>Server is running.</p>
        </body>
        </html>
      `);
    }
  });

  // ─── Create HTTPS & HTTP Servers ──────────────────────────

  let server: https.Server | http.Server;
  let httpServer: http.Server | undefined;

  const hasCerts = fs.existsSync(config.certPath) && fs.existsSync(config.keyPath);

  if (hasCerts) {
    const sslOptions = {
      cert: fs.readFileSync(config.certPath),
      key: fs.readFileSync(config.keyPath),
    };
    server = https.createServer(sslOptions, app);
    httpServer = http.createServer(app);
    log.info('HTTPS server created for mobile camera & HTTP server created for OBS Browser Source', {
      httpsPort: config.port,
      httpPort: config.httpPort,
    });
  } else {
    log.warn(
      'TLS certificates not found — starting HTTP server. ' +
      'Camera access will NOT work on mobile browsers. ' +
      'Run "npm run setup:certs" to generate certificates.',
    );
    server = http.createServer(app);
  }

  // ─── WebSocket Signaling ───────────────────────────────────

  const serversToBind = httpServer ? [server, httpServer] : [server];
  const signaling = new SignalingServer(serversToBind, sessionManager);

  return { server, httpServer, signaling, sessionManager };
}
