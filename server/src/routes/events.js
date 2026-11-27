const express = require('express');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const schemas = require('../schemas');
const validate = require('../middleware/validate');
const { requireRole, optionalAuth } = require('../middleware/auth');
const { posterUpload } = require('../middleware/upload');
const { badRequest, forbidden, notFound, conflict } = require('../middleware/errors');
const { savePoster, deletePoster } = require('../services/storage');
const { registrationEmail } = require('../services/mailer');
const { publishAnnouncement, joinUserToEvent } = require('../services/realtime');

const router = express.Router();
const idParams = validate({ params: schemas.idParams });

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isOwnerOrAdmin = (user, event) =>
  user && (user.role === 'admin' || (user.role === 'club' && event.club.toString() === user.id));
const clubOf = (event) => (event.club?._id ?? event.club).toString();

async function loadManagedEvent(req) {
  const event = await Event.findById(req.params.id);
  if (!event) throw notFound('Event not found.');
  if (!isOwnerOrAdmin(req.user, event)) throw forbidden('You can only manage your own events.');
  return event;
}

// GET /api/events — public catalogue of approved events
router.get('/', validate({ query: schemas.listEvents }), async (req, res) => {
  const { q, category, club, from, to, when, sort, page, limit } = req.validQuery;
  const now = new Date();
  const filter = { status: 'approved' };
  if (when === 'upcoming') filter.endsAt = { $gte: now };
  if (when === 'past') filter.endsAt = { $lt: now };
  if (category) filter.category = category;
  if (club) filter.club = club;
  if (from || to) {
    filter.startsAt = {};
    if (from) filter.startsAt.$gte = from;
    if (to) filter.startsAt.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { tags: rx }, { venue: rx }];
  }
  const order = {
    date: when === 'past' ? { startsAt: -1 } : { startsAt: 1 },
    popular: { registrationsCount: -1, startsAt: 1 },
    newest: { createdAt: -1 },
  }[sort];

  const [items, total] = await Promise.all([
    Event.find(filter)
      .sort(order)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-meetingLink')
      .populate('club', 'name avatarUrl'),
    Event.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
});

// GET /api/events/manage — a club's own events (any status) or every event for admins
router.get('/manage', requireRole('club', 'admin'), validate({ query: schemas.manageEvents }), async (req, res) => {
  const { status, page, limit } = req.validQuery;
  const filter = req.user.role === 'club' ? { club: req.user.id } : {};
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Event.find(filter)
      .sort({ status: 1, startsAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('club', 'name'),
    Event.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
});

// GET /api/events/:id — approved events are public; others only for their club and admins
router.get('/:id', idParams, optionalAuth, async (req, res) => {
  const event = await Event.findById(req.params.id).populate('club', 'name avatarUrl bio');
  if (!event) throw notFound('Event not found.');
  if (event.status !== 'approved' && !isOwnerOrAdmin(req.user, { club: clubOf(event) })) {
    throw notFound('Event not found.');
  }
  let registration = null;
  if (req.user?.role === 'student') {
    registration = await Registration.findOne({ event: event._id, user: req.user.id }).select(
      'ticketCode attendedAt createdAt',
    );
  }
  // Online meeting links are only for registered students, the hosting club and admins.
  if (!registration && !isOwnerOrAdmin(req.user, { club: clubOf(event) })) event.meetingLink = '';
  res.json({ event, registration });
});

// POST /api/events — clubs submit events for admin approval
router.post('/', requireRole('club'), posterUpload, validate({ body: schemas.createEvent }), async (req, res) => {
  const data = { ...req.body, club: req.user.id, status: 'pending' };
  if (data.mode === 'online') data.venue = data.venue || 'Online';
  if (req.file) {
    const poster = await savePoster(req.file);
    data.posterUrl = poster.url;
    data.posterPublicId = poster.publicId;
  }
  const event = await Event.create(data);
  res.status(201).json({ event });
});

// PATCH /api/events/:id — edit; a rejected event goes back to the approval queue
router.patch(
  '/:id',
  idParams,
  requireRole('club', 'admin'),
  posterUpload,
  validate({ body: schemas.updateEvent }),
  async (req, res) => {
    const event = await loadManagedEvent(req);
    const updates = req.body;
    if (updates.capacity !== undefined && updates.capacity > 0 && updates.capacity < event.registrationsCount) {
      throw badRequest(`Capacity can't be lower than the ${event.registrationsCount} people already registered.`);
    }
    Object.assign(event, updates);
    if (event.endsAt <= event.startsAt) throw badRequest('End time must be after the start time.');
    if (req.file) {
      const old = event.posterPublicId;
      const poster = await savePoster(req.file);
      event.posterUrl = poster.url;
      event.posterPublicId = poster.publicId;
      await deletePoster(old);
    }
    if (event.status === 'rejected' && req.user.role === 'club') {
      event.status = 'pending';
      event.rejectionReason = '';
    }
    await event.save();
    res.json({ event });
  },
);

// DELETE /api/events/:id
router.delete('/:id', idParams, requireRole('club', 'admin'), async (req, res) => {
  const event = await loadManagedEvent(req);
  if (req.user.role === 'club' && event.registrationsCount > 0 && !event.isPast) {
    throw conflict('This event has registrations. Ask an admin to cancel it.');
  }
  await Promise.all([
    Registration.deleteMany({ event: event._id }),
    Announcement.deleteMany({ event: event._id }),
    deletePoster(event.posterPublicId),
  ]);
  await event.deleteOne();
  res.status(204).end();
});

// PATCH /api/events/:id/status — admin approval workflow
router.patch(
  '/:id/status',
  idParams,
  requireRole('admin'),
  validate({ body: schemas.eventStatus }),
  async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) throw notFound('Event not found.');
    event.status = req.body.status;
    event.rejectionReason = req.body.status === 'rejected' ? req.body.reason : '';
    await event.save();
    res.json({ event });
  },
);

// POST /api/events/:id/register — students register; capacity is enforced atomically
router.post(
  '/:id/register',
  idParams,
  requireRole('student'),
  validate({ body: schemas.registerForEvent }),
  async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== 'approved') throw notFound('Event not found.');
    if (event.startsAt <= new Date()) throw badRequest('Registration has closed for this event.');
    if (await Registration.exists({ event: event._id, user: req.user.id })) {
      throw conflict('You are already registered for this event.');
    }

    const seat = await Event.findOneAndUpdate(
      {
        _id: event._id,
        $or: [{ capacity: 0 }, { $expr: { $lt: ['$registrationsCount', '$capacity'] } }],
      },
      { $inc: { registrationsCount: 1 } },
      { new: true },
    );
    if (!seat) throw conflict('Sorry, this event is full.');

    let registration;
    try {
      registration = await Registration.create({ event: event._id, user: req.user.id, college: req.body.college });
    } catch (err) {
      await Event.updateOne({ _id: event._id }, { $inc: { registrationsCount: -1 } });
      if (err.code === 11000) throw conflict('You are already registered for this event.');
      throw err;
    }

    const user = await User.findById(req.user.id);
    registrationEmail(user, event, registration);
    joinUserToEvent(req.user.id, event._id);
    res.status(201).json({ registration, registrationsCount: seat.registrationsCount });
  },
);

