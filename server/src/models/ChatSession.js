const mongoose = require('mongoose');

// Schema for individual message turns compatible with Gemini Content API
const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'model'],
      required: true,
    },
    parts: [
      {
        text: {
          type: String,
          required: true,
          default: '',
        },
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  messages: {
    type: [chatMessageSchema],
    default: [],
  },
  isHandedOff: {
    type: Boolean,
    default: false,
    index: true,
  },
  handedOffAt: {
    type: Date,
    default: null,
  },
  handoverReason: {
    type: String,
    enum: ['KEYWORD_AGENT', 'KEYWORD_HUMAN', 'MAX_FAILED_ATTEMPTS', null],
    default: null,
  },
  unresolvedAttempts: {
    type: Number,
    default: 0,
  },
  gameState: {
    active: {
      type: Boolean,
      default: false,
    },
    gameType: {
      type: String,
      default: null,
    },
    score: {
      type: Number,
      default: 0,
    },
    round: {
      type: Number,
      default: 0,
    },
    currentQuestion: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
      default: null,
    },
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL index to automatically purge inactive chat sessions after a configurable duration (default: 7 days)
const sessionTtlDays = parseInt(process.env.CHAT_SESSION_TTL_DAYS, 10);
const sessionTtlSeconds = (!isNaN(sessionTtlDays) && sessionTtlDays > 0 ? sessionTtlDays : 7) * 24 * 60 * 60;

chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: sessionTtlSeconds });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
