const mongoose = require('mongoose');

const systemIncidentSchema = new mongoose.Schema(
  {
    errorType: {
      type: String,
      required: true,
      default: 'UNKNOWN',
    },
    errorMessage: {
      type: String,
      required: true,
      trim: true,
    },
    errorStack: {
      type: String,
      trim: true,
      default: '',
    },
    restartAttempted: {
      type: Boolean,
      default: false,
    },
    restartStatus: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'COOLDOWN_EXCEEDED', 'NOT_ATTEMPTED', 'SKIPPED'],
      default: 'NOT_ATTEMPTED',
    },
    restartDetails: {
      type: String,
      default: '',
    },
    alertChannels: {
      whatsapp: {
        attempted: { type: Boolean, default: false },
        sent: { type: Boolean, default: false },
        recipient: { type: String, default: '' },
        error: { type: String, default: '' },
      },
      email: {
        attempted: { type: Boolean, default: false },
        sent: { type: Boolean, default: false },
        recipient: { type: String, default: '' },
        error: { type: String, default: '' },
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: { expires: 30 * 24 * 60 * 60 }, // Auto-expires after 30 days to protect MongoDB Atlas storage
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemIncident', systemIncidentSchema);
