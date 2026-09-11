const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getLogs,
  clearLogs,
  simulateIncoming,
  getHandoffList,
  resumeHandoffSession,
  getSessionHistory,
  clearSessionHistory,
  resetAllMessageCounters,
} = require('../controllers/settingsController');

const {
  getContacts,
  addContact,
  deleteContact,
  analyzeAndSaveChatStyle,
  clearChatStyle,
  updateCrmTag,
  resetMessageCounter,
  setContactMessageLimit,
} = require('../controllers/whitelistController');

const { getGeminiQuota } = require('../controllers/quotaController');
const { getEnvConfig, updateEnvConfig } = require('../controllers/envController');

// Dynamic Environment & API Key Management (Hot-reload without server reboot)
router.get('/env', getEnvConfig);
router.post('/env', updateEnvConfig);

// Gemini Quota and Usage Metrics
router.get('/quota', getGeminiQuota);

// Settings management (bot enable/disable, allowed number, prompt, global reset)
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/settings/reset-all-counters', resetAllMessageCounters);

// Whitelist Contacts & Relationship Management
router.get('/whitelist', getContacts);
router.post('/whitelist', addContact);
router.delete('/whitelist/:id', deleteContact);
router.post('/whitelist/:id/analyze-chat', analyzeAndSaveChatStyle);
router.delete('/whitelist/:id/chat-style', clearChatStyle);
router.put('/whitelist/:id/crm-tag', updateCrmTag);
router.post('/whitelist/:id/reset-counter', resetMessageCounter);
router.put('/whitelist/:id/message-limit', setContactMessageLimit);

// Message logs
router.get('/logs', getLogs);
router.delete('/logs', clearLogs);

// Chat history session management
router.get('/history/:sessionId', getSessionHistory);
router.delete('/history/:sessionId', clearSessionHistory);

// Live Agent Handoff & Paused Sessions Management
router.get('/handoffs', getHandoffList);
router.post('/handoffs/:sessionId/resume', resumeHandoffSession);

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
