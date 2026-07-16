const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  voice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voice'
  },
  voiceName: {
    type: String
  },
  audioUrl: {
    type: String,
    required: true
  },
  duration: {
    type: Number
  },
  // ===== Optional link to a "My Projects" folder =====
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('History', historySchema);