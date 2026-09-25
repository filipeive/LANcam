/**
 * LANCam Server — Structured Logger
 *
 * Provides structured JSON logging with levels.
 * No external dependency — uses console with formatting.
 */
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
let currentLevel = 'info';
export function setLogLevel(level) {
    currentLevel = level;
}
function shouldLog(level) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}
function formatMessage(level, component, message, data) {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${component}] ${message}`;
    if (data && Object.keys(data).length > 0) {
        return `${base} ${JSON.stringify(data)}`;
    }
    return base;
}
export function createLogger(component) {
    return {
        debug(message, data) {
            if (shouldLog('debug')) {
                console.debug(formatMessage('debug', component, message, data));
            }
        },
        info(message, data) {
            if (shouldLog('info')) {
                console.info(formatMessage('info', component, message, data));
            }
        },
        warn(message, data) {
            if (shouldLog('warn')) {
                console.warn(formatMessage('warn', component, message, data));
            }
        },
        error(message, data) {
            if (shouldLog('error')) {
                console.error(formatMessage('error', component, message, data));
            }
        },
    };
}
//# sourceMappingURL=logger.js.map