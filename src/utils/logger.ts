type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

// Memory ring buffer of recent logs for the web admin panel
const inMemoryLogs: LogEntry[] = [];
const MAX_IN_MEMORY_LOGS = 200;

function sanitize(data: unknown): unknown {
  if (typeof data === 'string') {
    // Redact bot token formats like 123456789:ABCdef...
    return data
      .replace(/\d{8,12}:[A-Za-z0-9_-]{30,45}/g, '[REDACTED_BOT_TOKEN]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  }
  if (typeof data === 'object' && data !== null) {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (['token', 'bot_token', 'apiKey', 'secret', 'password', 'authorization'].some(s => key.toLowerCase().includes(s))) {
        copy[key] = '[REDACTED]';
      } else {
        copy[key] = sanitize(value);
      }
    }
    return copy;
  }
  return data;
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const cleanMessage = sanitize(message) as string;
  const cleanMeta = meta ? (sanitize(meta) as Record<string, unknown>) : undefined;

  const entry: LogEntry = {
    level,
    message: cleanMessage,
    timestamp,
    meta: cleanMeta,
  };

  inMemoryLogs.unshift(entry);
  if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryLogs.pop();
  }

  const metaStr = cleanMeta && Object.keys(cleanMeta).length > 0 ? ` ${JSON.stringify(cleanMeta)}` : '';
  const logLine = `[${level}] ${timestamp} - ${cleanMessage}${metaStr}`;

  if (level === 'ERROR') {
    console.error(logLine);
  } else if (level === 'WARN') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => writeLog('INFO', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog('WARN', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog('ERROR', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => writeLog('DEBUG', message, meta),
  getRecentLogs: () => [...inMemoryLogs],
};
