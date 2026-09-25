/**
 * LANCam Server — Structured Logger
 *
 * Provides structured JSON logging with levels.
 * No external dependency — uses console with formatting.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, component: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${component}] ${message}`;
  if (data && Object.keys(data).length > 0) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(component: string): Logger {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', component, message, data));
      }
    },
    info(message: string, data?: Record<string, unknown>) {
      if (shouldLog('info')) {
        console.info(formatMessage('info', component, message, data));
      }
    },
    warn(message: string, data?: Record<string, unknown>) {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', component, message, data));
      }
    },
    error(message: string, data?: Record<string, unknown>) {
      if (shouldLog('error')) {
        console.error(formatMessage('error', component, message, data));
      }
    },
  };
}
