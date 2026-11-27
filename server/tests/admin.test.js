const { startDb, stopDb, clearDb, makeUser, makeEvent, auth, api, HOUR } = require('./helpers');
const env = require('../src/config/env');
const Registration = require('../src/models/Registration');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const { seed } = require('../src/seed/seed');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

describe('analytics', () => {
  it('summarises users, events, registrations and attendance for admins only', async () => {
    const admin = await makeUser('admin');
    const club = await makeUser('club', { name: 'Robotics' });
    const students = await Promise.all([makeUser('student'), makeUser('student')]);
    const event = await makeEvent(club, { title: 'Bot Race', category: 'Tech', fee: 50, registrationsCount: 2, attendedCount: 1 });
    await makeEvent(club, { status: 'pending' });
    await Registration.create([
      { event: event._id, user: students[0]._id, attendedAt: new Date() },
      { event: event._id, user: students[1]._id },
    ]);

    expect((await api().get('/api/admin/analytics').set(auth(club))).status).toBe(403);
    const res = await api().get('/api/admin/analytics').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.kpis).toMatchObject({
      students: 2,
      clubs: 1,
      approvedEvents: 1,
      pendingEvents: 1,
      registrations: 2,
      attendanceRate: 50,
      revenue: 100,
    });
    expect(res.body.registrationsByMonth).toHaveLength(6);
    expect(res.body.registrationsByMonth.at(-1)).toMatchObject({ registrations: 2, attended: 1 });
    expect(res.body.eventsByCategory).toEqual([{ category: 'Tech', events: 1, registrations: 2 }]);
    expect(res.body.topEvents[0]).toMatchObject({ title: 'Bot Race', club: 'Robotics', registrations: 2 });
  });
});

describe('clubs', () => {
  it('lists clubs with their approved event counts', async () => {
    const a = await makeUser('club', { name: 'Alpha Club' });
    await makeUser('club', { name: 'Beta Club' });
    await makeEvent(a);
    await makeEvent(a, { status: 'pending' });
    const res = await api().get('/api/clubs');
    expect(res.body.items.map((c) => [c.name, c.events])).toEqual([
      ['Alpha Club', 1],
      ['Beta Club', 0],
    ]);
  });
});

describe('profile', () => {
  it('updates allowed fields only', async () => {
    const student = await makeUser('student');
    const res = await api().patch('/api/me').set(auth(student)).send({ college: 'IIIT Lucknow', role: 'admin' });
    expect(res.body.user).toMatchObject({ college: 'IIIT Lucknow', role: 'student' });
  });
});

describe('demo seed', () => {
  it('creates the demo world with relative dates and consistent counters', async () => {
    const summary = await seed({ reset: true, students: 20 });
    expect(summary).toMatchObject({ clubs: 6, events: 20, students: 20 });
    expect(await User.exists({ email: 'student@eventsphere.dev' })).toBeTruthy();

    const now = new Date();
    expect(await Event.countDocuments({ status: 'approved', startsAt: { $gt: now } })).toBeGreaterThan(5);
    expect(await Event.countDocuments({ status: 'approved', endsAt: { $lt: now } })).toBeGreaterThan(2);
    expect(await Event.countDocuments({ status: 'pending' })).toBe(2);

    for (const e of await Event.find()) {
      expect(await Registration.countDocuments({ event: e._id })).toBe(e.registrationsCount);
      if (e.capacity) expect(e.registrationsCount).toBeLessThanOrEqual(e.capacity);
    }

    const demo = await User.findOne({ email: 'student@eventsphere.dev' });
    const demoRegs = await Registration.find({ user: demo._id }).populate('event');
    expect(demoRegs.some((r) => r.attendedAt && r.event.endsAt < now)).toBe(true);
    expect(demoRegs.some((r) => r.event.startsAt > now)).toBe(true);

    expect(await seed()).toEqual({ skipped: true });
  });

  it('lets the demo accounts sign in', async () => {
    await seed({ reset: true, students: 5 });
    const res = await api().post('/api/auth/login').send({ email: 'club@eventsphere.dev', password: 'Demo@1234' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('club');
  });
});

describe('scheduled reseed endpoint', () => {
  const original = { demo: env.DEMO_MODE, secret: env.RESEED_SECRET };
  afterEach(() => {
    env.DEMO_MODE = original.demo;
    env.RESEED_SECRET = original.secret;
  });

  it('is hidden unless configured', async () => {
    env.RESEED_SECRET = undefined;
    expect((await api().post('/api/admin/reseed')).status).toBe(404);
  });

  it('requires the exact secret', async () => {
    env.RESEED_SECRET = 'top-secret-value';
    env.DEMO_MODE = true;
    expect((await api().post('/api/admin/reseed')).status).toBe(401);
    expect((await api().post('/api/admin/reseed').set('Authorization', 'Bearer top-secret-valuE')).status).toBe(401);
    const ok = await api().post('/api/admin/reseed').set('Authorization', 'Bearer top-secret-value');
    expect(ok.status).toBe(200);
    expect(ok.body.summary.events).toBe(20);
  }, 60000);

  it('is disabled when demo mode is off', async () => {
    env.RESEED_SECRET = 'top-secret-value';
    env.DEMO_MODE = false;
    expect((await api().post('/api/admin/reseed').set('Authorization', 'Bearer top-secret-value')).status).toBe(404);
  });

  it('keeps old events out of the upcoming list after time passes', async () => {
    const club = await makeUser('club');
    await makeEvent(club, { startsAt: new Date(Date.now() - 5 * HOUR), endsAt: new Date(Date.now() - 4 * HOUR) });
    expect((await api().get('/api/events')).body.total).toBe(0);
  });
});
