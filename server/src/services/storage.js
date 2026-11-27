const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../config/env');

const LOCAL_DIR = path.resolve(__dirname, '../../uploads/posters');

let cloudinary;
function client() {
  if (!cloudinary) {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({ secure: true }); // reads CLOUDINARY_URL
  }
  return cloudinary;
}

// Returns { url, publicId }. Cloudinary in production; local disk in development/tests.
async function savePoster(file) {
  if (env.cloudinaryEnabled) {
    const result = await new Promise((resolve, reject) => {
      const stream = client().uploader.upload_stream(
        {
          folder: 'eventsphere/posters',
          resource_type: 'image',
          transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        },
        (err, res) => (err ? reject(err) : resolve(res)),
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  const ext = { 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.jpg';
  const name = `${crypto.randomUUID()}${ext}`;
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, name), file.buffer);
  return { url: `/uploads/posters/${name}`, publicId: `local:${name}` };
}

async function deletePoster(publicId) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      await fs.unlink(path.join(LOCAL_DIR, publicId.slice(6)));
    } else if (env.cloudinaryEnabled) {
      await client().uploader.destroy(publicId);
    }
  } catch {
    // a missing old poster should never block an update
  }
}

module.exports = { savePoster, deletePoster, LOCAL_DIR };
