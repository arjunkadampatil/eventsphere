const multer = require('multer');
const { badRequest } = require('./errors');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// Posters are held in memory and streamed to Cloudinary (or local disk in development),
// so the API server never depends on its own filesystem surviving a redeploy.
const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(badRequest('Poster must be a JPG, PNG or WebP image.')),
}).single('poster');

module.exports = { posterUpload };
