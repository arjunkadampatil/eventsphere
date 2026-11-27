const mongoose = require('mongoose');
const multer = require('multer');
const { ZodError } = require('zod');
const env = require('../config/env');

class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, message, details);
const unauthorized = (message = 'Authentication required.') => new AppError(401, message);
const forbidden = (message = 'You do not have permission to do that.') => new AppError(403, message);
const notFound = (message = 'Not found.') => new AppError(404, message);
const conflict = (message) => new AppError(409, message);

function notFoundHandler(req, _res, next) {
  next(notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// Every error leaves the API in one shape: { error: { message, details? } }.
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed.';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}.`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed.';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err.code === 11000) {
    status = 409;
    message = `That ${Object.keys(err.keyValue || {})[0] || 'value'} is already taken.`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Poster must be 5 MB or smaller.' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body.';
  }

  if (status >= 500) {
    if (!env.isTest) console.error(err);
    if (env.isProd) message = 'Something went wrong.';
  }

  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  notFoundHandler,
  errorHandler,
};
