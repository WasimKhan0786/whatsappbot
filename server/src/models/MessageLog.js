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
    enum: [
      'PROCESSED',
      'IGNORED_PHONE_MISMATCH',
      'BOT_DISABLED',
      'ERROR',
      'SIMULATED',
      'AGENT_HANDOFF_TRIGGERED',
      'PAUSED_FOR_AGENT',
      'PROFANITY_BLOCKED',
      'IMAGE_GENERATED',
      'PAUSED_OWNER_ACTIVE',
      'CAP_REACHED',
      'NEWS_FETCHED',
    ],
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
  mediaUrl: {
    type: String,
    default: null,
  },
  routingCategory: {
    type: String,
    enum: ['ROUTINE', 'COMPLEX', 'SCHEDULE', 'GAME', 'HANDOFF', 'SIMULATED', 'PROFANITY', 'IMAGE_GEN', 'OWNER_ACTIVE', 'NEWS', 'UNKNOWN'],
    default: 'COMPLEX',
    index: true,
  },
  routingIntent: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Configure TTL index for auto-deletion of old logs (default: 30 days; set 0 to keep indefinitely)
const logTtlDays = parseInt(process.env.MESSAGE_LOG_TTL_DAYS, 10);
if (logTtlDays === 0) {
  // Retain indefinitely, standard index
  messageLogSchema.index({ createdAt: 1 });
} else {
  const ttlSeconds = (!isNaN(logTtlDays) && logTtlDays > 0 ? logTtlDays : 30) * 24 * 60 * 60;
  messageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlSeconds });
}

module.exports = mongoose.model('MessageLog', messageLogSchema);
