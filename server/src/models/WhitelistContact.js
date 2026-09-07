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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('WhitelistContact', whitelistContactSchema);
