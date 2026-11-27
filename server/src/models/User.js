const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['student', 'club', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    googleId: { type: String, index: true, sparse: true },
    avatarUrl: { type: String, default: '' },
    college: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, maxlength: 400, default: '' },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

userSchema.methods.checkPassword = function checkPassword(password) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    avatarUrl: this.avatarUrl,
    college: this.college,
    bio: this.bio,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
