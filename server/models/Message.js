const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  topic: { type: String, enum: ['general', 'billing', 'technical', 'feature'], default: 'general' },
  message: { type: String, required: true },
  status: { type: String, enum: ['new', 'read'], default: 'new' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);