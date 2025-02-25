// errorController.js
const AppError = require("../utils/appError");
const { logger } = require("../utils/logger");

// Prisma error codes and their meanings
const PRISMA_ERROR_CODES = {
  P2002: "Unique constraint violation",
  P2003: "Foreign key constraint violation",
  P2025: "Record not found",
  P2014: "Invalid ID",
  P2021: "Table does not exist",
  P2022: "Column does not exist",
};

// Detailed error handlers for different types of errors
const handlePrismaError = (err) => {
  // Log the full error for debugging
  logger.error({
    message: "Prisma Error",
    code: err.code,
    meta: err.meta,
    error: err.message,
    stack: err.stack,
  });

  // Handle specific Prisma error codes
  switch (err.code) {
    case "P2002":
      const field = err.meta?.target?.[0] || "field";
      return new AppError(
        `Duplicate value for ${field}. Please use a different value.`,
        400
      );

    case "P2003":
      return new AppError(
        "Related record not found. Please check your references.",
        400
      );

    case "P2025":
      return new AppError("Requested record not found.", 404);

    case "P2014":
      return new AppError("Invalid ID provided.", 400);

    default:
      return new AppError("Database operation failed. Please try again.", 500);
  }
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((error) => ({
    field: error.path,
    value: error.value,
    reason: error.message,
  }));

  logger.error("Validation Error:", {
    errors,
    stack: err.stack,
  });

  const message = errors.map((e) => `${e.field}: ${e.reason}`).join(". ");

  return new AppError(`Validation failed. ${message}`, 400);
};

const handleJWTError = (err) => {
  logger.error("JWT Error:", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  return new AppError(
    err.name === "TokenExpiredError"
      ? "Your session has expired. Please log in again."
      : "Invalid authentication. Please log in again.",
    401
  );
};

const handleMulterError = (err) => {
  logger.error("File Upload Error:", {
    code: err.code,
    field: err.field,
    message: err.message,
    stack: err.stack,
  });

  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return new AppError("File is too large. Maximum size is 5MB.", 400);
    case "LIMIT_UNEXPECTED_FILE":
      return new AppError(
        "Unexpected file upload. Please check the form fields.",
        400
      );
    default:
      return new AppError("File upload failed. Please try again.", 400);
  }
};

const handleSequelizeError = (err) => {
  logger.error("Sequelize Error:", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  switch (err.name) {
    case "SequelizeUniqueConstraintError":
      return new AppError("This record already exists.", 400);
    case "SequelizeValidationError":
      return new AppError("Invalid input data.", 400);
    default:
      return new AppError("Database operation failed.", 500);
  }
};

// Development error response with detailed information
const sendErrorDev = (err, res) => {
  logger.debug("Development Error:", {
    statusCode: err.statusCode,
    status: err.status,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    code: err.code,
    timestamp: new Date().toISOString(),
  });
};

// Production error response with limited information
const sendErrorProd = (err, res) => {
  // Log error details for debugging in production
  logger.error("Production Error:", {
    statusCode: err.statusCode,
    status: err.status,
    message: err.message,
    stack: err.stack,
    code: err.code,
    isOperational: err.isOperational,
    timestamp: new Date().toISOString(),
  });

  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
      timestamp: new Date().toISOString(),
    });
  }
};

// Main error handling middleware
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log the initial error
  logger.error("Initial Error:", {
    originalError: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: req.headers,
    },
  });

  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.stack = err.stack;

  // Handle different types of errors
  if (err.name?.includes("Prisma")) error = handlePrismaError(err);
  else if (err.name === "ValidationError") error = handleValidationErrorDB(err);
  else if (["JsonWebTokenError", "TokenExpiredError"].includes(err.name))
    error = handleJWTError(err);
  else if (err.name === "MulterError") error = handleMulterError(err);
  else if (err.name?.includes("Sequelize")) error = handleSequelizeError(err);

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};
