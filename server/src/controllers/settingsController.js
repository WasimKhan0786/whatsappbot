const BotSettings = require('../models/BotSettings');
const MessageLog = require('../models/MessageLog');
const WhitelistContact = require('../models/WhitelistContact');
const ChatSession = require('../models/ChatSession');
const RoutineTemplate = require('../models/RoutineTemplate');
const { generateGeminiReply } = require('../services/geminiService');
const { routeAndGenerateAiReply } = require('../services/aiRouterService');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { classifyMessage } = require('../services/messageRoutingService');
const { detectProfanity, handleProfanityStrike } = require('../services/profanityService');
const { extractImagePrompt, generateHuggingFaceImage } = require('../services/huggingFaceService');
const { buildDynamicPersonaPrompt, stripKinshipTerms } = require('../services/personaService');
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
  getTodayDateString,
  runDailySessionArchiver,
  getContactMessageCountInfo,
  incrementContactMessageCount,
  markContactFarewellSent,
  resolveFarewellClosingMessage,
} = require('../services/chatHistoryService');
const {
  storeConversationVector,
  queryRelevantHistory,
  formatSemanticContextForPrompt,
} = require('../services/pineconeService');
const { processGameTurn } = require('../services/gameService');
const { analyzeAndTagContact } = require('../services/crmService');
const { getSupervisorStatus, triggerTestAlert } = require('../services/errorRecoveryService');
const { normalizePhoneNumber } = require('./webhookController');
const {
  recordOwnerActivity,
  checkOwnerInactivityStatus,
  resumeOwnerInactivity,
  getActiveInactivitySessions,
} = require('../services/inactivityTimerService');
const {
  extractNewsQuery,
  fetchRealTimeNews,
  formatNewsForWhatsApp,
} = require('../services/worldNewsService');
const {
  searchGoogle,
  extractSearchQuery,
  formatSearchResultsForWhatsApp,
} = require('../services/googleSearchService');
const {
  fetchNasaApod,
  fetchNearEarthObjects,
  formatNasaApodForWhatsApp,
  formatNasaNeoForWhatsApp,
} = require('../services/nasaService');

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
        autoReplyAll: settings.autoReplyAll ?? false,
        allowedPhoneNumber: settings.allowedPhoneNumber,
        systemPrompt: settings.systemPrompt,
        humanSimulationEnabled: settings.humanSimulationEnabled ?? true,
        minReadingDelayMs: settings.minReadingDelayMs ?? 2000,
        maxReadingDelayMs: settings.maxReadingDelayMs ?? 6000,
        typingSpeedCPM: settings.typingSpeedCPM ?? 250,
        defaultMaxMessagesPerContact: settings.defaultMaxMessagesPerContact ?? 0,
        limitReachedClosingMessage: settings.limitReachedClosingMessage || '',
        dailySessionStrategy: settings.dailySessionStrategy || 'RESET',
        dailyArchiveRetentionDays: settings.dailyArchiveRetentionDays || 3,
        profanityFilterEnabled: settings.profanityFilterEnabled ?? true,
        profanityReplyMessage: settings.profanityReplyMessage || 'Kripya sabhya bhasha ka prayog karein. Hum yahan aadar aur maryada ke saath baat karne ke liye upasthit hain. Please maintain respectful communication.',
        customProfanityKeywords: settings.customProfanityKeywords || [],
        imageGenerationEnabled: settings.imageGenerationEnabled ?? true,
        imageGenerationModel: settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell',
        imageGenerationNotice: settings.imageGenerationNotice || '🎨 Creating your image with AI, please wait a moment...',
        ownerInactivityTimerEnabled: settings.ownerInactivityTimerEnabled ?? true,
        ownerInactivityDurationMinutes: settings.ownerInactivityDurationMinutes || 15,
        ownerInactivityScope: settings.ownerInactivityScope || 'PER_CHAT',
        newsEnabled: settings.newsEnabled ?? true,
        newsDefaultCountry: settings.newsDefaultCountry || 'in',
        newsDefaultLanguage: settings.newsDefaultLanguage || 'en',
        newsMaxArticles: settings.newsMaxArticles || 3,
        activeSessionDate: getTodayDateString(),
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
    const {
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber,
      systemPrompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact,
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays,
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords,
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes,
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles,
    } = req.body;

    const settings = await BotSettings.getSettings();

    if (typeof isEnabled === 'boolean') {
      settings.isEnabled = isEnabled;
    }

    if (typeof autoReplyAll === 'boolean') {
      settings.autoReplyAll = autoReplyAll;
    }

    if (typeof allowedPhoneNumber === 'string') {
      settings.allowedPhoneNumber = allowedPhoneNumber.trim();
    }

    if (typeof systemPrompt === 'string') {
      settings.systemPrompt = systemPrompt.trim();
    }

    if (typeof humanSimulationEnabled === 'boolean') {
      settings.humanSimulationEnabled = humanSimulationEnabled;
    }

    if (typeof minReadingDelayMs === 'number') {
      settings.minReadingDelayMs = Math.max(500, minReadingDelayMs);
    }

    if (typeof maxReadingDelayMs === 'number') {
      settings.maxReadingDelayMs = Math.min(20000, Math.max(settings.minReadingDelayMs, maxReadingDelayMs));
    }

    if (typeof typingSpeedCPM === 'number') {
      settings.typingSpeedCPM = Math.max(100, Math.min(1000, typingSpeedCPM));
    }

    if (typeof defaultMaxMessagesPerContact === 'number') {
      settings.defaultMaxMessagesPerContact = Math.max(0, defaultMaxMessagesPerContact);
    }

    if (typeof limitReachedClosingMessage === 'string') {
      settings.limitReachedClosingMessage = limitReachedClosingMessage.trim();
    }

    if (typeof dailySessionStrategy === 'string' && ['RESET', 'ARCHIVE'].includes(dailySessionStrategy.toUpperCase())) {
      settings.dailySessionStrategy = dailySessionStrategy.toUpperCase();
    }

    if (typeof dailyArchiveRetentionDays === 'number') {
      settings.dailyArchiveRetentionDays = Math.max(1, Math.min(30, dailyArchiveRetentionDays));
    }

    if (typeof profanityFilterEnabled === 'boolean') {
      settings.profanityFilterEnabled = profanityFilterEnabled;
    }

    if (typeof profanityReplyMessage === 'string') {
      settings.profanityReplyMessage = profanityReplyMessage.trim();
    }

    if (Array.isArray(customProfanityKeywords)) {
      settings.customProfanityKeywords = customProfanityKeywords.map(k => String(k).trim()).filter(Boolean);
    }

    if (typeof imageGenerationEnabled === 'boolean') {
      settings.imageGenerationEnabled = imageGenerationEnabled;
    }

    if (typeof imageGenerationModel === 'string' && imageGenerationModel.trim() !== '') {
      settings.imageGenerationModel = imageGenerationModel.trim();
    }

    if (typeof imageGenerationNotice === 'string') {
      settings.imageGenerationNotice = imageGenerationNotice.trim();
    }

    if (typeof ownerInactivityTimerEnabled === 'boolean') {
      settings.ownerInactivityTimerEnabled = ownerInactivityTimerEnabled;
    }

    if (typeof ownerInactivityDurationMinutes === 'number' && ownerInactivityDurationMinutes > 0) {
      settings.ownerInactivityDurationMinutes = ownerInactivityDurationMinutes;
    }

    if (typeof ownerInactivityScope === 'string' && ['PER_CHAT', 'GLOBAL'].includes(ownerInactivityScope)) {
      settings.ownerInactivityScope = ownerInactivityScope;
    }

    if (typeof newsEnabled === 'boolean') {
      settings.newsEnabled = newsEnabled;
    }

    if (typeof newsDefaultCountry === 'string' && newsDefaultCountry.trim() !== '') {
      settings.newsDefaultCountry = newsDefaultCountry.trim().toLowerCase();
    }

    if (typeof newsDefaultLanguage === 'string' && newsDefaultLanguage.trim() !== '') {
      settings.newsDefaultLanguage = newsDefaultLanguage.trim().toLowerCase();
    }

    if (typeof newsMaxArticles === 'number' && newsMaxArticles > 0) {
      settings.newsMaxArticles = Math.min(10, Math.max(1, newsMaxArticles));
    }

    settings.updatedAt = new Date();
    await settings.save();

    res.json({
      message: 'Bot settings updated successfully',
      settings: {
        isEnabled: settings.isEnabled,
        autoReplyAll: settings.autoReplyAll,
        allowedPhoneNumber: settings.allowedPhoneNumber,
        systemPrompt: settings.systemPrompt,
        humanSimulationEnabled: settings.humanSimulationEnabled,
        minReadingDelayMs: settings.minReadingDelayMs,
        maxReadingDelayMs: settings.maxReadingDelayMs,
        typingSpeedCPM: settings.typingSpeedCPM,
        defaultMaxMessagesPerContact: settings.defaultMaxMessagesPerContact,
        limitReachedClosingMessage: settings.limitReachedClosingMessage,
        dailySessionStrategy: settings.dailySessionStrategy,
        dailyArchiveRetentionDays: settings.dailyArchiveRetentionDays,
        profanityFilterEnabled: settings.profanityFilterEnabled,
        profanityReplyMessage: settings.profanityReplyMessage,
        customProfanityKeywords: settings.customProfanityKeywords,
        imageGenerationEnabled: settings.imageGenerationEnabled,
        imageGenerationModel: settings.imageGenerationModel,
        imageGenerationNotice: settings.imageGenerationNotice,
        ownerInactivityTimerEnabled: settings.ownerInactivityTimerEnabled,
        ownerInactivityDurationMinutes: settings.ownerInactivityDurationMinutes,
        ownerInactivityScope: settings.ownerInactivityScope,
        newsEnabled: settings.newsEnabled,
        newsDefaultCountry: settings.newsDefaultCountry,
        newsDefaultLanguage: settings.newsDefaultLanguage,
        newsMaxArticles: settings.newsMaxArticles,
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
    const sender = req.body.sender;
    const messageText = req.body.messageText || req.body.message;

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

    const isAutoReplyAll = Boolean(settings.autoReplyAll);
    const isAllowed = matchedContact || allowedList.some((a) => cleanSender === a || cleanSender.endsWith(a) || a.endsWith(cleanSender));

    if (!isAutoReplyAll && !isAllowed && (allowedList.length > 0 || rawAllowed.trim() !== '')) {
      const log = await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: '',
        status: 'IGNORED_PHONE_MISMATCH',
      });
      return res.json({
        success: false,
        status: 'IGNORED_PHONE_MISMATCH',
        message: `Phone number ${sender} is not authorized in whitelist and Auto-Reply All is OFF.`,
        log,
      });
    }

    // 2.39 Check if session is paused due to Owner Inactivity Timer (Owner recently sent a message)
    const inactivityStatus = await checkOwnerInactivityStatus(sender);
    if (inactivityStatus.isPaused) {
      const log = await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: `[Auto-replies paused - Owner active (${inactivityStatus.remainingMinutes}m remaining)]`,
        status: 'PAUSED_OWNER_ACTIVE',
        routingCategory: 'OWNER_ACTIVE',
        routingIntent: 'OWNER_INACTIVITY_PAUSE',
      });
      return res.json({
        success: false,
        status: 'PAUSED_OWNER_ACTIVE',
        message: `Automated replies are PAUSED for ${sender} due to recent owner activity (${inactivityStatus.remainingMinutes}m remaining).`,
        inactivityStatus,
        log,
      });
    }

    // 2.4 Check Per-Contact & Global Max Message Limit (Auto-Cap Controller)
    const contactCountInfo = await getContactMessageCountInfo(sender, matchedContact, settings);
    const effectiveLimit = contactCountInfo.effectiveLimit;

    if (contactCountInfo.isCapReached) {
      if (!contactCountInfo.isFarewellSent) {
        const farewellText = resolveFarewellClosingMessage(matchedContact, settings);
        await markContactFarewellSent(sender, matchedContact);
        const log = await MessageLog.create({
          sender,
          messageIn: messageText,
          messageOut: farewellText,
          status: 'CAP_CLOSING_SENT',
        });
        await recordMessageExchange(sender, messageText, farewellText);
        return res.json({
          success: true,
          status: 'CAP_CLOSING_SENT',
          replyText: farewellText,
          farewellSent: true,
          message: `Max message limit reached (${contactCountInfo.currentCount}/${effectiveLimit}) for ${sender}. Final farewell message sent.`,
          log,
        });
      } else {
        const log = await MessageLog.create({
          sender,
          messageIn: messageText,
          messageOut: `[Auto-Cap Reached (${contactCountInfo.currentCount}/${effectiveLimit}) - AI response skipped]`,
          status: 'CAP_REACHED',
        });
        return res.json({
          success: false,
          status: 'CAP_REACHED',
          message: `Max message limit reached (${contactCountInfo.currentCount}/${effectiveLimit}) for ${sender}. AI responses paused.`,
          log,
        });
      }
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

    // 2.7 Check if user is in game mode or triggering /game or /exit
    const gameTurnResult = await processGameTurn(sender, messageText);
    if (gameTurnResult.handled && gameTurnResult.replyText) {
      const whatsappResult = await sendWhatsAppMessage(sender, gameTurnResult.replyText);
      const log = await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: gameTurnResult.replyText,
        status: 'PROCESSED',
      });
      await recordMessageExchange(sender, messageText, gameTurnResult.replyText);
      return res.json({
        success: true,
        status: 'PROCESSED',
        replyText: gameTurnResult.replyText,
        whatsappResult,
        log,
      });
    }

    // 2.8 Message Classification & Routing (Routine vs Complex)
    let replyText = '';
    let routingCategory = 'COMPLEX';
    let routingIntent = 'AI_COMPLEX';
    let classificationResult = null;

    // 🎨 HUGGING FACE IMAGE GENERATION INTERCEPT
    const isImageGenActive = settings.imageGenerationEnabled ?? true;
    if (isImageGenActive) {
      const imagePromptExtraction = extractImagePrompt(messageText);
      if (imagePromptExtraction && imagePromptExtraction.isImageRequest && imagePromptExtraction.prompt) {
        console.log(`🎨 [Simulate] Image request detected! Prompt: "${imagePromptExtraction.prompt}"`);
        try {
          const imgResult = await generateHuggingFaceImage(
            imagePromptExtraction.prompt,
            settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell'
          );
          replyText = `🎨 Generated with FLUX.1 AI:\n"${imagePromptExtraction.prompt}"`;
          routingCategory = 'IMAGE_GEN';
          routingIntent = 'HUGGINGFACE_TEXT_TO_IMAGE';

          const log = await MessageLog.create({
            sender,
            messageIn: messageText,
            messageOut: replyText,
            status: 'IMAGE_GENERATED',
            routingCategory,
            routingIntent,
            mediaUrl: imgResult.publicUrl,
          });

          await recordMessageExchange(sender, messageText, replyText);

          return res.json({
            success: true,
            status: 'IMAGE_GENERATED',
            replyText,
            mediaUrl: imgResult.publicUrl,
            prompt: imagePromptExtraction.prompt,
            model: settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell',
            log,
          });
        } catch (imgErr) {
          console.error('[Simulate] Image generation error:', imgErr.message);
          replyText = `Maaf kijiye, image generate karne mein dikkat aayi: ${imgErr.message}`;
        }
      }
    }

    // 📰 REAL-TIME WORLD NEWS INTERCEPT (World News API)
    const isNewsActive = settings.newsEnabled ?? true;
    if (!replyText && isNewsActive) {
      const newsQuery = extractNewsQuery(messageText);
      if (newsQuery.isNewsRequest) {
        console.log(`📰 [Simulate] Real-time news request detected! Topic: "${newsQuery.topic || 'Top Headlines'}"`);
        try {
          const newsData = await fetchRealTimeNews({
            text: newsQuery.topic,
            country: settings.newsDefaultCountry || 'in',
            language: settings.newsDefaultLanguage || 'en',
            number: settings.newsMaxArticles || 3,
          });

          if (newsData.success && newsData.articles && newsData.articles.length > 0) {
            replyText = formatNewsForWhatsApp(
              newsData.articles,
              newsQuery.topic || 'Top Headlines',
              settings.newsDefaultCountry || 'in'
            );
            routingCategory = 'NEWS';
            routingIntent = newsQuery.topic ? `NEWS_SEARCH:${newsQuery.topic.substring(0, 30)}` : 'NEWS_TOP_HEADLINES';

            const log = await MessageLog.create({
              sender,
              messageIn: messageText,
              messageOut: replyText,
              status: 'PROCESSED',
              routingCategory,
              routingIntent,
            });

            await recordMessageExchange(sender, messageText, replyText);

            return res.json({
              success: true,
              status: 'PROCESSED',
              reply: replyText,
              replyText,
              routingCategory,
              routingIntent,
              newsArticles: newsData.articles,
              log,
            });
          }
        } catch (newsErr) {
          console.error('[Simulate] Real-time news fetch error:', newsErr.message);
        }
      }
    }

    // 🛑 PROFANITY & ABUSE DETECTION INTERCEPT (Owner-Predefined Reply & Strikes)
    const isProfanityFilterActive = settings.profanityFilterEnabled ?? true;
    if (!replyText && isProfanityFilterActive) {
      const profanityResult = detectProfanity(messageText, settings.customProfanityKeywords || []);
      if (profanityResult.hasProfanity) {
        const strikeInfo = handleProfanityStrike(senderPhone || 'simulator', profanityResult.detectedWord, settings, isAutoReplyAll);
        console.log(`🛑 [Simulate] ABUSE / PROFANITY DETECTED (Word: "${profanityResult.detectedWord}", Strike: ${strikeInfo.strike}, Action: ${strikeInfo.action}).`);
        replyText = strikeInfo.replyText;
        routingCategory = 'PROFANITY';
        routingIntent = strikeInfo.strike === 1 ? 'PROFANITY_FIRST_WARNING' : `PROFANITY_RETALIATION_STRIKE_${strikeInfo.strike}`;
      }
    }

    if (!replyText) {
      try {
        classificationResult = await classifyMessage(messageText, matchedContact, isAutoReplyAll);
        if (classificationResult.category === 'ROUTINE' && classificationResult.templateReply) {
          replyText = classificationResult.templateReply;
          routingCategory = 'ROUTINE';
          routingIntent = classificationResult.intentKey;
          console.log(`⚡ [Simulate] Routine message identified: [${classificationResult.intentKey}] -> Predefined template reply.`);
        } else {
          routingCategory = 'COMPLEX';
          routingIntent = classificationResult.intentKey;
          console.log(`🤖 [Simulate] Complex query identified: [${classificationResult.intentKey}] -> Routing to Gemini AI model.`);
        }
      } catch (routeErr) {
        console.warn('Simulation routing classification warning:', routeErr.message);
      }
    }

    // 3. Dynamic Persona & Isolated Style Prompt Generation for complex queries
    let failResult = null;
    if (!replyText) {
      try {
        const dynamicPrompt = buildDynamicPersonaPrompt(
          settings.systemPrompt,
          matchedContact,
          sender,
          messageText,
          null,
          isAutoReplyAll
        );
        const chatHistory = await getGeminiChatHistory(sender);

        const routerResult = await routeAndGenerateAiReply({
          userMessage: messageText,
          sender,
          dynamicPrompt,
          chatHistory,
          mediaPayload: null,
        });
        replyText = routerResult.replyText;
        await resetFailedAttempts(sender);

        const geminiImageMatch = replyText && replyText.match(/\[GENERATE_IMAGE:\s*([^\]]+)\]/i);
        if (geminiImageMatch && geminiImageMatch[1]) {
          const imagePrompt = geminiImageMatch[1].trim();
          replyText = replyText.replace(geminiImageMatch[0], '').trim();
          try {
            generatedImageResult = await generateHuggingFaceImage(
              imagePrompt,
              settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell'
            );
            if (!replyText) {
              replyText = `🎨 *Generated Image for:* "${imagePrompt}"`;
            }
            routingCategory = 'IMAGE_GEN';
            routingIntent = 'GEMINI_FLUX_DIFFUSION';
          } catch (hfImgErr) {
            console.error('[Simulate] Gemini image gen error:', hfImgErr.message);
          }
        }
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
            routingCategory,
            routingIntent,
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
    }

    // Strictly sanitize kinship terms when Global Auto-Reply All is active
    if (isAutoReplyAll && replyText) {
      replyText = stripKinshipTerms(replyText);
    }

    // 4. WhatsApp Send (or simulation)
    const whatsappResult = await sendWhatsAppMessage(sender, replyText);

    // 🌲 Store interaction vector in Pinecone for semantic memory
    storeConversationVector(sender, messageText, replyText, { source: 'simulator' }).catch(() => {});

    let closingMessageSent = null;
    if (effectiveLimit > 0) {
      const incResult = await incrementContactMessageCount(sender, matchedContact, effectiveLimit);
      if (incResult.reachedCapNow && !incResult.isFarewellSent) {
        closingMessageSent = resolveFarewellClosingMessage(matchedContact, settings);
        await markContactFarewellSent(sender, matchedContact);
        try {
          await MessageLog.create({
            sender,
            messageIn: `[Auto-Cap Limit (${incResult.currentCount}/${effectiveLimit}) Final Trigger]`,
            messageOut: closingMessageSent,
            status: 'CAP_CLOSING_SENT',
          });
          await recordMessageExchange(sender, '[Limit Reached Announcement]', closingMessageSent);
        } catch (simCloseErr) {}
      }
    }

    // 5. DB Logging
    const log = await MessageLog.create({
      sender,
      messageIn: messageText,
      messageOut: replyText,
      status: routingCategory === 'PROFANITY'
        ? 'PROFANITY_BLOCKED'
        : failResult?.triggeredHandover
        ? 'AGENT_HANDOFF_TRIGGERED'
        : 'PROCESSED',
      routingCategory,
      routingIntent,
    });

    // 6. Record to capped ChatSession history
    try {
      await recordMessageExchange(sender, messageText, replyText);
    } catch (histErr) {
      console.warn('Simulation history recording note:', histErr.message);
    }

    // 7. Trigger CRM Lead Tagging & Sentiment Classification
    try {
      analyzeAndTagContact(sender, messageText).catch((crmErr) => {
        console.warn('Simulation CRM classification note:', crmErr.message);
      });
    } catch (cCallErr) {}

    return res.json({
      success: true,
      status: failResult?.triggeredHandover ? 'AGENT_HANDOFF_TRIGGERED' : 'PROCESSED',
      routing: {
        category: routingCategory,
        intent: routingIntent,
        servedByTemplate: routingCategory === 'ROUTINE',
      },
      replyText,
      closingMessage: closingMessageSent,
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

/**
 * POST /api/settings/reset-all-counters
 * Globally resets all contact and session message counters back to 0 and unblocks all caps
 */
const resetAllMessageCounters = async (req, res) => {
  try {
    const r1 = await WhitelistContact.updateMany(
      {},
      { $set: { messagesSentCount: 0, isCapReached: false, isFarewellSent: false, capReachedAt: null } }
    );
    const r2 = await ChatSession.updateMany(
      {},
      { $set: { messagesSentCount: 0, isCapReached: false, isFarewellSent: false, capReachedAt: null } }
    );
    return res.json({
      success: true,
      message: `Successfully reset message counters for all contacts (${r1.modifiedCount}) and chat sessions (${r2.modifiedCount}). All auto-replies are active and unblocked!`,
      contactsReset: r1.modifiedCount,
      sessionsReset: r2.modifiedCount,
    });
  } catch (error) {
    console.error('Error in resetAllMessageCounters:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset all message counters' });
  }
};

/**
 * POST /api/history/daily-rollover
 * Manually trigger daily session archiving & rollover
 */
const triggerDailySessionRollover = async (req, res) => {
  try {
    const result = await runDailySessionArchiver();
    return res.json(result);
  } catch (error) {
    console.error('Error in triggerDailySessionRollover:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/system/incidents
 * Retrieve supervisor status and recent incident history
 */
const getSystemIncidents = async (req, res) => {
  try {
    const status = await getSupervisorStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error in getSystemIncidents:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/system/test-alert
 * Trigger simulated alert notification via WhatsApp & Email
 */
const triggerManualTestAlert = async (req, res) => {
  try {
    const customMessage = req.body?.message || 'Manual test alert dispatched from WhatsApp Bot Dashboard';
    const result = await triggerTestAlert(customMessage);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('Error in triggerManualTestAlert:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/routing/templates
 * Retrieve all predefined routine templates
 */
const getRoutingTemplates = async (req, res) => {
  try {
    const templates = await RoutineTemplate.find().sort({ createdAt: 1 }).lean();
    return res.json({ success: true, count: templates.length, templates });
  } catch (error) {
    console.error('Error in getRoutingTemplates:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/routing/templates/:id
 * Update an existing routine template
 */
const updateRoutingTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, defaultTemplate, patterns, isEnabled, personaOverrides } = req.body;

    const template = await RoutineTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Routine template not found' });
    }

    if (typeof name === 'string') template.name = name.trim();
    if (typeof defaultTemplate === 'string') template.defaultTemplate = defaultTemplate.trim();
    if (Array.isArray(patterns)) template.patterns = patterns;
    if (typeof isEnabled === 'boolean') template.isEnabled = isEnabled;
    if (personaOverrides && typeof personaOverrides === 'object') {
      template.personaOverrides = { ...template.personaOverrides, ...personaOverrides };
    }

    await template.save();
    return res.json({ success: true, message: 'Template updated successfully', template });
  } catch (error) {
    console.error('Error in updateRoutingTemplate:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/routing/classify
 * Test-classify any sample message text
 */
const testClassifyMessage = async (req, res) => {
  try {
    const { text, sender } = req.body;
    let matchedContact = null;
    if (sender) {
      const cleanSender = String(sender).replace(/\D/g, '');
      const allContacts = await WhitelistContact.find().lean();
      matchedContact = allContacts.find((c) => {
        const cClean = c.phoneNumber.replace(/\D/g, '');
        return cleanSender === cClean || cleanSender.endsWith(cClean) || cClean.endsWith(cleanSender);
      });
    }

    const result = await classifyMessage(text || '', matchedContact);
    return res.json({ success: true, text, result });
  } catch (error) {
    console.error('Error in testClassifyMessage:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/profanity/test
 * Test profanity detection for any sample message text
 */
const testProfanityCheck = async (req, res) => {
  try {
    const { text, customKeywords } = req.body;
    const settings = await BotSettings.getSettings();
    const activeCustom = Array.isArray(customKeywords) ? customKeywords : (settings.customProfanityKeywords || []);
    const detection = detectProfanity(text || '', activeCustom);

    return res.json({
      success: true,
      text,
      isProfanityFilterActive: settings.profanityFilterEnabled ?? true,
      detection,
      ownerPredefinedReply: settings.profanityReplyMessage,
    });
  } catch (error) {
    console.error('Error in testProfanityCheck:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/image-gen/test
 * Test Hugging Face Image Generation prompt directly from dashboard sandbox
 */
const testImageGeneration = async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    const settings = await BotSettings.getSettings();
    const activeModel = model || settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell';

    const startTime = Date.now();
    const result = await generateHuggingFaceImage(prompt.trim(), activeModel);
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    return res.json({
      success: true,
      prompt: prompt.trim(),
      model: activeModel,
      durationSeconds: parseFloat(durationSeconds),
      imageUrl: result.publicUrl,
      fileName: result.filename,
      sizeBytes: result.buffer ? result.buffer.length : 0,
    });
  } catch (error) {
    console.error('Error in testImageGeneration:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/inactivity/simulate-owner-action
 * Simulates the owner sending a WhatsApp message to reset the inactivity timer and pause replies
 */
const simulateOwnerAction = async (req, res) => {
  try {
    const { contactPhone, durationMinutes } = req.body;
    const result = await recordOwnerActivity(contactPhone, durationMinutes);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in simulateOwnerAction:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/inactivity/active
 * Returns all chat sessions currently paused due to owner inactivity timer
 */
const getActiveInactivityList = async (req, res) => {
  try {
    const sessions = await getActiveInactivitySessions();
    return res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error in getActiveInactivityList:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/inactivity/resume/:contactPhone?
 * Manually unpauses and resumes automated replies for a contact or globally
 */
const resumeOwnerInactivityHandler = async (req, res) => {
  try {
    const contactPhone = req.params.contactPhone || req.body.contactPhone;
    const result = await resumeOwnerInactivity(contactPhone);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in resumeOwnerInactivityHandler:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/news/test
 * Sandbox endpoint to test real-time news search from dashboard
 */
const testNewsSearch = async (req, res) => {
  try {
    const { query, country, language, number } = req.body;
    const settings = await BotSettings.getSettings();

    const result = await fetchRealTimeNews({
      text: query || null,
      country: country || settings.newsDefaultCountry || 'in',
      language: language || settings.newsDefaultLanguage || 'en',
      number: number || settings.newsMaxArticles || 3,
    });

    const formattedWhatsApp = formatNewsForWhatsApp(
      result.articles,
      query || 'Top Headlines',
      country || settings.newsDefaultCountry || 'in'
    );

    return res.json({
      success: result.success,
      articles: result.articles,
      totalResults: result.totalResults,
      formattedWhatsApp,
      error: result.error,
    });
  } catch (err) {
    console.error('Error in testNewsSearch:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/search/test
 * GET /api/search
 * Test Google Programmable Search Engine via HTTP request
 */
const testGoogleSearch = async (req, res) => {
  try {
    const query = req.body?.query || req.query?.q || req.query?.query;
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "query" or "q" is required',
      });
    }

    const settings = await BotSettings.getSettings();
    const cx = req.body?.cx || req.query?.cx || settings.googleSearchCx || process.env.GOOGLE_SEARCH_CX || '8002fdf14f0bb4998';
    const apiKey = req.body?.apiKey || req.query?.apiKey || settings.googleSearchApiKey || process.env.GOOGLE_SEARCH_API_KEY || process.env.GEMINI_API_KEY;
    const num = parseInt(req.body?.num || req.query?.num, 10) || settings.googleSearchMaxResults || 4;

    const result = await searchGoogle(query, {
      cx,
      apiKey,
      num,
    });

    const whatsappFormatted = formatSearchResultsForWhatsApp(result, query);

    return res.json({
      success: result.success,
      query: result.query,
      cx,
      totalResults: result.totalResults,
      searchTime: result.searchTime,
      items: result.items,
      whatsappFormatted,
      error: result.error,
    });
  } catch (err) {
    console.error('Error in testGoogleSearch:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/nasa/apod
 * Fetch NASA Astronomy Picture of the Day
 */
const getNasaApodEndpoint = async (req, res) => {
  try {
    const { date, count } = req.query;
    const data = await fetchNasaApod({ date, count: count ? Number(count) : undefined });
    return res.json({
      ...data,
      whatsappFormatted: formatNasaApodForWhatsApp(data),
    });
  } catch (err) {
    console.error('Error in getNasaApodEndpoint:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/nasa/asteroids
 * Fetch Near Earth Asteroids approaching today
 */
const getNasaAsteroidsEndpoint = async (req, res) => {
  try {
    const data = await fetchNearEarthObjects();
    return res.json({
      ...data,
      whatsappFormatted: formatNasaNeoForWhatsApp(data),
    });
  } catch (err) {
    console.error('Error in getNasaAsteroidsEndpoint:', err);
    return res.status(500).json({ success: false, error: err.message });
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
};


