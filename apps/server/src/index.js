/**
 * LANCam Server — Entry Point
 *
 * Bootstraps configuration, creates server, and starts listening.
 */
import { loadConfig } from './config.js';
import { setLogLevel, createLogger } from './logger.js';
import { createServer, getLocalIPs } from './server.js';
import { SessionManager } from './session.js';
import { SignalingServer } from './signaling.js';
import { APP_NAME, APP_VERSION } from '@lancam/shared';
import fs from 'fs';
export { loadConfig, setLogLevel, createLogger, createServer, getLocalIPs, SessionManager, SignalingServer };
const config = loadConfig();
setLogLevel(config.logLevel);
const log = createLogger('main');
async function main() {
    log.info(`Starting ${APP_NAME} v${APP_VERSION}`, {
        env: config.env,
        port: config.port,
        logLevel: config.logLevel,
    });
    const { server, httpServer, signaling, sessionManager } = await createServer(config);
    // Start listening on primary server (HTTPS)
    server.listen(config.port, config.host, () => {
        const localIPs = getLocalIPs();
        const hasCerts = fs.existsSync(config.certPath) && fs.existsSync(config.keyPath);
        console.log('');
        console.log(`  ╔══════════════════════════════════════════════╗`);
        console.log(`  ║                                              ║`);
        console.log(`  ║   ${APP_NAME} v${APP_VERSION}                         ║`);
        console.log(`  ║   Local Network Camera                       ║`);
        console.log(`  ║                                              ║`);
        console.log(`  ╠══════════════════════════════════════════════╣`);
        console.log(`  ║                                              ║`);
        console.log(`  ║   Dashboard (HTTPS):                         ║`);
        for (const ip of localIPs) {
            const url = `https://${ip}:${config.port}`;
            const padded = url.padEnd(38);
            console.log(`  ║     ${padded}  ║`);
        }
        if (hasCerts && httpServer) {
            console.log(`  ║                                              ║`);
            console.log(`  ║   OBS Browser Source (HTTP - SSL Free):      ║`);
            for (const ip of localIPs) {
                const url = `http://${ip}:${config.httpPort}`;
                const padded = url.padEnd(38);
                console.log(`  ║     ${padded}  ║`);
            }
        }
        console.log(`  ║                                              ║`);
        console.log(`  ║   ✓  HTTPS Enabled (Port ${config.port})            ║`);
        if (httpServer) {
            console.log(`  ║   ✓  HTTP Enabled for OBS (Port ${config.httpPort})     ║`);
        }
        console.log(`  ║                                              ║`);
        console.log(`  ╚══════════════════════════════════════════════╝`);
        console.log('');
    });
    // Start listening on HTTP server for OBS Browser Source if present
    if (httpServer) {
        httpServer.listen(config.httpPort, config.host);
    }
    // Periodic cleanup of expired sessions
    const cleanupInterval = setInterval(() => sessionManager.cleanupExpired(config.sessionTtlHours), 60 * 60 * 1000);
    // Graceful shutdown
    const shutdown = (signal) => {
        log.info(`Received ${signal}, shutting down...`);
        clearInterval(cleanupInterval);
        signaling.shutdown();
        server.close(() => {
            if (httpServer) {
                httpServer.close();
            }
            log.info('Server stopped');
            process.exit(0);
        });
        // Force exit after 5 seconds
        setTimeout(() => {
            log.error('Forced shutdown after timeout');
            process.exit(1);
        }, 5000);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
// Execute main if run directly
main().catch((err) => {
    log.error('Fatal error', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
});
//# sourceMappingURL=index.js.map