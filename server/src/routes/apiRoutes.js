const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getLogs,
  clearLogs,
  simulateIncoming,
} = require('../controllers/settingsController');

const {
  getContacts,
  addContact,
  deleteContact,
  analyzeAndSaveChatStyle,
  clearChatStyle,
} = require('../controllers/whitelistController');

const { getGeminiQuota } = require('../controllers/quotaController');

// Gemini Quota and Usage Metrics
router.get('/quota', getGeminiQuota);

// Settings management (bot enable/disable, allowed number, prompt)
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Whitelist Contacts & Relationship Management
router.get('/whitelist', getContacts);
router.post('/whitelist', addContact);
router.delete('/whitelist/:id', deleteContact);
router.post('/whitelist/:id/analyze-chat', analyzeAndSaveChatStyle);
router.delete('/whitelist/:id/chat-style', clearChatStyle);

// Message logs
router.get('/logs', getLogs);
router.delete('/logs', clearLogs);

const {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  checkActiveScheduleEndpoint,
} = require('../controllers/scheduleController');

// Predefined Schedules & Event Auto-Reply Management
router.get('/schedules', getSchedules);
router.post('/schedules', createSchedule);
router.put('/schedules/:id', updateSchedule);
router.delete('/schedules/:id', deleteSchedule);
router.get('/schedules/check', checkActiveScheduleEndpoint);

// Testing & Simulation
router.post('/simulate', simulateIncoming);

module.exports = router;
