const express = require('express');
const Registration = require('../models/Registration');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const schemas = require('../schemas');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { badRequest, notFound } = require('../middleware/errors');
const { renderCertificate } = require('../services/certificate');

const router = express.Router();

router.patch('/', requireAuth, validate({ body: schemas.profile }), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true, runValidators: true });
  if (!user) throw notFound('Account not found.');
  res.json({ user: user.toPublic() });
});

// GET /api/me/registrations — tickets for the student dashboard
router.get('/registrations', requireRole('student'), async (req, res) => {
  const regs = await Registration.find({ user: req.user.id })
    .populate({ path: 'event', populate: { path: 'club', select: 'name' } })
    .sort({ createdAt: -1 })
    .lean();
  const now = new Date();
  res.json({
    items: regs
      .filter((r) => r.event)
      .map((r) => ({
        id: r._id.toString(),
        ticketCode: r.ticketCode,
        registeredAt: r.createdAt,
        attendedAt: r.attendedAt,
        certificateAvailable: Boolean(r.attendedAt) && r.event.endsAt < now,
        event: {
          id: r.event._id.toString(),
          title: r.event.title,
          category: r.event.category,
          startsAt: r.event.startsAt,
          endsAt: r.event.endsAt,
          venue: r.event.venue,
          mode: r.event.mode,
          meetingLink: r.event.meetingLink,
          posterUrl: r.event.posterUrl,
          club: { id: r.event.club?._id?.toString(), name: r.event.club?.name },
        },
      })),
  });
});

// GET /api/me/announcements — latest updates from every event the student registered for
router.get('/announcements', requireRole('student'), async (req, res) => {
  const eventIds = await Registration.find({ user: req.user.id }).distinct('event');
  const items = await Announcement.find({ event: { $in: eventIds } })
    .populate('event', 'title')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  res.json({
    items: items.map((a) => ({
      id: a._id.toString(),
      message: a.message,
      createdAt: a.createdAt,
      event: a.event ? { id: a.event._id.toString(), title: a.event.title } : null,
    })),
  });
});

// GET /api/me/registrations/:id/certificate — PDF, once attended and the event has ended
router.get(
  '/registrations/:id/certificate',
  validate({ params: schemas.idParams }),
  requireRole('student'),
  async (req, res) => {
    const reg = await Registration.findOne({ _id: req.params.id, user: req.user.id })
      .populate({ path: 'event', populate: { path: 'club', select: 'name' } })
      .populate('user', 'name');
    if (!reg || !reg.event) throw notFound('Registration not found.');
    if (!reg.attendedAt) throw badRequest('Certificates are issued only to attendees who checked in.');
    if (reg.event.endsAt > new Date()) throw badRequest('Your certificate will be ready once the event ends.');

    const pdf = await renderCertificate({
      studentName: reg.user.name,
      eventTitle: reg.event.title,
      clubName: reg.event.club?.name ?? 'EventSphere',
      date: reg.event.startsAt,
      ticketCode: reg.ticketCode,
    });
    const slug = reg.event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${slug}.pdf"`);
    res.send(pdf);
  },
);

module.exports = router;
