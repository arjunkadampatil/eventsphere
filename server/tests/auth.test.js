const { startDb, stopDb, clearDb, makeUser, auth, api } = require('./helpers');
const RefreshToken = require('../src/models/RefreshToken');
const { sent } = require('../src/services/mailer');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('es_refresh='));
const cookieValue = (cookie) => cookie.split(';')[0];

describe('register', () => {
  it('creates a student, returns an access token and sets an httpOnly refresh cookie', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'ASHA@Example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha Rao', email: 'asha@example.com', role: 'student' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('never lets a signup choose its own role', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'secret123', role: 'admin' });
    expect(res.body.user.role).toBe('student');
  });

  it('rejects duplicates and weak input with field-level details', async () => {
    await makeUser('student', { email: 'taken@example.com' });
    const dup = await api().post('/api/auth/register').send({ name: 'Dup', email: 'taken@example.com', password: 'secret123' });
    expect(dup.status).toBe(409);

    const weak = await api().post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    expect(weak.status).toBe(400);
    const paths = weak.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('login', () => {
  it('signs in with the right password', async () => {
    const user = await makeUser('club', { email: 'club@test.dev' });
    const res = await api().post('/api/auth/login').send({ email: 'club@test.dev', password: 'Passw0rd!' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, role: 'club' });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await makeUser('student', { email: 'real@test.dev' });
    const wrong = await api().post('/api/auth/login').send({ email: 'real@test.dev', password: 'nope12345' });
    const ghost = await api().post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'nope12345' });
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(wrong.body).toEqual(ghost.body);
  });
});

describe('sessions', () => {
  async function login() {
    await makeUser('student', { email: 's@test.dev' });
    const res = await api().post('/api/auth/login').send({ email: 's@test.dev', password: 'Passw0rd!' });
    return cookieValue(cookieOf(res));
  }

  it('rotates the refresh token on every refresh', async () => {
    const first = await login();
    const res = await api().post('/api/auth/refresh').set('Cookie', first);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const second = cookieValue(cookieOf(res));
    expect(second).not.toBe(first);
  });

  it('revokes the whole family when an old refresh token is replayed', async () => {
    const first = await login();
    const rotated = await api().post('/api/auth/refresh').set('Cookie', first);
    const second = cookieValue(cookieOf(rotated));

    const replay = await api().post('/api/auth/refresh').set('Cookie', first);
    expect(replay.status).toBe(401);
    const afterTheft = await api().post('/api/auth/refresh').set('Cookie', second);
    expect(afterTheft.status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });

  it('logout revokes the refresh token', async () => {
    const cookie = await login();
    expect((await api().post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await api().post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('refresh without a cookie is a quiet 204, a bad cookie is 401', async () => {
    expect((await api().post('/api/auth/refresh')).status).toBe(204);
    expect((await api().post('/api/auth/refresh').set('Cookie', 'es_refresh=forged')).status).toBe(401);
  });

  it('/me needs a valid access token', async () => {
    const user = await makeUser('admin');
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt')).status).toBe(401);
    const res = await api().get('/api/auth/me').set(auth(user));
    expect(res.body.user.role).toBe('admin');
  });
});

describe('password reset', () => {
  it('emails a single-use link that sets a new password', async () => {
    await makeUser('student', { email: 'forgetful@test.dev' });
    sent.length = 0;
    const ask = await api().post('/api/auth/forgot-password').send({ email: 'forgetful@test.dev' });
    expect(ask.status).toBe(200);
    const token = sent[0].text.match(/token=([\w-]+)/)[1];

    const reset = await api().post('/api/auth/reset-password').send({ token, password: 'brandNew9' });
    expect(reset.status).toBe(200);
    const login = await api().post('/api/auth/login').send({ email: 'forgetful@test.dev', password: 'brandNew9' });
    expect(login.status).toBe(200);
    const again = await api().post('/api/auth/reset-password').send({ token, password: 'another99' });
    expect(again.status).toBe(400);
  });

  it('does not reveal whether an email is registered', async () => {
    sent.length = 0;
    const res = await api().post('/api/auth/forgot-password').send({ email: 'nobody@test.dev' });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });
});

it('reports which social providers are enabled', async () => {
  const res = await api().get('/api/auth/providers');
  expect(res.body).toEqual({ google: false });
});
