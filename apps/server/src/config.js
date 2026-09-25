/**
 * LANCam Server — Configuration
 *
 * Loads configuration from environment variables with sensible defaults.
 * All configuration is centralized here — no scattered process.env reads.
 */
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from project root
loadEnv({ path: resolve(__dirname, '../../.env') });
loadEnv({ path: resolve(__dirname, '../../../.env') });
function getEnv(key, fallback) {
    return process.env[key] ?? fallback;
}
export function loadConfig() {
    const env = getEnv('APP_ENV', 'development');
    const port = parseInt(getEnv('APP_PORT', '3478'), 10);
    const httpPort = parseInt(getEnv('HTTP_PORT', String(port + 1)), 10);
    return {
        env,
        port,
        httpPort,
        host: getEnv('APP_HOST', '0.0.0.0'),
        logLevel: getEnv('LOG_LEVEL', env === 'production' ? 'info' : 'debug'),
        sessionTtlHours: parseInt(getEnv('SESSION_TTL_HOURS', '24'), 10),
        corsOrigin: getEnv('CORS_ORIGIN', '*'),
        certPath: resolve(__dirname, '..', getEnv('CERT_PATH', '../../certs/lancam.pem')),
        keyPath: resolve(__dirname, '..', getEnv('KEY_PATH', '../../certs/lancam-key.pem')),
        publicHost: getEnv('PUBLIC_HOST', ''),
    };
}
//# sourceMappingURL=config.js.map