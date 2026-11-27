const { verifyAccessToken } = require('../services/tokens');
const { unauthorized, forbidden } = require('./errors');

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(unauthorized('Your session has expired. Please sign in again.'));
  }
}

// Attaches req.user when a valid token is present but never rejects.
function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // ignore invalid tokens on public routes
    }
  }
  next();
}

function requireRole(...roles) {
  return [
    requireAuth,
    (req, _res, next) => (roles.includes(req.user.role) ? next() : next(forbidden())),
  ];
}

module.exports = { requireAuth, optionalAuth, requireRole };
