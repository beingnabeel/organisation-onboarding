// appError.js
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.code = errorCode;
    this.timestamp = new Date().toISOString();

    // Add request ID if available
    if (global.requestId) {
      this.requestId = global.requestId;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      status: this.status,
      code: this.code,
      timestamp: this.timestamp,
      requestId: this.requestId,
      isOperational: this.isOperational,
    };
  }
}

module.exports = AppError;
