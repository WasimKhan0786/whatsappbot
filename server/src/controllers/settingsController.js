const BotSettings = require('../models/BotSettings');
const MessageLog = require('../models/MessageLog');
const WhitelistContact = require('../models/WhitelistContact');
const ChatSession = require('../models/ChatSession');
const { generateGeminiReply } = require('../services/geminiService');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { buildDynamicPersonaPrompt } = require('../services/personaService');
const {
  getGeminiChatHistory,
  recordMessageExchange,
  clearChatHistory,
  getChatSessionStats,
  isSessionHandedOff,
  detectAgentKeyword,
  activateHandover,
  recordFailedAttempt,
  resetFailedAttempts,
  getActiveHandoffs,
  resumeSession,
} = require('../services/chatHistoryService');
const { normalizePhoneNumber } = require('./webhookController');

/**
 * GET /api/settings
 * Fetch bot configuration and summary statistics
 */
const getSettings = async (req, res) => {
  try {
    const settings = await BotSettings.getSettings();

    // Aggregate quick stats
    const totalCount = await MessageLog.countDocuments();
    const processedCount = await MessageLog.countDocuments({ status: 'PROCESSED' });
    const ignoredCount = await MessageLog.countDocuments({ status: 'IGNORED_PHONE_MISMATCH' });
    const disabledCount = await MessageLog.countDocuments({ status: 'BOT_DISABLED' });
    const errorCount = await MessageLog.countDocuments({ status: 'ERROR' });
    const handedOffCount = await ChatSession.countDocuments({ isHandedOff: true });

    res.json({
      settings: {
        isEnabled: settings.isEnabled,
        allowedPhoneNumber: settings.allowedPhoneNumber,
        systemPrompt: settings.systemPrompt,
        updatedAt: settings.updatedAt,
      },
      stats: {
        total: totalCount,
        processed: processedCount,
        ignored: ignoredCount,
        disabled: disabledCount,
        errors: errorCount,
        handedOff: handedOffCount,
      },
      envStatus: {
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY'),
        hasWhatsAppToken: Boolean(process.env.WHATSAPP_TOKEN && !process.env.WHATSAPP_TOKEN.includes('your_meta') && !process.env.WHATSAPP_TOKEN.startsWith('mock_')),
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'whatsapp_bot_verify_token_secret_123',
      },
    });
  } catch (error) {
    console.error('Error in getSettings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

/**
 * PUT /api/settings
 * Update bot active status (toggle button), allowed phone number, and system prompt
 */
const updateSettings = async (req, res) => {
  try {
    const { isEnabled, allowedPhoneNumber, systemPrompt } = req.body;

    const settings = await BotSettings.getSettings();

    if (typeof isEnabled === 'boolean') {
      settings.isEnabled = isEnabled;
    }

    if (typeof allowedPhoneNumber === 'string') {
      settings.allowedPhoneNumber = allowedPhoneNumber.trim();
    }

    if (typeof systemPrompt === 'string') {
      settings.systemPrompt = systemPrompt.trim();
    }

    settings.updatedAt = new Date();
    await settings.save();

    res.json({
      message: 'Bot settings updated successfully',
      settings: {
        isEnabled: settings.isEnabled,
        allowedPhoneNumber: settings.allowedPhoneNumber,
        systemPrompt: settings.systemPrompt,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

/**
 * GET /api/logs
 * Retrieve recent message logs
 */
const getLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = {};

    if (req.query.status && req.query.status !== 'ALL') {
      filter.status = req.query.status;
    }

    const logs = await MessageLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

/**
 * DELETE /api/logs
 * Clear all logs
 */
const clearLogs = async (req, res) => {
  try {
    await MessageLog.deleteMany({});
    res.json({ message: 'All logs cleared' });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
};

/**
 * POST /api/simulate
 * Simulates receiving a WhatsApp message, running through the same validation & Gemini pipeline
 */
const simulateIncoming = async (req, res) => {
  try {
    const { sender, messageText } = req.body;

    if (!sender || !messageText) {
      return res.status(400).json({ error: 'Both sender phone number and messageText are required.' });
    }

    const settings = await BotSettings.getSettings();

    // 1. Check Bot enabled
    if (!settings.isEnabled) {
      const log = await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: '',
        status: 'BOT_DISABLED',
      });
      return res.json({
        success: false,
        status: 'BOT_DISABLED',
        message: 'The bot is currently disabled via dashboard switch.',
        log,
      });
    }

    // 2. Check Allowed Phone Number & WhitelistContact Filter
    const cleanSender = (sender || '').replace(/\D/g, '');
    let matchedContact = null;
    try {
      const allContacts = await WhitelistContact.find();
      matchedContact = allContacts.find((c) => {
        const cClean = c.phoneNumber.replace(/\D/g, '');
        return cleanSender === cClean || cleanSender.endsWith(cClean) || cClean.endsWith(cleanSender);
      });
    } catch (cErr) {
      console.warn('Simulation contact lookup warning:', cErr.message);
    }

    const rawAllowed = settings.allowedPhoneNumber || '';
    const allowedList = rawAllowed
      .split(/[,;\n\s]+/)
      .map((num) => num.replace(/\D/g, ''))
      .filter((num) => num.length >= 7 && num !== '1234567890');

    const isAllowed = matchedContact || allowedList.some((a) => cleanSender === a || cleanSender.endsWith(a) || a.endsWith(cleanSender));

    if (!isAllowed && (allowedList.length > 0 || rawAllowed.trim() !== '')) {
      const log = await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: '',
        status: 'IGNORED_PHONE_MISMATCH',
      });
      return res.json({
        success: false,
        status: 'IGNORED_PHONE_MISMATCH',
        message: `Phone number ${sender} is not authorized in whitelist.`,
        log,
      });
    }

    // 2.5 Check if session is paused for Live Agent
    const isPausedForAgent = await isSessionHandedOff(sender);
    if (isPausedForAgent) {
      const log = await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: '[Automated responses paused - Live agent active]',
        status: 'PAUSED_FOR_AGENT',
      });
      return res.json({
        success: false,
        status: 'PAUSED_FOR_AGENT',
        message: `Automated replies are PAUSED for ${sender} because Live Agent mode is active.`,
        log,
      });
    }

    // 2.6 Check if user explicitly typed 'agent' or 'human' keyword
    const requestedAgent = detectAgentKeyword(messageText);
    if (requestedAgent) {
      await activateHandover(sender, 'KEYWORD_AGENT');

      const isEnglishQuery = /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(messageText) && !/\b(kya|bhai|bolo|karo|nahi)\b/i.test(messageText);
      const handoverReply = isEnglishQuery
        ? "I am connecting you with our live agent team immediately. Automated responses have been paused. A team member will assist you shortly."
        : "Main aapko hamari live team se connect kar raha hoon. AI replies pause kar diye gaye hain, hamari team aapse jald hi rabta karegi.";

      const whatsappResult = await sendWhatsAppMessage(sender, handoverReply);
      const log = await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: handoverReply,
        status: 'AGENT_HANDOFF_TRIGGERED',
      });
      await recordMessageExchange(sender, messageText, handoverReply);

      return res.json({
        success: true,
        status: 'AGENT_HANDOFF_TRIGGERED',
        replyText: handoverReply,
        whatsappResult,
        log,
      });
    }

    // 3. Dynamic Persona & Isolated Style Prompt Generation with real-time mirroring
    let failResult = null;
    let replyText = "";
    try {
      const dynamicPrompt = buildDynamicPersonaPrompt(settings.systemPrompt, matchedContact, sender, messageText);
      const chatHistory = await getGeminiChatHistory(sender);
      replyText = await generateGeminiReply(messageText, dynamicPrompt, chatHistory);
      await resetFailedAttempts(sender);
    } catch (aiErr) {
      console.warn('Simulation AI generation error:', aiErr.message);
      failResult = await recordFailedAttempt(sender);
      if (failResult.triggeredHandover) {
        replyText = "I apologize, but I am unable to properly resolve your query. I have notified our live agent team immediately and paused automated replies so a human can step in to assist you.";
      } else {
        const log = await MessageLog.create({
          sender,
          messageIn: messageText,
          status: 'ERROR',
          errorMessage: `Gemini failure (attempt ${failResult.unresolvedAttempts}/3): ${aiErr.message}`,
        });
        return res.status(500).json({
          success: false,
          status: 'ERROR',
          error: aiErr.message,
          unresolvedAttempts: failResult.unresolvedAttempts,
          log,
        });
      }
    }

    // 4. WhatsApp Send (or simulation)
    const whatsappResult = await sendWhatsAppMessage(sender, replyText);

    // 5. DB Logging
    const log = await MessageLog.create({
      sender,
      messageIn: messageText,
      messageOut: replyText,
      status: failResult?.triggeredHandover ? 'AGENT_HANDOFF_TRIGGERED' : 'PROCESSED',
    });

    // 6. Record to capped ChatSession history
    try {
      await recordMessageExchange(sender, messageText, replyText);
    } catch (histErr) {
      console.warn('Simulation history recording note:', histErr.message);
    }

    return res.json({
      success: true,
      status: failResult?.triggeredHandover ? 'AGENT_HANDOFF_TRIGGERED' : 'PROCESSED',
      replyText,
      whatsappResult,
      log,
    });
  } catch (error) {
    console.error('Simulation error:', error);
    const log = await MessageLog.create({
      sender: req.body?.sender || 'unknown',
      messageIn: req.body?.messageText || '',
      status: 'ERROR',
      errorMessage: error.message,
    });
    return res.status(500).json({
      success: false,
      status: 'ERROR',
      error: error.message,
      log,
    });
  }
};

/**
 * GET /api/handoffs
 * List all active live agent handoffs (sessions where automated replies are paused)
 */
const getHandoffList = async (req, res) => {
  try {
    const handoffs = await getActiveHandoffs();
    return res.json({ success: true, handoffs });
  } catch (error) {
    console.error('Error fetching handoff list:', error);
    return res.status(500).json({ error: 'Failed to fetch handoff list' });
  }
};

/**
 * POST /api/handoffs/:sessionId/resume
 * Resume automated AI bot responses for a paused chat session
 */
const resumeHandoffSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await resumeSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or not currently handed off' });
    }
    return res.json({
      success: true,
      message: `Automated AI responses resumed for ${sessionId}`,
      session,
    });
  } catch (error) {
    console.error('Error resuming session:', error);
    return res.status(500).json({ error: 'Failed to resume session' });
  }
};

/**
 * GET /api/history/:sessionId
 * Fetch recent chat history and stats for a given contact / session
 */
const getSessionHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await getChatSessionStats(sessionId);
    if (!stats) {
      return res.json({
        sessionId,
        messageCount: 0,
        messages: [],
      });
    }
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching session history:', error);
    return res.status(500).json({ error: 'Failed to fetch session history' });
  }
};

/**
 * DELETE /api/history/:sessionId
 * Clear chat history context for a given contact / session
 */
const clearSessionHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await clearChatHistory(sessionId);
    return res.json({ success: true, message: `Chat history cleared for ${sessionId}` });
  } catch (error) {
    console.error('Error clearing session history:', error);
    return res.status(500).json({ error: 'Failed to clear session history' });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getLogs,
  clearLogs,
  simulateIncoming,
  getHandoffList,
  resumeHandoffSession,
  getSessionHistory,
  clearSessionHistory,
};
