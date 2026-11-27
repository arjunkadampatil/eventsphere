const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');

const REFRESH_COOKIE = 'es_refresh';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function signAccessToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role, name: user.name }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return { id: payload.id, role: payload.role, name: payload.name };
}

async function issueRefreshToken(userId, family = crypto.randomUUID()) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user: userId, family, tokenHash: sha256(token), expiresAt });
  return { token, expiresAt };
}

class RefreshError extends Error {}

// Exchanges a refresh token for a new one (rotation). Reusing an already-rotated token
// revokes every token in its family, logging out whoever stole it.
async function rotateRefreshToken(token) {
  if (!token) throw new RefreshError('Missing refresh token.');
  const record = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (!record || record.expiresAt < new Date()) throw new RefreshError('Session expired.');
  if (record.revokedAt) {
    await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
    throw new RefreshError('Session revoked.');
  }
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { revokedAt: new Date() },
  );
  if (!claimed) throw new RefreshError('Session revoked.');
  const next = await issueRefreshToken(record.user, record.family);
  return { userId: record.user, ...next };
}

async function revokeRefreshToken(token) {
  if (!token) return;
  const record = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (record) await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
}

function refreshCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

module.exports = {
  REFRESH_COOKIE,
  RefreshError,
  sha256,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  refreshCookieOptions,
};
