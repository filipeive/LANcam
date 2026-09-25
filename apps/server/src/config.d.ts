/**
 * LANCam Server — Configuration
 *
 * Loads configuration from environment variables with sensible defaults.
 * All configuration is centralized here — no scattered process.env reads.
 */
export interface ServerConfig {
    env: 'development' | 'production';
    port: number;
    httpPort: number;
    host: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    sessionTtlHours: number;
    corsOrigin: string;
    certPath: string;
    keyPath: string;
    publicHost: string;
}
export declare function loadConfig(): ServerConfig;
//# sourceMappingURL=config.d.ts.map