// DELETE /api/events/:id/register — cancel before the event starts
router.delete('/:id/register', idParams, requireRole('student'), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw notFound('Event not found.');
  if (event.startsAt <= new Date()) throw badRequest('This event has already started.');
  const removed = await Registration.findOneAndDelete({ event: event._id, user: req.user.id, attendedAt: null });
  if (!removed) throw notFound('You are not registered for this event.');
  await Event.updateOne({ _id: event._id }, { $inc: { registrationsCount: -1 } });
  res.status(204).end();
});

async function attendeesOf(eventId) {
  return Registration.find({ event: eventId }).populate('user', 'name email college').sort({ createdAt: 1 }).lean();
}

// GET /api/events/:id/attendees
router.get('/:id/attendees', idParams, requireRole('club', 'admin'), async (req, res) => {
  const event = await loadManagedEvent(req);
  const rows = await attendeesOf(event._id);
  res.json({
    items: rows.map((r) => ({
      id: r._id.toString(),
      name: r.user?.name ?? 'Deleted user',
      email: r.user?.email ?? '',
      college: r.college || r.user?.college || '',
      ticketCode: r.ticketCode,
      registeredAt: r.createdAt,
      attendedAt: r.attendedAt,
    })),
    total: rows.length,
    attended: rows.filter((r) => r.attendedAt).length,
  });
});

