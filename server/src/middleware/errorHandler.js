const config = require('../config/env');

// Catch 404 handler for routes that do not exist
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
};

// Centralized error handler
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Sanitized message for production
  let message = err.message || 'Internal Server Error';

  // Protect sensitive internal DB error messages
  if (config.nodeEnv === 'production' && statusCode === 500) {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  console.error(`[Error] ${req.method} ${req.originalUrl} - Status ${statusCode} - ${err.message}`);
  if (config.nodeEnv === 'development' && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.nodeEnv === 'development' && {
      stack: err.stack,
      details: err.details || null
    })
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
