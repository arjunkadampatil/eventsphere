const crypto = require('node:crypto');
const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const env = require('../config/env');
const User = require('../models/User');
const schemas = require('../schemas');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { badRequest, unauthorized, conflict, notFound } = require('../middleware/errors');
const { passwordResetEmail } = require('../services/mailer');
const {
  REFRESH_COOKIE,
  RefreshError,
  sha256,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  refreshCookieOptions,
} = require('../services/tokens');

const router = express.Router();

async function startSession(res, user, status = 200) {
  const { token, expiresAt } = await issueRefreshToken(user._id);
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(expiresAt));
  res.status(status).json({ accessToken: signAccessToken(user), user: user.toPublic() });
}

router.get('/providers', (_req, res) => res.json({ google: env.googleEnabled }));

router.post('/register', authLimiter, validate({ body: schemas.register }), async (req, res) => {
  const { name, email, password, college } = req.body;
  if (await User.exists({ email })) throw conflict('An account with this email already exists.');
  const user = new User({ name, email, college, role: 'student' });
  await user.setPassword(password);
  await user.save();
  await startSession(res, user, 201);
});

router.post('/login', authLimiter, validate({ body: schemas.login }), async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Same message whether the email exists or not, so accounts can't be enumerated.
  if (!user || !(await user.checkPassword(req.body.password))) {
    throw unauthorized('Incorrect email or password. If you signed up with Google, use "Continue with Google".');
  }
  await startSession(res, user);
});

router.post('/refresh', async (req, res) => {
  try {
    const { userId, token, expiresAt } = await rotateRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    const user = await User.findById(userId);
    if (!user) throw new RefreshError('Account no longer exists.');
    res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(expiresAt));
    res.json({ accessToken: signAccessToken(user), user: user.toPublic() });
  } catch (err) {
    if (!(err instanceof RefreshError)) throw err;
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    throw unauthorized(err.message);
  }
});

router.post('/logout', async (req, res) => {
  await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw notFound('Account not found.');
  res.json({ user: user.toPublic() });
});

router.post('/forgot-password', authLimiter, validate({ body: schemas.forgotPassword }), async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    user.resetTokenHash = sha256(token);
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await passwordResetEmail(user, `${env.CLIENT_URL}/reset-password?token=${token}`);
  }
  res.json({ message: 'If that email is registered, a reset link is on its way.' });
});

router.post('/reset-password', authLimiter, validate({ body: schemas.resetPassword }), async (req, res) => {
  const user = await User.findOne({
    resetTokenHash: sha256(req.body.token),
    resetTokenExpires: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpires');
  if (!user) throw badRequest('This reset link is invalid or has expired.');
  await user.setPassword(req.body.password);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  res.json({ message: 'Password updated. You can sign in now.' });
});

if (env.googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (_access, _refresh, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(null, false);
          let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
          if (!user) {
            user = await User.create({
              name: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              avatarUrl: profile.photos?.[0]?.value || '',
              role: 'student',
            });
          } else if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

  // Sets the refresh cookie and sends the browser back to the client, which then calls
  // /refresh. No token ever appears in a URL or in inline script.
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${env.CLIENT_URL}/login?error=google` }),
    async (req, res) => {
      const { token, expiresAt } = await issueRefreshToken(req.user._id);
      res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(expiresAt));
      res.redirect(`${env.CLIENT_URL}/auth/callback`);
    },
  );
}

module.exports = router;
