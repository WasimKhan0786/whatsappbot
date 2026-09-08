const mongoose = require('mongoose');

const scheduleEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Untitled Schedule',
  },
  type: {
    type: String,
    enum: ['RECURRING_DAILY', 'RECURRING_WEEKLY', 'SPECIFIC_DATE'],
    default: 'RECURRING_DAILY',
    index: true,
  },
  // 24-hour format: "HH:mm" (e.g., "18:00" for 6:00 PM)
  startTime: {
    type: String,
    trim: true,
    default: '18:00',
  },
  // 24-hour format: "HH:mm" (e.g., "20:00" for 8:00 PM)
  endTime: {
    type: String,
    trim: true,
    default: '20:00',
  },
  // Days of week: 0 = Sun, 1 = Mon, ..., 6 = Sat. Empty array means all 7 days.
  daysOfWeek: {
    type: [Number],
    default: [0, 1, 2, 3, 4, 5, 6],
  },
  // Format: "YYYY-MM-DD" for exact one-time dates, or "MM-DD" for yearly recurring events (e.g. "09-07" for Birthday)
  specificDate: {
    type: String,
    trim: true,
    default: null,
  },
  autoReplyText: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  targetRelationship: {
    type: String,
    default: 'ALL', // 'ALL', or specific relationship like 'Brother', 'Friend', 'Bhabhi', 'Wife'
  },
  targetPhoneNumbers: {
    type: [String],
    default: [], // If empty, applies to all whitelisted numbers. If specified, applies only to these numbers.
  },
  priority: {
    type: Number,
    default: 1, // Higher priority schedule wins if multiple overlap
  },
  // Schedule Execution Mode:
  // - AUTO_REPLY_ON_INCOMING: Triggered when a contact messages during active hours (Gym, Sleep)
  // - PROACTIVE_OUTBOUND_BROADCAST: Bot autonomously sends direct message at set Date & Time (Birthday, Office Task)
  executionMode: {
    type: String,
    enum: ['AUTO_REPLY_ON_INCOMING', 'PROACTIVE_OUTBOUND_BROADCAST'],
    default: 'AUTO_REPLY_ON_INCOMING',
    index: true,
  },
  // Exact Date-Time for one-off or scheduled outbound broadcast (ISO string or datetime)
  scheduledDateTime: {
    type: String, // "YYYY-MM-DDTHH:mm" format (e.g. "2026-09-09T10:00")
    default: null,
  },
  repeatInterval: {
    type: String,
    enum: ['ONCE', 'DAILY', 'WEEKLY', 'YEARLY'],
    default: 'ONCE',
  },
  isExecuted: {
    type: Boolean,
    default: false,
    index: true,
  },
  lastExecutedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ScheduleEvent', scheduleEventSchema);
