const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDb } = require('../db');
const { seed, DEMO_PASSWORD } = require('./seed');

(async () => {
  const reset = process.argv.includes('--reset');
  await connectDb(env.MONGODB_URI);
  const summary = await seed({ reset });
  if (summary.skipped) {
    console.log('Demo data already present. Run with --reset to rebuild it.');
  } else {
    console.log('Seeded:', summary);
    console.log(`Demo logins (password ${DEMO_PASSWORD}): admin@eventsphere.dev, club@eventsphere.dev, student@eventsphere.dev`);
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
