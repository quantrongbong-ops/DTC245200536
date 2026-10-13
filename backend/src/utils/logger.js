// ============================================================
// Winston Logger + Loki transport
// ============================================================
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, printf, colorize } = format;

const isProduction = process.env.NODE_ENV === 'production';

// Format cho console
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${stack || message}`;
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  return log;
});

const loggerTransports = [
  new transports.Console({
    format: isProduction
      ? combine(timestamp(), errors({ stack: true }), json())
      : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), consoleFormat),
  }),
];

// Thêm Loki transport nếu có URL
if (process.env.LOKI_URL) {
  try {
    const LokiTransport = require('winston-loki');
    loggerTransports.push(
      new LokiTransport({
        host: process.env.LOKI_URL,
        labels: { job: 'backend', app: 'restaurant-api' },
        json: true,
        format: combine(timestamp(), json()),
        replaceTimestamp: true,
        onConnectionError: (err) => console.error('Loki connection error:', err),
      })
    );
  } catch (e) {
    console.warn('Loki transport not available:', e.message);
  }
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: loggerTransports,
  exitOnError: false,
});

module.exports = logger;
