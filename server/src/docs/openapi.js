const { CATEGORIES } = require('../models/Event');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const ok = (description, schema) => ({ description, ...(schema ? json(schema) : {}) });
const err = (description) => ({ description, ...json(ref('Error')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'MongoDB ObjectId' };
const bearer = [{ bearerAuth: [] }];

const eventInput = {
  type: 'object',
  required: ['title', 'description', 'category', 'startsAt', 'endsAt'],
  properties: {
    title: { type: 'string', minLength: 4, maxLength: 120 },
    description: { type: 'string', minLength: 20 },
    category: { type: 'string', enum: CATEGORIES },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
    mode: { type: 'string', enum: ['offline', 'online'] },
    venue: { type: 'string', description: 'Required when mode is offline' },
    meetingLink: { type: 'string', format: 'uri', description: 'Required when mode is online' },
    capacity: { type: 'integer', minimum: 0, description: '0 means unlimited' },
    fee: { type: 'number', minimum: 0 },
    tags: { type: 'string', description: 'Comma-separated' },
    poster: { type: 'string', format: 'binary', description: 'JPG, PNG or WebP, up to 5 MB' },
  },
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'EventSphere API',
    version: '2.0.0',
    description:
      'University event platform API. Sign in with `POST /api/auth/login` and click **Authorize** with the ' +
      '`accessToken` (expires in 15 minutes; `POST /api/auth/refresh` rotates the httpOnly refresh cookie).\n\n' +
      'Demo accounts (password `Demo@1234`): `admin@eventsphere.dev`, `club@eventsphere.dev`, `student@eventsphere.dev`.\n\n' +
      'Real-time: connect with Socket.IO (optionally `auth: { token }`) and listen for `announcement`; emit ' +
      '`event:follow` with an event id to follow a public event page.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth' },
    { name: 'Events' },
    { name: 'Registrations' },
    { name: 'Attendance' },
    { name: 'Announcements' },
    { name: 'Me' },
    { name: 'Admin' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['student', 'club', 'admin'] },
          college: { type: 'string' },
        },
      },
      Session: {
        type: 'object',
        properties: { accessToken: { type: 'string' }, user: ref('User') },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          club: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' } } },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          mode: { type: 'string' },
          venue: { type: 'string' },
          capacity: { type: 'integer' },
          fee: { type: 'number' },
          tags: { type: 'array', items: { type: 'string' } },
          posterUrl: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          registrationsCount: { type: 'integer' },
          isFull: { type: 'boolean' },
          isPast: { type: 'boolean' },
        },
      },
      EventPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: ref('Event') },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          pages: { type: 'integer' },
        },
      },
      EventInput: eventInput,
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create a student account',
        requestBody: json({
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            password: { type: 'string', description: '8+ chars with a letter and a number' },
            college: { type: 'string' },
          },
        }),
        responses: { 201: ok('Signed in', ref('Session')), 400: err('Validation failed'), 409: err('Email taken') },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in',
        requestBody: json({
          type: 'object',
          required: ['email', 'password'],
          properties: { email: { type: 'string', example: 'student@eventsphere.dev' }, password: { type: 'string', example: 'Demo@1234' } },
        }),
        responses: { 200: ok('Signed in; sets refresh cookie', ref('Session')), 401: err('Wrong credentials'), 429: err('Rate limited') },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh cookie and get a new access token',
        responses: { 200: ok('New session', ref('Session')), 401: err('Expired, revoked or reused token') },
      },
    },
    '/api/auth/logout': {
      post: { tags: ['Auth'], summary: 'Revoke the refresh token family', responses: { 204: ok('Signed out') } },
    },
    '/api/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user', security: bearer, responses: { 200: ok('User'), 401: err('Not signed in') } },
    },
    '/api/auth/providers': {
      get: { tags: ['Auth'], summary: 'Which social logins are configured', responses: { 200: ok('{ google: boolean }') } },
    },
    '/api/auth/google': {
      get: { tags: ['Auth'], summary: 'Start Google OAuth (only when configured)', responses: { 302: ok('Redirect to Google') } },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Email a password reset link',
        requestBody: json({ type: 'object', properties: { email: { type: 'string' } } }),
        responses: { 200: ok('Always succeeds (no account enumeration)') },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Set a new password with a reset token',
        requestBody: json({ type: 'object', properties: { token: { type: 'string' }, password: { type: 'string' } } }),
        responses: { 200: ok('Password updated'), 400: err('Invalid or expired token') },
      },
    },
    '/api/events': {
      get: {
        tags: ['Events'],
        summary: 'Browse approved events',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search title, description, tags, venue' },
          { name: 'category', in: 'query', schema: { type: 'string', enum: CATEGORIES } },
          { name: 'club', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'when', in: 'query', schema: { type: 'string', enum: ['upcoming', 'past', 'all'], default: 'upcoming' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['date', 'popular', 'newest'], default: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 12, maximum: 50 } },
        ],
        responses: { 200: ok('Page of events', ref('EventPage')), 400: err('Invalid filters') },
      },
      post: {
        tags: ['Events'],
        summary: 'Submit an event for approval (club)',
        security: bearer,
        requestBody: { content: { 'multipart/form-data': { schema: ref('EventInput') } } },
        responses: { 201: ok('Created as pending'), 400: err('Validation failed'), 403: err('Not a club') },
      },
    },
    '/api/events/manage': {
      get: {
        tags: ['Events'],
        summary: "A club's own events (any status), or all events for admins",
        security: bearer,
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } }],
        responses: { 200: ok('Page of events', ref('EventPage')) },
      },
    },
    '/api/events/{id}': {
      parameters: [idParam],
      get: {
        tags: ['Events'],
        summary: 'Event details (plus your registration, if any)',
        responses: { 200: ok('Event'), 404: err('Not found or not visible') },
      },
      patch: {
        tags: ['Events'],
        summary: 'Edit an event (owner club or admin)',
        security: bearer,
        requestBody: { content: { 'multipart/form-data': { schema: { ...eventInput, required: [] } } } },
        responses: { 200: ok('Updated'), 403: err('Not your event') },
      },
      delete: { tags: ['Events'], summary: 'Delete an event', security: bearer, responses: { 204: ok('Deleted'), 409: err('Has registrations') } },
    },
    '/api/events/{id}/status': {
      parameters: [idParam],
      patch: {
        tags: ['Admin'],
        summary: 'Approve or reject an event',
        security: bearer,
        requestBody: json({
          type: 'object',
          properties: { status: { type: 'string', enum: ['approved', 'rejected'] }, reason: { type: 'string' } },
        }),
        responses: { 200: ok('Updated'), 400: err('Reason required when rejecting'), 403: err('Admins only') },
      },
    },
    '/api/events/{id}/register': {
      parameters: [idParam],
      post: {
        tags: ['Registrations'],
        summary: 'Register for an event (student)',
        security: bearer,
        requestBody: json({ type: 'object', properties: { college: { type: 'string' } } }),
        responses: { 201: ok('Registered; returns ticket code'), 409: err('Full or already registered') },
      },
      delete: {
        tags: ['Registrations'],
        summary: 'Cancel a registration before the event starts',
        security: bearer,
        responses: { 204: ok('Cancelled') },
      },
    },
    '/api/events/{id}/attendees': {
      parameters: [idParam],
      get: { tags: ['Attendance'], summary: 'Attendee list (owner club or admin)', security: bearer, responses: { 200: ok('Attendees') } },
    },
    '/api/events/{id}/attendees.csv': {
      parameters: [idParam],
      get: {
        tags: ['Attendance'],
        summary: 'Attendee list as CSV',
        security: bearer,
        responses: { 200: { description: 'CSV file', content: { 'text/csv': {} } } },
      },
    },
    '/api/events/{id}/check-in': {
      parameters: [idParam],
      post: {
        tags: ['Attendance'],
        summary: 'Check in a ticket (QR scan or typed code)',
        security: bearer,
        requestBody: json({ type: 'object', required: ['ticketCode'], properties: { ticketCode: { type: 'string' } } }),
        responses: { 200: ok('Checked in'), 404: err('Invalid ticket'), 409: err('Already checked in') },
      },
    },
    '/api/events/{id}/announcements': {
      parameters: [idParam],
      get: { tags: ['Announcements'], summary: 'Announcements for an event', responses: { 200: ok('Announcements') } },
      post: {
        tags: ['Announcements'],
        summary: 'Post an announcement (pushed live via Socket.IO)',
        security: bearer,
        requestBody: json({ type: 'object', required: ['message'], properties: { message: { type: 'string' } } }),
        responses: { 201: ok('Posted') },
      },
    },
    '/api/me': {
      patch: {
        tags: ['Me'],
        summary: 'Update your profile',
        security: bearer,
        requestBody: json({
          type: 'object',
          properties: { name: { type: 'string' }, college: { type: 'string' }, bio: { type: 'string' } },
        }),
        responses: { 200: ok('Updated') },
      },
    },
    '/api/me/registrations': {
      get: { tags: ['Me'], summary: 'Your tickets', security: bearer, responses: { 200: ok('Registrations') } },
    },
    '/api/me/announcements': {
      get: { tags: ['Me'], summary: 'Announcements from your events', security: bearer, responses: { 200: ok('Announcements') } },
    },
    '/api/me/registrations/{id}/certificate': {
      parameters: [idParam],
      get: {
        tags: ['Me'],
        summary: 'Download your participation certificate (PDF)',
        security: bearer,
        responses: { 200: { description: 'PDF', content: { 'application/pdf': {} } }, 400: err('Not attended or not finished') },
      },
    },
    '/api/clubs': {
      get: { tags: ['Events'], summary: 'All clubs with their approved event counts', responses: { 200: ok('Clubs') } },
    },
    '/api/admin/analytics': {
      get: { tags: ['Admin'], summary: 'Dashboard KPIs and chart data', security: bearer, responses: { 200: ok('Analytics') } },
    },
    '/api/health': {
      get: { tags: ['Admin'], summary: 'Liveness and database status', responses: { 200: ok('OK') } },
    },
  },
};
