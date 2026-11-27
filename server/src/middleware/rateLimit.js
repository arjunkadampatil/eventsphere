const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const options = (windowMinutes, limit) => ({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest && !process.env.TEST_RATE_LIMIT,
  handler: (_req, res) =>
    res.status(429).json({ error: { message: 'Too many requests. Please try again in a few minutes.' } }),
});

const apiLimiter = rateLimit(options(15, 600));
const authLimiter = rateLimit(options(15, 20));

module.exports = { apiLimiter, authLimiter };
