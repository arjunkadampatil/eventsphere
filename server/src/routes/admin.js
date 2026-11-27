const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const env = require('../config/env');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { notFound, unauthorized } = require('../middleware/errors');

const router = express.Router();

const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// GET /api/admin/analytics — everything the admin dashboard charts need in one call
router.get('/analytics', requireRole('admin'), async (_req, res) => {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [users, events, regTotals, byMonth, byCategory, topEvents, pending] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Event.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    // Attendance only means something for events that have already happened.
    Registration.aggregate([
      { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'e' } },
      { $unwind: '$e' },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          finished: { $sum: { $cond: [{ $lt: ['$e.endsAt', now] }, 1, 0] } },
          attended: { $sum: { $cond: [{ $ne: ['$attendedAt', null] }, 1, 0] } },
        },
      },
    ]),
    Registration.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          registrations: { $sum: 1 },
          attended: { $sum: { $cond: [{ $ne: ['$attendedAt', null] }, 1, 0] } },
        },
      },
    ]),
    Event.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', events: { $sum: 1 }, registrations: { $sum: '$registrationsCount' } } },
      { $sort: { registrations: -1 } },
    ]),
    Event.find({ status: 'approved' })
      .sort({ registrationsCount: -1 })
      .limit(5)
      .populate('club', 'name')
      .select('title registrationsCount attendedCount capacity startsAt club'),
    Event.countDocuments({ status: 'pending' }),
  ]);

  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  const monthMap = new Map(byMonth.map((m) => [m._id, m]));
  const count = (rows, key) => rows.find((r) => r._id === key)?.n ?? 0;
  const totals = regTotals[0] ?? { total: 0, finished: 0, attended: 0 };

  const revenue = await Registration.aggregate([
    { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'e' } },
    { $unwind: '$e' },
    { $group: { _id: null, total: { $sum: '$e.fee' } } },
  ]);

  res.json({
    kpis: {
      students: count(users, 'student'),
      clubs: count(users, 'club'),
      approvedEvents: count(events, 'approved'),
      pendingEvents: pending,
      registrations: totals.total,
      attendanceRate: totals.finished ? Math.round((totals.attended / totals.finished) * 100) : 0,
      revenue: revenue[0]?.total ?? 0,
    },
    registrationsByMonth: months.map((m) => ({
      month: m,
      registrations: monthMap.get(m)?.registrations ?? 0,
      attended: monthMap.get(m)?.attended ?? 0,
    })),
    eventsByCategory: byCategory.map((c) => ({
      category: c._id,
      events: c.events,
      registrations: c.registrations,
    })),
    topEvents: topEvents.map((e) => ({
      id: e._id.toString(),
      title: e.title,
      club: e.club?.name,
      registrations: e.registrationsCount,
      attended: e.attendedCount,
      capacity: e.capacity,
      startsAt: e.startsAt,
    })),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// POST /api/admin/reseed — rebuilds demo data. Called on a schedule with RESEED_SECRET so the
// public demo always has upcoming events. Hidden unless demo mode and the secret are configured.
router.post('/reseed', async (req, res) => {
  if (!env.DEMO_MODE || !env.RESEED_SECRET) throw notFound();
  const supplied = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${env.RESEED_SECRET}`);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw unauthorized();
  const { seed } = require('../seed/seed');
  const summary = await seed({ reset: true });
  res.json({ ok: true, summary });
});

module.exports = router;
