const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');

const router = express.Router();

// GET /api/clubs — public list used by the event filters and landing page
router.get('/', async (_req, res) => {
  const [clubs, counts] = await Promise.all([
    User.find({ role: 'club' }).select('name bio avatarUrl').sort({ name: 1 }).lean(),
    Event.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$club', events: { $sum: 1 } } }]),
  ]);
  const byClub = new Map(counts.map((c) => [c._id.toString(), c.events]));
  res.json({
    items: clubs.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      bio: c.bio,
      avatarUrl: c.avatarUrl,
      events: byClub.get(c._id.toString()) ?? 0,
    })),
  });
});

module.exports = router;
