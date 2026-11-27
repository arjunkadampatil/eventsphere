const http = require('node:http');
const { io: ioClient } = require('socket.io-client');
const { startDb, stopDb, clearDb, makeUser, makeEvent, auth, api, HOUR } = require('./helpers');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const { sent } = require('../src/services/mailer');
const { createApp } = require('../src/app');
const { initRealtime, getIo } = require('../src/services/realtime');
const { signAccessToken } = require('../src/services/tokens');

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

describe('registering', () => {
  let club;
  let student;
  beforeEach(async () => {
    club = await makeUser('club');
    student = await makeUser('student', { name: 'Riya Sen' });
  });

  it('registers a student, issues a ticket and emails them', async () => {
    const event = await makeEvent(club, { title: 'Hack Night' });
    sent.length = 0;
    const res = await api().post(`/api/events/${event.id}/register`).set(auth(student)).send({ college: 'IIT' });
    expect(res.status).toBe(201);
    expect(res.body.registration.ticketCode).toMatch(/^[\w-]{12}$/);
    expect(res.body.registrationsCount).toBe(1);
    expect(sent[0]).toMatchObject({ to: student.email, subject: "You're registered: Hack Night" });
    expect(sent[0].text).toContain(res.body.registration.ticketCode);
  });

  it('refuses duplicates, closed, unapproved and full events', async () => {
    const event = await makeEvent(club, { capacity: 1 });
    await api().post(`/api/events/${event.id}/register`).set(auth(student)).send({});
    expect((await api().post(`/api/events/${event.id}/register`).set(auth(student)).send({})).status).toBe(409);

    const late = await makeUser('student');
    const full = await api().post(`/api/events/${event.id}/register`).set(auth(late)).send({});
    expect(full.status).toBe(409);
    expect(full.body.error.message).toMatch(/full/);

    const started = await makeEvent(club, { startsAt: new Date(Date.now() - HOUR), endsAt: new Date(Date.now() + HOUR) });
    expect((await api().post(`/api/events/${started.id}/register`).set(auth(student)).send({})).status).toBe(400);

    const pending = await makeEvent(club, { status: 'pending' });
    expect((await api().post(`/api/events/${pending.id}/register`).set(auth(student)).send({})).status).toBe(404);
  });

  it('never oversells seats under concurrent registrations', async () => {
    const event = await makeEvent(club, { capacity: 3 });
    const students = await Promise.all(Array.from({ length: 8 }, () => makeUser('student')));
    const results = await Promise.all(
      students.map((s) => api().post(`/api/events/${event.id}/register`).set(auth(s)).send({})),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await Registration.countDocuments({ event: event._id })).toBe(3);
    expect((await Event.findById(event._id)).registrationsCount).toBe(3);
  });

  it('only students can register', async () => {
    const event = await makeEvent(club);
    expect((await api().post(`/api/events/${event.id}/register`).set(auth(club)).send({})).status).toBe(403);
  });

  it('lets a student cancel before the event and frees the seat', async () => {
    const event = await makeEvent(club, { capacity: 1 });
    await api().post(`/api/events/${event.id}/register`).set(auth(student)).send({});
    expect((await api().delete(`/api/events/${event.id}/register`).set(auth(student))).status).toBe(204);
    expect((await Event.findById(event._id)).registrationsCount).toBe(0);
    expect((await api().delete(`/api/events/${event.id}/register`).set(auth(student))).status).toBe(404);
  });

  it('shows the student their tickets and registration on the event page', async () => {
    const event = await makeEvent(club, { title: 'Ticketed' });
    const reg = await api().post(`/api/events/${event.id}/register`).set(auth(student)).send({});
    const mine = await api().get('/api/me/registrations').set(auth(student));
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0]).toMatchObject({ ticketCode: reg.body.registration.ticketCode, certificateAvailable: false });
    expect(mine.body.items[0].event.title).toBe('Ticketed');

    const detail = await api().get(`/api/events/${event.id}`).set(auth(student));
    expect(detail.body.registration.ticketCode).toBe(reg.body.registration.ticketCode);
  });
});

