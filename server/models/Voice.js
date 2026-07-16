const mongoose = require('mongoose');

const voiceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  voiceId: { type: String, required: true, unique: true },
  language: { type: String, default: 'English' },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  previewUrl: { type: String },
  isPremium: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Voice', voiceSchema);