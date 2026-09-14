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
  currentSessionDate: {
    type: String,
    index: true,
    default: () => new Date().toISOString().slice(0, 10),
  },
  archivedDailyContexts: [
    {
      date: { type: String, required: true },
      messageCount: { type: Number, default: 0 },
      messages: { type: [chatMessageSchema], default: [] },
      archivedAt: { type: Date, default: Date.now },
    },
  ],
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
  messagesSentCount: {
    type: Number,
    default: 0,
  },
  isCapReached: {
    type: Boolean,
    default: false,
  },
  isFarewellSent: {
    type: Boolean,
    default: false,
  },
  capReachedAt: {
    type: Date,
    default: null,
  },
  ownerLastActivityAt: {
    type: Date,
    default: null,
  },
  isOwnerActivePaused: {
    type: Boolean,
    default: false,
    index: true,
  },
  ownerPausedUntil: {
    type: Date,
    default: null,
    index: true,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL (Time-To-Live) index on MongoDB Atlas:
// Automatically purges inactive chat session documents after a configurable duration (default: 7 days)
// to strictly guarantee database storage stays within MongoDB Atlas free-tier (M0 512MB) limits.
const sessionTtlDays = parseInt(process.env.CHAT_SESSION_TTL_DAYS, 10);
const sessionTtlSeconds = (!isNaN(sessionTtlDays) && sessionTtlDays > 0 ? sessionTtlDays : 7) * 24 * 60 * 60;

chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: sessionTtlSeconds, background: true });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
