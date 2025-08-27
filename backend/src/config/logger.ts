import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Configure Pino logger with appropriate settings for development and production
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  // transport: isDevelopment
  //   ? {
  //       target: 'npm:pino-pretty',
  //       options: {
  //         colorize: true,
  //         translateTime: 'SYS:standard',
  //         ignore: 'pid,hostname',
  //       }
  //     }
  //   : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'hems-emulator',
    version: '1.0.0',
  }
});

/**
 * Create child logger for specific modules
 */
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const reqLogger = logger.child({
    reqId: Math.random().toString(36).substring(7),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  reqLogger.info('Request started');

  res.on('finish', () => {
    const duration = Date.now() - start;
    reqLogger.info({
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    }, 'Request completed');
  });

  req.logger = reqLogger;
  next();
}; 