const { startDb, stopDb, api } = require('./helpers');
const openapi = require('../src/docs/openapi');

beforeAll(startDb);
afterAll(stopDb);

it('reports health and database status', async () => {
  const res = await api().get('/api/health');
  expect(res.body).toEqual({ status: 'ok', database: 'connected' });
});

it('returns JSON errors for unknown routes and malformed bodies', async () => {
  const missing = await api().get('/api/nope');
  expect(missing.status).toBe(404);
  expect(missing.body.error.message).toMatch(/No route/);

  const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
  expect(bad.status).toBe(400);
  expect(bad.body.error.message).toBe('Malformed JSON body.');
});

it('rejects invalid ObjectIds with 400 instead of crashing', async () => {
  const res = await api().get('/api/events/not-an-id');
  expect(res.status).toBe(400);
});

it('sets security headers and hides the framework', async () => {
  const res = await api().get('/api/health');
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-powered-by']).toBeUndefined();
});

it('allows CORS only from configured origins', async () => {
  const allowed = await api().get('/api/health').set('Origin', 'http://localhost:5173');
  expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  expect(allowed.headers['access-control-allow-credentials']).toBe('true');
  const blocked = await api().get('/api/health').set('Origin', 'https://evil.example');
  expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
});

it('serves the OpenAPI spec and Swagger UI', async () => {
  const spec = await api().get('/api/openapi.json');
  expect(spec.body.openapi).toBe('3.0.3');
  expect(Object.keys(openapi.paths).length).toBeGreaterThanOrEqual(20);
  const docs = await api().get('/api/docs/');
  expect(docs.status).toBe(200);
  expect(docs.text).toMatch(/swagger/i);
});

it('rate limits repeated login attempts', async () => {
  process.env.TEST_RATE_LIMIT = '1';
  try {
    let last;
    for (let i = 0; i < 21; i += 1) {
      last = await api().post('/api/auth/login').send({ email: 'x@test.dev', password: 'whatever1' });
    }
    expect(last.status).toBe(429);
    expect(last.headers).toHaveProperty('ratelimit');
  } finally {
    delete process.env.TEST_RATE_LIMIT;
  }
});