describe('attendance', () => {
  let club;
  let event;
  let ticket;
  beforeEach(async () => {
    club = await makeUser('club');
    const student = await makeUser('student', { name: '=HYPERLINK("x")', email: 'riya@test.dev' });
    event = await makeEvent(club, { title: 'Door Test' });
    ticket = (await api().post(`/api/events/${event.id}/register`).set(auth(student)).send({ college: 'NIT, "Main"' })).body
      .registration.ticketCode;
  });

  it('checks a ticket in once, then reports it as already used', async () => {
    const first = await api().post(`/api/events/${event.id}/check-in`).set(auth(club)).send({ ticketCode: ticket });
    expect(first.status).toBe(200);
    expect(first.body.attendee.email).toBe('riya@test.dev');
    const again = await api().post(`/api/events/${event.id}/check-in`).set(auth(club)).send({ ticketCode: ticket });
    expect(again.status).toBe(409);
    expect((await Event.findById(event._id)).attendedCount).toBe(1);
  });

  it('rejects unknown tickets and tickets for a different event', async () => {
    const other = await makeEvent(club);
    expect((await api().post(`/api/events/${event.id}/check-in`).set(auth(club)).send({ ticketCode: 'nope-nope-nope' })).status).toBe(404);
    expect((await api().post(`/api/events/${other.id}/check-in`).set(auth(club)).send({ ticketCode: ticket })).status).toBe(404);
  });

  it("does not let another club check people into someone else's event", async () => {
    const rival = await makeUser('club');
    expect((await api().post(`/api/events/${event.id}/check-in`).set(auth(rival)).send({ ticketCode: ticket })).status).toBe(403);
  });

  it('lists attendees and exports a safe CSV', async () => {
    await api().post(`/api/events/${event.id}/check-in`).set(auth(club)).send({ ticketCode: ticket });
    const list = await api().get(`/api/events/${event.id}/attendees`).set(auth(club));
    expect(list.body).toMatchObject({ total: 1, attended: 1 });

    const csv = await api().get(`/api/events/${event.id}/attendees.csv`).set(auth(club));
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toContain('door-test-attendees.csv');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    const [header, row] = csv.text.slice(1).trim().split('\r\n');
    expect(header).toBe('"Name","Email","College","Ticket code","Registered at","Attended at"');
    expect(row.startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
    expect(row).toContain('"NIT, ""Main"""');
  });

  it('issues a certificate PDF only after attending a finished event', async () => {
    const student = await makeUser('student', { name: 'Kabir Das' });
    const past = await makeEvent(club, {
      title: 'Finished Talk',
      startsAt: new Date(Date.now() - 3 * HOUR),
      endsAt: new Date(Date.now() - HOUR),
    });
    const reg = await Registration.create({ event: past._id, user: student._id });
    const url = `/api/me/registrations/${reg.id}/certificate`;

    expect((await api().get(url).set(auth(student))).status).toBe(400);
    reg.attendedAt = new Date();
    await reg.save();

    const res = await api()
      .get(url)
      .set(auth(student))
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');

    const stranger = await makeUser('student');
    expect((await api().get(url).set(auth(stranger))).status).toBe(404);
  });

  it('withholds certificates until the event has ended', async () => {
    const student = await makeUser('student');
    const reg = await Registration.create({ event: event._id, user: student._id, attendedAt: new Date() });
    const res = await api().get(`/api/me/registrations/${reg.id}/certificate`).set(auth(student));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/once the event ends/);
  });
});

describe('announcements', () => {
  let server;
  let port;
  beforeAll(async () => {
    server = http.createServer(createApp());
    initRealtime(server);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });
  afterAll(async () => {
    getIo()?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const connect = (token) =>
    new Promise((resolve, reject) => {
      const socket = ioClient(`http://localhost:${port}`, { auth: token ? { token } : {}, transports: ['websocket'] });
      socket.on('connect', () => setTimeout(() => resolve(socket), 100));
      socket.on('connect_error', reject);
    });

  it('pushes announcements live to registered students and event followers', async () => {
    const club = await makeUser('club');
    const student = await makeUser('student');
    const event = await makeEvent(club, { title: 'Live Event' });
    await Registration.create({ event: event._id, user: student._id });

    const registered = await connect(signAccessToken(student));
    const follower = await connect(null);
    follower.emit('event:follow', event.id);
    await new Promise((r) => setTimeout(r, 100));

    const received = Promise.all(
      [registered, follower].map((s) => new Promise((resolve) => s.once('announcement', resolve))),
    );
    const res = await api()
      .post(`/api/events/${event.id}/announcements`)
      .set(auth(club))
      .send({ message: 'Doors open at 6 PM sharp.' });
    expect(res.status).toBe(201);

    const [a, b] = await received;
    expect(a).toMatchObject({ message: 'Doors open at 6 PM sharp.', event: { id: event.id, title: 'Live Event' } });
    expect(b.message).toBe('Doors open at 6 PM sharp.');
    registered.close();
    follower.close();

    const feed = await api().get('/api/me/announcements').set(auth(student));
    expect(feed.body.items[0]).toMatchObject({ message: 'Doors open at 6 PM sharp.', event: { title: 'Live Event' } });
    const list = await api().get(`/api/events/${event.id}/announcements`);
    expect(list.body.items).toHaveLength(1);
  });

  it('rejects sockets with an invalid token', async () => {
    await expect(connect('garbage')).rejects.toThrow('unauthorized');
  });

  it('only the hosting club can announce', async () => {
    const club = await makeUser('club');
    const rival = await makeUser('club');
    const event = await makeEvent(club);
    const res = await api().post(`/api/events/${event.id}/announcements`).set(auth(rival)).send({ message: 'Fake news' });
    expect(res.status).toBe(403);
    const tooShort = await api().post(`/api/events/${event.id}/announcements`).set(auth(club)).send({ message: 'hi' });
    expect(tooShort.status).toBe(400);
  });
});
