const fs = require('node:fs/promises');
const path = require('node:path');
const { startDb, stopDb, clearDb, makeUser, makeEvent, auth, api, HOUR } = require('./helpers');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const { LOCAL_DIR } = require('../src/services/storage');

beforeAll(startDb);
afterAll(async () => {
  await fs.rm(LOCAL_DIR, { recursive: true, force: true });
  await stopDb();
});
afterEach(clearDb);

const future = (hours) => new Date(Date.now() + hours * HOUR).toISOString();
const validEvent = () => ({
  title: 'Intro to Rust',
  description: 'A hands-on introduction to ownership, borrowing and cargo.',
  category: 'Workshop',
  startsAt: future(24),
  endsAt: future(26),
  venue: 'Lab 2',
  capacity: '40',
  tags: 'rust, systems, Rust',
});

describe('public catalogue', () => {
  let club;
  beforeEach(async () => {
    club = await makeUser('club', { name: 'Coding Club' });
  });

  it('lists only approved, upcoming events by default', async () => {
    await makeEvent(club, { title: 'Live one' });
    await makeEvent(club, { title: 'Pending one', status: 'pending' });
    await makeEvent(club, { title: 'Old one', startsAt: new Date(Date.now() - 48 * HOUR), endsAt: new Date(Date.now() - 46 * HOUR) });
    const res = await api().get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.items.map((e) => e.title)).toEqual(['Live one']);
    expect(res.body.items[0].club.name).toBe('Coding Club');
    expect(res.body.items[0]).not.toHaveProperty('meetingLink');

    const past = await api().get('/api/events?when=past');
    expect(past.body.items.map((e) => e.title)).toEqual(['Old one']);
  });

  it('filters by search, category, club and date range', async () => {
    const other = await makeUser('club');
    await makeEvent(club, { title: 'Rust Workshop', category: 'Workshop', startsAt: new Date(Date.now() + 24 * HOUR) });
    await makeEvent(club, { title: 'Football Final', category: 'Sports', startsAt: new Date(Date.now() + 10 * 24 * HOUR) });
    await makeEvent(other, { title: 'Rust Meetup', category: 'Tech', startsAt: new Date(Date.now() + 5 * 24 * HOUR) });

    const titles = async (q) => (await api().get(`/api/events${q}`)).body.items.map((e) => e.title).sort();
    expect(await titles('?q=rust')).toEqual(['Rust Meetup', 'Rust Workshop']);
    expect(await titles('?q=(rust')).toEqual([]);
    expect(await titles('?category=Sports')).toEqual(['Football Final']);
    expect(await titles(`?club=${other.id}`)).toEqual(['Rust Meetup']);
    const to = new Date(Date.now() + 6 * 24 * HOUR).toISOString().slice(0, 10);
    expect(await titles(`?to=${to}`)).toEqual(['Rust Meetup', 'Rust Workshop']);
  });

  it('paginates and sorts by popularity', async () => {
    for (let i = 0; i < 5; i += 1) {
      await makeEvent(club, { title: `E${i}`, registrationsCount: i, startsAt: new Date(Date.now() + (i + 1) * HOUR) });
    }
    const page2 = await api().get('/api/events?limit=2&page=2');
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 5, pages: 3 });
    expect(page2.body.items.map((e) => e.title)).toEqual(['E2', 'E3']);
    const popular = await api().get('/api/events?sort=popular&limit=1');
    expect(popular.body.items[0].title).toBe('E4');
  });

  it('rejects bad query parameters', async () => {
    expect((await api().get('/api/events?category=Nope')).status).toBe(400);
    expect((await api().get('/api/events?limit=500')).status).toBe(400);
  });

  it('hides unapproved events from the public but shows them to their club and admins', async () => {
    const event = await makeEvent(club, { status: 'pending' });
    expect((await api().get(`/api/events/${event.id}`)).status).toBe(404);
    expect((await api().get(`/api/events/${event.id}`).set(auth(club))).status).toBe(200);
    const admin = await makeUser('admin');
    expect((await api().get(`/api/events/${event.id}`).set(auth(admin))).status).toBe(200);
    const otherClub = await makeUser('club');
    expect((await api().get(`/api/events/${event.id}`).set(auth(otherClub))).status).toBe(404);
  });

  it('reveals online meeting links only to registered students and the host', async () => {
    const event = await makeEvent(club, { mode: 'online', venue: 'Online', meetingLink: 'https://meet.example/abc' });
    const student = await makeUser('student');
    expect((await api().get(`/api/events/${event.id}`)).body.event.meetingLink).toBe('');
    expect((await api().get(`/api/events/${event.id}`).set(auth(club))).body.event.meetingLink).toBe('https://meet.example/abc');
    await Registration.create({ event: event._id, user: student._id });
    expect((await api().get(`/api/events/${event.id}`).set(auth(student))).body.event.meetingLink).toBe('https://meet.example/abc');
  });
});

