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
  triggerDailySessionRollover,
  getSystemIncidents,
  triggerManualTestAlert,
  getRoutingTemplates,
  updateRoutingTemplate,
  testClassifyMessage,
  testProfanityCheck,
  testImageGeneration,
  simulateOwnerAction,
  getActiveInactivityList,
  resumeOwnerInactivityHandler,
  testNewsSearch,
  testGoogleSearch,
  getNasaApodEndpoint,
  getNasaAsteroidsEndpoint,
  getWeatherEndpoint,
  testLiveSearchEndpoint,
  testSpotifyEndpoint,
  testSecurityScanEndpoint,
  testFinanceEndpoint,
  testRecipeEndpoint,
  testSpeechEndpoint,
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
router.post('/history/daily-rollover', triggerDailySessionRollover);

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

// Automated Error Supervisor & Alert Notification System
router.get('/system/incidents', getSystemIncidents);
router.post('/system/test-alert', triggerManualTestAlert);

// Message Classification & Routing (Routine Templates vs Complex AI)
router.get('/routing/templates', getRoutingTemplates);
router.put('/routing/templates/:id', updateRoutingTemplate);
router.post('/routing/classify', testClassifyMessage);

// Profanity & Abusive Language Protection
router.post('/profanity/test', testProfanityCheck);

// Hugging Face AI Image Generation Sandbox
router.post('/image-gen/test', testImageGeneration);

// Owner Inactivity Timer & Smart Pause System
router.post('/inactivity/simulate-owner-action', simulateOwnerAction);
router.get('/inactivity/active', getActiveInactivityList);
router.post('/inactivity/resume/:contactPhone?', resumeOwnerInactivityHandler);

// Real-Time World News Integration (World News API)
router.post('/news/test', testNewsSearch);

// Google Programmable Search Engine Integration
router.get('/search', testGoogleSearch);
router.post('/search/test', testGoogleSearch);

// NASA Space Exploration & APOD Integration
router.get('/nasa/apod', getNasaApodEndpoint);
router.get('/nasa/asteroids', getNasaAsteroidsEndpoint);

// OpenWeatherMap Real-Time Weather Forecast Integration
router.get('/weather', getWeatherEndpoint);
router.post('/weather/test', getWeatherEndpoint);

// Live AI Web Search (Tavily + Serper)
router.get('/search/live', testLiveSearchEndpoint);
router.post('/search/live', testLiveSearchEndpoint);

// Spotify Music Discovery
router.get('/music/spotify', testSpotifyEndpoint);
router.post('/music/spotify', testSpotifyEndpoint);

// VirusTotal URL Safety Scanner
router.post('/security/scan', testSecurityScanEndpoint);

// Financial Markets, Crypto & Stocks
router.get('/finance/rates', testFinanceEndpoint);
router.post('/finance/rates', testFinanceEndpoint);

// Spoonacular Recipes & Cooking
router.get('/recipes/search', testRecipeEndpoint);
router.post('/recipes/search', testRecipeEndpoint);

// Voice Note Audio Synthesis (Murf AI / ElevenLabs)
router.post('/speech/tts', testSpeechEndpoint);

module.exports = router;
