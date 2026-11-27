const mongoose = require('mongoose');

const CATEGORIES = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Hackathon', 'Social', 'Other'];
const STATUSES = ['pending', 'approved', 'rejected'];

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, enum: CATEGORIES, default: 'Other', index: true },
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    venue: { type: String, trim: true, default: '' },
    mode: { type: String, enum: ['offline', 'online'], default: 'offline' },
    meetingLink: { type: String, default: '' },
    capacity: { type: Number, min: 0, default: 0 }, // 0 = unlimited
    fee: { type: Number, min: 0, default: 0 },
    tags: [{ type: String, trim: true, lowercase: true }],
    posterUrl: { type: String, default: '' },
    posterPublicId: { type: String, default: '' },
    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    rejectionReason: { type: String, default: '' },
    registrationsCount: { type: Number, default: 0 },
    attendedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

eventSchema.index({ title: 'text', description: 'text', tags: 'text' });
eventSchema.index({ status: 1, startsAt: 1 });

eventSchema.virtual('isPast').get(function isPast() {
  return this.endsAt < new Date();
});

eventSchema.virtual('isFull').get(function isFull() {
  return this.capacity > 0 && this.registrationsCount >= this.capacity;
});

eventSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.posterPublicId;
    return ret;
  },
});

module.exports = mongoose.model('Event', eventSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
