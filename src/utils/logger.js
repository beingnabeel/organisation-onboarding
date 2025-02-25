const winston = require('winston');
const path = require('path');
const { createHash } = require('crypto');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create daily rotate file options
const dailyRotateOptions = {
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
};

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      ...dailyRotateOptions
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      ...dailyRotateOptions
    }),
    // HTTP requests log file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/http.log'),
      level: 'http',
      ...dailyRotateOptions
    })
  ]
});

// Create a unique request ID
const generateRequestId = (req) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return createHash('sha256')
    .update(`${timestamp}${random}${req.ip}`)
    .digest('hex')
    .substring(0, 16);
};

// Sanitize sensitive data
const sanitizeData = (obj, sensitiveFields = ['password', 'token', 'secret', 'authorization', 'credit_card']) => {
  if (!obj) return obj;
  const sanitized = { ...obj };
  
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        obj[key] = sanitizeObject(obj[key]);
      } else if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]';
      }
    }
    return obj;
  };

  return sanitizeObject(sanitized);
};

// Performance monitoring middleware
const performanceLogger = (req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = (diff[0] * 1e9 + diff[1]) / 1e6; // Convert to milliseconds

    const memoryUsage = process.memoryUsage();

    logger.http({
      message: 'Request completed',
      metadata: {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration.toFixed(2)}ms`,
        requestId: req.requestId,
        memory: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
        }
      }
    });
  });

  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const requestId = generateRequestId(req);
  req.requestId = requestId;

  logger.info({
    message: 'Incoming request',
    metadata: {
      body: sanitizeData(req.body),
      headers: sanitizeData(req.headers),
      ip: req.ip,
      method: req.method,
      params: req.params,
      query: req.query,
      requestId,
      url: req.url,
      user: req.user,
      userAgent: req.get('user-agent')
    }
  });

  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const errorDetails = {
    message: 'Error occurred',
    metadata: {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code || 'UNKNOWN_ERROR',
        status: err.status || 500,
        isOperational: err.isOperational || false
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        query: sanitizeData(req.query),
        params: sanitizeData(req.params),
        body: sanitizeData(req.body),
        headers: sanitizeData(req.headers),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.requestId
      },
      user: req.user ? { id: req.user.id } : null,
      app: {
        env: process.env.NODE_ENV,
        version: process.env.npm_package_version,
        nodeVersion: process.version
      }
    }
  };

  if (err.isOperational) {
    logger.warn(errorDetails);
  } else {
    logger.error(errorDetails);
  }

  next(err);
};

// Export all utilities
module.exports = {
  logger,
  errorLogger,
  requestLogger,
  performanceLogger,
  sanitizeData,
  generateRequestId
};