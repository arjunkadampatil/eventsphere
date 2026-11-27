const { z } = require('zod');
const { CATEGORIES } = require('./models/Event');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const idParams = z.object({ id: objectId });

const email = z.string().trim().toLowerCase().email('Enter a valid email address.');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72)
  .regex(/[a-zA-Z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

const register = z.object({
  name: z.string().trim().min(2, 'Name is too short.').max(80),
  email,
  password,
  college: z.string().trim().max(120).optional().default(''),
});

const login = z.object({ email, password: z.string().min(1, 'Password is required.') });
const forgotPassword = z.object({ email });
const resetPassword = z.object({ token: z.string().min(20), password });

const profile = z
  .object({
    name: z.string().trim().min(2).max(80),
    college: z.string().trim().max(120),
    bio: z.string().trim().max(400),
  })
  .partial();

// Multipart forms send everything as strings, so numbers/dates/tags are coerced.
const tags = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')))
  .transform((v) => [...new Set(v.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8));

const eventFields = z.object({
  title: z.string().trim().min(4, 'Title is too short.').max(120),
  description: z.string().trim().min(20, 'Description should be at least 20 characters.').max(5000),
  category: z.enum(CATEGORIES),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  mode: z.enum(['offline', 'online']).default('offline'),
  venue: z.string().trim().max(160).optional().default(''),
  meetingLink: z.union([z.string().trim().url('Meeting link must be a URL.'), z.literal('')]).optional().default(''),
  capacity: z.coerce.number().int().min(0).max(100000).default(0),
  fee: z.coerce.number().min(0).max(100000).default(0),
  tags: tags.optional().default([]),
});

const checkEventRules = (data, ctx) => {
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End time must be after the start time.' });
  }
  if (data.mode === 'offline' && data.venue === '') {
    ctx.addIssue({ code: 'custom', path: ['venue'], message: 'Venue is required for offline events.' });
  }
  if (data.mode === 'online' && data.meetingLink === '') {
    ctx.addIssue({ code: 'custom', path: ['meetingLink'], message: 'Meeting link is required for online events.' });
  }
};

const createEvent = eventFields.superRefine((data, ctx) => {
  checkEventRules(data, ctx);
  if (data.startsAt < new Date()) {
    ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'Start time must be in the future.' });
  }
});

const updateEvent = eventFields
  .partial()
  .extend({
    venue: z.string().trim().max(160).optional(),
    meetingLink: z.union([z.string().trim().url(), z.literal('')]).optional(),
    tags: tags.optional(),
  })
  .superRefine(checkEventRules);

const eventStatus = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(300).optional().default(''),
  })
  .refine((d) => d.status === 'approved' || d.reason.length > 0, {
    path: ['reason'],
    message: 'Give the club a reason when rejecting an event.',
  });

const listEvents = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  club: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  when: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  sort: z.enum(['date', 'popular', 'newest']).default('date'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const manageEvents = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const registerForEvent = z.object({ college: z.string().trim().max(120).optional().default('') });
const checkIn = z.object({ ticketCode: z.string().trim().min(6).max(64) });
const announcement = z.object({ message: z.string().trim().min(3, 'Message is too short.').max(1000) });

module.exports = {
  objectId,
  idParams,
  register,
  login,
  forgotPassword,
  resetPassword,
  profile,
  createEvent,
  updateEvent,
  eventStatus,
  listEvents,
  manageEvents,
  registerForEvent,
  checkIn,
  announcement,
};
