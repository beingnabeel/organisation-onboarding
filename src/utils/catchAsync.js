// catchAsync.js
const { logger } = require("./logger");

/**
 * Wraps an async function to catch errors and pass them to Express error handler
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Express middleware function
 */
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      logger.error({
        message: "Caught async error",
        metadata: {
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code
          },
          request: {
            method: req.method,
            url: req.originalUrl,
            params: req.params,
            query: req.query,
            requestId: req.requestId
          }
        }
      });

      next(err);
    });
  };
};
