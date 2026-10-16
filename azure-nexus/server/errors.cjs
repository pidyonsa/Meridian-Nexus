'use strict';
class AppError extends Error {
  constructor(code, message) {
    super(message); this.code = code;
    this.status = ({'invalid-argument':400, unauthenticated:401, 'permission-denied':403, 'not-found':404, 'failed-precondition':409, 'resource-exhausted':413, unavailable:503})[code] || 500;
  }
}
module.exports = {AppError};
