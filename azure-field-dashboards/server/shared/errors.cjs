'use strict';
const crypto = require('node:crypto');

const STATUS = {'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403, 'not-found': 404, 'already-exists': 409, 'failed-precondition': 409, 'resource-exhausted': 413, 'too-many-requests': 429, unavailable: 503};

// An error whose message is safe to show the signed-in user. Anything else is reported as a generic failure.
class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.status = STATUS[code] || 500;
    this.details = details;
  }
}

function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}

function errorHandler(log = console) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) => {
    const known = error instanceof AppError;
    if (!known) log.error(JSON.stringify({event: 'request-failed', requestId: req.id, path: req.path, error: String(error?.stack || error).slice(0, 2000)}));
    const status = known ? error.status : error?.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({error: {code: known ? error.code : 'internal', message: known ? error.message : 'Something went wrong. Try again, or contact the Nexus administrator with this reference.', requestId: req.id, ...(known && error.details ? {details: error.details} : {})}});
  };
}

module.exports = {AppError, requestId, errorHandler};
