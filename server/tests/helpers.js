const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const { signAccessToken } = require('../src/services/tokens');

let mongo;
let app;

async function startDb() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = createApp();
  return app;
}

async function stopDb() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

let counter = 0;
async function makeUser(role = 'student', overrides = {}) {
  counter += 1;
  const user = new User({
    name: overrides.name ?? `${role} ${counter}`,
    email: overrides.email ?? `${role}${counter}@test.dev`,
    role,
    college: overrides.college ?? 'Test College',
  });
  await user.setPassword(overrides.password ?? 'Passw0rd!');
  await user.save();
  return user;
}

const auth = (user) => ({ Authorization: `Bearer ${signAccessToken(user)}` });

const HOUR = 60 * 60 * 1000;
function makeEvent(club, overrides = {}) {
  const startsAt = overrides.startsAt ?? new Date(Date.now() + 48 * HOUR);
  return Event.create({
    title: 'Test Event',
    description: 'A perfectly ordinary test event with a long enough description.',
    category: 'Tech',
    club: club._id,
    startsAt,
    endsAt: overrides.endsAt ?? new Date(startsAt.getTime() + 2 * HOUR),
    venue: 'Hall A',
    status: 'approved',
    ...overrides,
  });
}

const api = () => request(app);

module.exports = { startDb, stopDb, clearDb, makeUser, makeEvent, auth, api, HOUR };
