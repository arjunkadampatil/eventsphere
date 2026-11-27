const http = require('node:http');
const env = require('./config/env');
const { connectDb } = require('./db');
const { createApp } = require('./app');
const { initRealtime } = require('./services/realtime');

async function main() {
  await connectDb(env.MONGODB_URI);
  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);
  server.listen(env.PORT, () => {
    console.log(`EventSphere API listening on http://localhost:${env.PORT} (docs at /api/docs)`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
