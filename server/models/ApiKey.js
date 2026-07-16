const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  lastUsed: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

apiKeySchema.statics.generateKey = function () {
  return 'vf_' + crypto.randomBytes(24).toString('hex');
};

module.exports = mongoose.model('ApiKey', apiKeySchema);