const csvCell = (value) => {
  const s = String(value ?? '');
  // Neutralise spreadsheet formula injection and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

// GET /api/events/:id/attendees.csv
router.get('/:id/attendees.csv', idParams, requireRole('club', 'admin'), async (req, res) => {
  const event = await loadManagedEvent(req);
  const rows = await attendeesOf(event._id);
  const header = ['Name', 'Email', 'College', 'Ticket code', 'Registered at', 'Attended at'];
  const lines = rows.map((r) =>
    [
      r.user?.name,
      r.user?.email,
      r.college || r.user?.college,
      r.ticketCode,
      r.createdAt.toISOString(),
      r.attendedAt ? r.attendedAt.toISOString() : '',
    ]
      .map(csvCell)
      .join(','),
  );
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${slug || 'event'}-attendees.csv"`);
  const bom = String.fromCharCode(0xfeff); // lets Excel detect UTF-8
  res.send(`${bom}${[header.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`);
});

// POST /api/events/:id/check-in — scan a ticket QR (or type the code) at the door
router.post(
  '/:id/check-in',
  idParams,
  requireRole('club', 'admin'),
  validate({ body: schemas.checkIn }),
  async (req, res) => {
    const event = await loadManagedEvent(req);
    const registration = await Registration.findOne({ event: event._id, ticketCode: req.body.ticketCode }).populate(
      'user',
      'name email',
    );
    if (!registration) throw notFound('This ticket is not valid for this event.');
    const attendee = { name: registration.user?.name, email: registration.user?.email };
    if (registration.attendedAt) {
      throw Object.assign(conflict(`${attendee.name} is already checked in.`), {
        details: { attendee, attendedAt: registration.attendedAt },
      });
    }
    registration.attendedAt = new Date();
    registration.checkedInBy = req.user.id;
    await registration.save();
    await Event.updateOne({ _id: event._id }, { $inc: { attendedCount: 1 } });
    res.json({ attendee, attendedAt: registration.attendedAt });
  },
);

// GET /api/events/:id/announcements
router.get('/:id/announcements', idParams, optionalAuth, async (req, res) => {
  const event = await Event.findById(req.params.id).select('status club');
  if (!event || (event.status !== 'approved' && !isOwnerOrAdmin(req.user, event))) {
    throw notFound('Event not found.');
  }
  const items = await Announcement.find({ event: event._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({
    items: items.map((a) => ({ id: a._id.toString(), message: a.message, createdAt: a.createdAt })),
  });
});

// POST /api/events/:id/announcements — saved and pushed live over Socket.IO
router.post(
  '/:id/announcements',
  idParams,
  requireRole('club', 'admin'),
  validate({ body: schemas.announcement }),
  async (req, res) => {
    const event = await loadManagedEvent(req);
    const announcement = await Announcement.create({ event: event._id, author: req.user.id, message: req.body.message });
    publishAnnouncement(announcement, event);
    res.status(201).json({
      announcement: { id: announcement._id.toString(), message: announcement.message, createdAt: announcement.createdAt },
    });
  },
);

module.exports = router;
