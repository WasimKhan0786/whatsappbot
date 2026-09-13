const mongoose = require('mongoose');

const routineTemplateSchema = new mongoose.Schema(
  {
    intentKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    patterns: {
      type: [String],
      default: [],
    },
    defaultTemplate: {
      type: String,
      required: true,
    },
    personaOverrides: {
      RESPECTFUL: { type: String, default: '' },
      CASUAL_SLANG: { type: String, default: '' },
      ROMANTIC: { type: String, default: '' },
      EMOTIONAL: { type: String, default: '' },
      PROFESSIONAL: { type: String, default: '' },
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('RoutineTemplate', routineTemplateSchema);