describe('creating and editing', () => {
  let club;
  beforeEach(async () => {
    club = await makeUser('club');
  });

  it('lets a club submit an event, which starts as pending', async () => {
    const res = await api().post('/api/events').set(auth(club)).send(validEvent());
    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({ status: 'pending', capacity: 40, tags: ['rust', 'systems'] });
  });

  it('accepts a poster upload as multipart form data', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const req = api().post('/api/events').set(auth(club));
    Object.entries(validEvent()).forEach(([k, v]) => req.field(k, v));
    const res = await req.attach('poster', png, { filename: 'poster.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.event.posterUrl).toMatch(/^\/uploads\/posters\/.+\.png$/);
    const file = path.join(LOCAL_DIR, path.basename(res.body.event.posterUrl));
    await expect(fs.stat(file)).resolves.toBeTruthy();
    const served = await api().get(res.body.event.posterUrl);
    expect(served.status).toBe(200);
  });

  it('rejects non-image posters', async () => {
    const req = api().post('/api/events').set(auth(club));
    Object.entries(validEvent()).forEach(([k, v]) => req.field(k, v));
    const res = await req.attach('poster', Buffer.from('MZ'), { filename: 'evil.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/JPG, PNG or WebP/);
  });

  it('validates timing and venue rules', async () => {
    const res = await api()
      .post('/api/events')
      .set(auth(club))
      .send({ ...validEvent(), startsAt: future(-1), endsAt: future(-2), venue: '' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['startsAt', 'endsAt', 'venue']));

    const online = await api().post('/api/events').set(auth(club)).send({ ...validEvent(), mode: 'online', venue: '' });
    expect(online.status).toBe(400);
    expect(online.body.error.details[0].path).toBe('meetingLink');
  });

  it('only clubs can create events', async () => {
    const student = await makeUser('student');
    expect((await api().post('/api/events').set(auth(student)).send(validEvent())).status).toBe(403);
    expect((await api().post('/api/events').send(validEvent())).status).toBe(401);
  });

  it('only the owning club (or an admin) can edit', async () => {
    const event = await makeEvent(club);
    const intruder = await makeUser('club');
    expect((await api().patch(`/api/events/${event.id}`).set(auth(intruder)).send({ title: 'Hijacked' })).status).toBe(403);
    const ok = await api().patch(`/api/events/${event.id}`).set(auth(club)).send({ title: 'Renamed event' });
    expect(ok.body.event.title).toBe('Renamed event');
  });

  it('keeps edits consistent with existing data', async () => {
    const event = await makeEvent(club, { capacity: 10, registrationsCount: 6 });
    const shrink = await api().patch(`/api/events/${event.id}`).set(auth(club)).send({ capacity: 5 });
    expect(shrink.status).toBe(400);
    const badEnd = await api()
      .patch(`/api/events/${event.id}`)
      .set(auth(club))
      .send({ endsAt: new Date(event.startsAt.getTime() - HOUR).toISOString() });
    expect(badEnd.status).toBe(400);
  });

  it('resubmits a rejected event for review when the club edits it', async () => {
    const event = await makeEvent(club, { status: 'rejected', rejectionReason: 'Clash' });
    const res = await api().patch(`/api/events/${event.id}`).set(auth(club)).send({ venue: 'Hall B' });
    expect(res.body.event).toMatchObject({ status: 'pending', rejectionReason: '' });
  });

  it('lists a club its own events in every status, and admins everything', async () => {
    const other = await makeUser('club');
    await makeEvent(club, { status: 'pending' });
    await makeEvent(club, { status: 'rejected' });
    await makeEvent(other);
    expect((await api().get('/api/events/manage').set(auth(club))).body.total).toBe(2);
    const admin = await makeUser('admin');
    expect((await api().get('/api/events/manage?status=pending').set(auth(admin))).body.total).toBe(1);
    const student = await makeUser('student');
    expect((await api().get('/api/events/manage').set(auth(student))).status).toBe(403);
  });
});

describe('approval and deletion', () => {
  it('lets admins approve, and requires a reason to reject', async () => {
    const club = await makeUser('club');
    const admin = await makeUser('admin');
    const event = await makeEvent(club, { status: 'pending' });

    expect((await api().patch(`/api/events/${event.id}/status`).set(auth(club)).send({ status: 'approved' })).status).toBe(403);
    const noReason = await api().patch(`/api/events/${event.id}/status`).set(auth(admin)).send({ status: 'rejected' });
    expect(noReason.status).toBe(400);
    const bogus = await api().patch(`/api/events/${event.id}/status`).set(auth(admin)).send({ status: 'whatever' });
    expect(bogus.status).toBe(400);

    const rejected = await api()
      .patch(`/api/events/${event.id}/status`)
      .set(auth(admin))
      .send({ status: 'rejected', reason: 'Venue unavailable' });
    expect(rejected.body.event).toMatchObject({ status: 'rejected', rejectionReason: 'Venue unavailable' });
    const approved = await api().patch(`/api/events/${event.id}/status`).set(auth(admin)).send({ status: 'approved' });
    expect(approved.body.event).toMatchObject({ status: 'approved', rejectionReason: '' });
  });

  it('stops a club deleting an upcoming event that people registered for, but lets admins', async () => {
    const club = await makeUser('club');
    const admin = await makeUser('admin');
    const event = await makeEvent(club, { registrationsCount: 3 });
    expect((await api().delete(`/api/events/${event.id}`).set(auth(club))).status).toBe(409);
    expect((await api().delete(`/api/events/${event.id}`).set(auth(admin))).status).toBe(204);
    expect(await Event.exists({ _id: event._id })).toBeNull();
  });

  it('returns 404 for events that do not exist', async () => {
    const admin = await makeUser('admin');
    const missing = '64b7f0000000000000000000';
    expect((await api().get(`/api/events/${missing}`)).status).toBe(404);
    expect((await api().patch(`/api/events/${missing}/status`).set(auth(admin)).send({ status: 'approved' })).status).toBe(404);
  });
});
