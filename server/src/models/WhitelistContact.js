const mongoose = require('mongoose');

const whitelistContactSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  relationship: {
    type: String,
    required: true,
    trim: true,
    default: 'Friend',
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  persona: {
    type: String,
    enum: ['AUTO', 'CASUAL_SLANG', 'ROMANTIC', 'RESPECTFUL', 'FRIENDLY', 'EMOTIONAL', 'PROFESSIONAL', 'CUSTOM'],
    default: 'AUTO',
    index: true,
  },
  customToneInstructions: {
    type: String,
    trim: true,
    default: '',
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  // Uploaded/pasted chat sample log
  rawChatSample: {
    type: String,
    default: '',
  },
  // Stylistic traits extracted via AI analysis of the chat samples
  styleProfile: {
    hasCustomStyle: {
      type: Boolean,
      default: false,
    },
    analyzedAt: {
      type: Date,
      default: null,
    },
    tone: {
      type: String,
      default: '',
    },
    vocabulary: {
      type: [String],
      default: [],
    },
    typingHabits: {
      type: String,
      default: '',
    },
    typicalPhrases: {
      type: [String],
      default: [],
    },
    sampleSnippets: {
      type: [String],
      default: [],
    },
    stylePromptDirective: {
      type: String,
      default: '',
    },
  },
  // CRM Lead Tagging & Sentiment Analysis fields
  crmTag: {
    type: String,
    enum: ['HOT_LEAD', 'HIGH_PRIORITY', 'SUPPORT_COMPLAINT', 'COLD_LEAD', 'NEUTRAL'],
    default: 'NEUTRAL',
    index: true,
  },
  sentimentScore: {
    type: String,
    enum: ['HAPPY', 'INTERESTED', 'NEUTRAL', 'FRUSTRATED'],
    default: 'NEUTRAL',
  },
  intentSummary: {
    type: String,
    default: '',
    trim: true,
  },
  crmUpdatedAt: {
    type: Date,
    default: null,
  },
  // Max Message Limit & Auto-Cap Controller
  maxMessageLimit: {
    type: Number,
    default: 0, // 0 = Inherit global setting or unlimited
  },
  messagesSentCount: {
    type: Number,
    default: 0,
  },
  isCapReached: {
    type: Boolean,
    default: false,
    index: true,
  },
  capReachedAt: {
    type: Date,
    default: null,
  },
  customClosingMessage: {
    type: String,
    default: '',
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('WhitelistContact', whitelistContactSchema);
