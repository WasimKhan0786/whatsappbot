const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
    default: 'unknown',
    index: true,
  },
  messageIn: {
    type: String,
    default: '',
  },
  messageOut: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['PROCESSED', 'IGNORED_PHONE_MISMATCH', 'BOT_DISABLED', 'ERROR', 'SIMULATED'],
    default: 'PROCESSED',
    index: true,
  },
  errorMessage: {
    type: String,
    default: null,
  },
  metaMessageId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('MessageLog', messageLogSchema);
