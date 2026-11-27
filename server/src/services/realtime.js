const { Server } = require('socket.io');
const env = require('../config/env');
const Registration = require('../models/Registration');
const { verifyAccessToken } = require('./tokens');

let io = null;

const eventRoom = (eventId) => `event:${eventId}`;

// Sockets may connect anonymously (to follow a public event page) or with an access token,
// in which case they are joined to every event the student is registered for.
function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.data.user = verifyAccessToken(token);
      } catch {
        return next(new Error('unauthorized'));
      }
    }
    return next();
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    if (user) {
      socket.join(`user:${user.id}`);
      const regs = await Registration.find({ user: user.id }).select('event').lean();
      regs.forEach((r) => socket.join(eventRoom(r.event)));
    }
    socket.on('event:follow', (eventId) => {
      if (typeof eventId === 'string' && /^[a-f0-9]{24}$/i.test(eventId)) socket.join(eventRoom(eventId));
    });
    socket.on('event:unfollow', (eventId) => {
      if (typeof eventId === 'string') socket.leave(eventRoom(eventId));
    });
  });

  return io;
}

function publishAnnouncement(announcement, event) {
  if (!io) return;
  io.to(eventRoom(event._id)).emit('announcement', {
    id: announcement._id.toString(),
    message: announcement.message,
    createdAt: announcement.createdAt,
    event: { id: event._id.toString(), title: event.title },
  });
}

function joinUserToEvent(userId, eventId) {
  if (io) io.in(`user:${userId}`).socketsJoin(eventRoom(eventId));
}

module.exports = { initRealtime, publishAnnouncement, joinUserToEvent, getIo: () => io };
