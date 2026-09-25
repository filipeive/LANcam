/**
 * LANCam Server — Structured Logger
 *
 * Provides structured JSON logging with levels.
 * No external dependency — uses console with formatting.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare function setLogLevel(level: LogLevel): void;
export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}
export declare function createLogger(component: string): Logger;
export {};
//# sourceMappingURL=logger.d.ts.map