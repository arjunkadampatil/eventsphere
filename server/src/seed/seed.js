const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Announcement = require('../models/Announcement');
const RefreshToken = require('../models/RefreshToken');
const { CLUBS, EVENTS, ANNOUNCEMENTS } = require('./data');

const DEMO_PASSWORD = 'Demo@1234';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Start times are anchored to the campus day in IST, so "6 PM" stays 6 PM whatever the server's timezone.
function istDate(dayOffset, hour) {
  const now = new Date();
  const istMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 5.5 * HOUR;
  return new Date(istMidnightUtc + dayOffset * DAY + hour * HOUR);
}

async function seed({ reset = false, students = 50, seedValue = 7 } = {}) {
  if (!reset && (await User.exists({ email: 'admin@eventsphere.dev' }))) {
    return { skipped: true };
  }
  faker.seed(seedValue);
  await Promise.all(
    [Announcement, Registration, Event, RefreshToken, User].map((Model) => Model.deleteMany({})),
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const people = [
    { name: 'Priya Menon', email: 'admin@eventsphere.dev', role: 'admin', passwordHash },
    ...CLUBS.map((c) => ({ name: c.name, email: c.email, role: 'club', bio: c.bio, passwordHash })),
    { name: 'Aarav Sharma', email: 'student@eventsphere.dev', role: 'student', college: 'Sitare University', passwordHash },
  ];
  const colleges = ['Sitare University', 'Sitare University', 'Sitare University', 'IIIT Lucknow', 'BBD University'];
  const seen = new Set(people.map((p) => p.email));
  while (people.filter((p) => p.role === 'student').length < students) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const email = faker.internet.email({ firstName: first, lastName: last, provider: 'students.eventsphere.dev' }).toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    people.push({ name: `${first} ${last}`, email, role: 'student', college: faker.helpers.arrayElement(colleges), passwordHash });
  }
  const users = await User.insertMany(people);
  const clubByKey = Object.fromEntries(CLUBS.map((c) => [c.key, users.find((u) => u.email === c.email)]));
  const allStudents = users.filter((u) => u.role === 'student');
  const demoStudent = allStudents.find((u) => u.email === 'student@eventsphere.dev');
  const otherStudents = allStudents.filter((u) => u !== demoStudent);

  const now = new Date();
  const events = await Event.insertMany(
    EVENTS.map(([club, title, category, day, hour, duration, venue, capacity, fee, status, tags, description]) => {
      const startsAt = istDate(day, hour);
      return {
        title,
        description,
        category,
        club: clubByKey[club]._id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + duration * HOUR),
        mode: venue ? 'offline' : 'online',
        venue: venue || 'Online',
        meetingLink: venue ? '' : 'https://meet.google.com/demo-eventsphere',
        capacity,
        fee,
        tags,
        status,
        rejectionReason: status === 'rejected' ? 'Clashes with the mid-semester exam week. Please pick another date.' : '',
        createdAt: new Date(Math.min(startsAt.getTime() - 20 * DAY, now.getTime() - DAY)),
      };
    }),
  );

  const registrations = [];
  const demoUpcoming = ['React in a Day Bootcamp', 'HackSphere: 24-Hour Hackathon', 'Spring Music Night', 'Campus 5K Fun Run'];
  const demoPast = ['Git & GitHub Crash Course', 'Founder Talk: Life at an Early-Stage Startup', 'Open Mic Evening'];
  for (const event of events.filter((e) => e.status === 'approved')) {
    const past = event.endsAt < now;
    const limit = event.capacity || 150;
    const target = Math.min(otherStudents.length, Math.round(limit * faker.number.float({ min: 0.35, max: 0.85 })));
    const attendees = faker.helpers.arrayElements(otherStudents, target);
    if (demoUpcoming.includes(event.title) || demoPast.includes(event.title)) attendees.push(demoStudent);
    for (const student of attendees.slice(0, event.capacity || attendees.length)) {
      const registeredAt = new Date(
        faker.date.between({ from: event.createdAt, to: Math.min(event.startsAt.getTime(), now.getTime()) }),
      );
      const attended = past && (student === demoStudent || faker.number.float() < 0.72);
      registrations.push({
        event: event._id,
        user: student._id,
        college: student.college,
        createdAt: registeredAt,
        updatedAt: registeredAt,
        attendedAt: attended ? new Date(event.startsAt.getTime() + faker.number.int({ min: 0, max: 40 }) * 60000) : null,
        checkedInBy: attended ? event.club : null,
      });
    }
  }
  await Registration.insertMany(registrations, { timestamps: false });

  const counts = new Map();
  for (const r of registrations) {
    const c = counts.get(r.event.toString()) ?? { reg: 0, att: 0 };
    c.reg += 1;
    if (r.attendedAt) c.att += 1;
    counts.set(r.event.toString(), c);
  }
  await Event.bulkWrite(
    events.map((e) => {
      const c = counts.get(e._id.toString()) ?? { reg: 0, att: 0 };
      return { updateOne: { filter: { _id: e._id }, update: { registrationsCount: c.reg, attendedCount: c.att } } };
    }),
  );

  const announcements = [];
  for (const event of events) {
    (ANNOUNCEMENTS[event.title] || []).forEach((message, i) => {
      const at = new Date(now.getTime() - (i + 1) * 9 * HOUR);
      announcements.push({ event: event._id, author: event.club, message, createdAt: at, updatedAt: at });
    });
  }
  await Announcement.insertMany(announcements, { timestamps: false });

  return {
    users: users.length,
    students: allStudents.length,
    clubs: CLUBS.length,
    events: events.length,
    registrations: registrations.length,
    announcements: announcements.length,
  };
}

module.exports = { seed, DEMO_PASSWORD };
