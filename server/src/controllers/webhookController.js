const BotSettings = require("../models/BotSettings");
const MessageLog = require("../models/MessageLog");
const WhitelistContact = require("../models/WhitelistContact");
const { generateGeminiReply } = require("../services/geminiService");
const { checkActiveSchedule } = require("../services/scheduleService");
const { sendWhatsAppMessage, sendWhatsAppImage } = require("../services/whatsappService");
const {
  getGeminiChatHistory,
  recordMessageExchange,
  isSessionHandedOff,
  detectAgentKeyword,
  activateHandover,
  recordFailedAttempt,
  resetFailedAttempts,
  getSessionMessageCount,
  incrementSessionMessageCount,
} = require("../services/chatHistoryService");
const { processGameTurn } = require("../services/gameService");
const { buildDynamicPersonaPrompt } = require("../services/personaService");
const {
  validateTwilioSignature,
  buildTwimlMessageResponse,
  buildTwimlEmptyResponse,
} = require("../services/twilioService");
const { classifyMessage } = require("../services/messageRoutingService");
const { detectProfanity, handleProfanityStrike } = require("../services/profanityService");
const { extractImagePrompt, generateHuggingFaceImage } = require("../services/huggingFaceService");
const { checkOwnerInactivityStatus } = require("../services/inactivityTimerService");
const {
  extractNewsQuery,
  fetchRealTimeNews,
  formatNewsForWhatsApp,
} = require("../services/worldNewsService");

/**
 * Normalizes phone numbers for comparison (removes all non-digit characters)
 */
function normalizePhoneNumber(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

/**
 * Verification endpoint for Meta WhatsApp Cloud API (GET /webhook)
 */
const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || "whatsapp_bot_verify_token_secret_123";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ WhatsApp Webhook verified successfully!");
      return res.status(200).send(challenge);
    } else {
      console.warn(
        `❌ WhatsApp Webhook verification failed. Token mismatch: received "${token}", expected "${verifyToken}"`,
      );
      return res.status(403).json({ error: "Verification token mismatch" });
    }
  }

  return res
    .status(400)
    .json({ error: "Missing hub.mode or hub.verify_token query parameters" });
};

/**
 * Event handler for incoming Twilio WhatsApp messages (POST /webhook/twilio or POST /webhook)
 */
const handleTwilioWebhook = async (req, res) => {
  try {
    const params = req.body || {};
    const accountSid = params.AccountSid;
    const configuredSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    // 1. Security Verification: Account SID Check
    if (accountSid && configuredSid && accountSid !== configuredSid) {
      console.warn(`❌ [Twilio] Webhook rejected: Unauthorized AccountSid "${accountSid}" (expected "${configuredSid}")`);
      return res.status(403).type('text/xml').send(buildTwimlEmptyResponse());
    }

    // 2. Security Verification: Cryptographic Signature Check (if auth token configured)
    if (authToken && authToken.trim() !== '') {
      const signature = req.headers['x-twilio-signature'];
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

      const isValid = validateTwilioSignature(signature, fullUrl, params, authToken);
      if (!isValid) {
        console.warn('❌ [Twilio] Signature verification failed for incoming request.');
        return res.status(403).type('text/xml').send(buildTwimlEmptyResponse());
      }
    }

    // 3. Extract Message Details
    const rawFrom = params.From || '';
    const sender = rawFrom.replace(/^whatsapp:/i, '').trim();
    const messageId = params.MessageSid || params.SmsMessageSid || params.SmsSid || `twilio_${Date.now()}`;
    const profileName = params.ProfileName || '';
    const numMedia = parseInt(params.NumMedia || '0', 10);

    let messageText = (params.Body || '').trim();
    if (!messageText && numMedia > 0) {
      const contentType = params.MediaContentType0 || 'media';
      messageText = `[Received ${contentType} via WhatsApp]`;
    }

    console.log(`📩 [Twilio] Incoming message from ${sender}${profileName ? ` (${profileName})` : ''}: "${messageText}" [SID: ${messageId}]`);

    // Fetch current bot settings from MongoDB
    const settings = await BotSettings.getSettings();

    // 4. Check if Bot is Enabled
    if (!settings.isEnabled) {
      console.log(`⏸️ [Twilio] Bot is DISABLED. Skipping message from ${sender}.`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: '',
        status: 'BOT_DISABLED',
        metaMessageId: messageId,
      });
      return res.type('text/xml').send(buildTwimlEmptyResponse());
    }

    // 5. Phone Number Filter & Auto-Reply All
    const isAutoReplyAll = Boolean(settings.autoReplyAll);
    const cleanSender = normalizePhoneNumber(sender);
    let matchedContact = null;

    try {
      const allContacts = await WhitelistContact.find();
      matchedContact = allContacts.find((c) => {
        const cClean = normalizePhoneNumber(c.phoneNumber);
        return cleanSender === cClean || cleanSender.endsWith(cClean) || cClean.endsWith(cleanSender);
      });
    } catch (cErr) {
      console.warn('[Twilio] Contact lookup warning:', cErr.message);
    }

    if (!isAutoReplyAll) {
      const rawAllowed = settings.allowedPhoneNumber || '';
      const allowedList = rawAllowed
        .split(/[,;\n\s]+/)
        .map((num) => num.replace(/\D/g, ''))
        .filter((num) => num.length >= 7 && num !== '1234567890');

      const isAllowedByString = allowedList.some(
        (allowed) => cleanSender === allowed || cleanSender.endsWith(allowed) || allowed.endsWith(cleanSender)
      );

      const isAllowed = matchedContact || isAllowedByString;

      if (!isAllowed && (allowedList.length > 0 || rawAllowed.trim() !== '')) {
        console.log(`🚫 [Twilio] Phone Filter: Sender ${sender} is not in whitelist and Auto-Reply All is OFF.`);
        await MessageLog.create({
          sender,
          messageIn: messageText,
          messageOut: '',
          status: 'IGNORED_PHONE_MISMATCH',
          metaMessageId: messageId,
        });
        return res.type('text/xml').send(buildTwimlEmptyResponse());
      }
    }

    if (isAutoReplyAll) {
      console.log(`🌐 [Twilio] Auto-Reply All is ACTIVE: Processing message from ${sender} with respectful, polite, and peaceful tone.`);
    }

    // 6. Check Per-Contact or Global Max Message Cap
    const effectiveLimit = (matchedContact && typeof matchedContact.maxMessageLimit === 'number' && matchedContact.maxMessageLimit > 0)
      ? matchedContact.maxMessageLimit
      : (settings.defaultMaxMessagesPerContact || 0);

    const sessionCountInfo = await getSessionMessageCount(sender);
    if (effectiveLimit > 0 && sessionCountInfo.messagesSentCount >= effectiveLimit) {
      console.log(`🛑 [Twilio] MAX MESSAGE LIMIT REACHED (${sessionCountInfo.messagesSentCount}/${effectiveLimit}) for ${sender}.`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: `[Auto-Cap Reached (${sessionCountInfo.messagesSentCount}/${effectiveLimit}) - AI response skipped]`,
        status: 'CAP_REACHED',
        metaMessageId: messageId,
      });
      return res.type('text/xml').send(buildTwimlEmptyResponse());
    }

    // 7. Check if Live Agent Mode is Active
    const isPausedForAgent = await isSessionHandedOff(sender);
    if (isPausedForAgent) {
      console.log(`🛑 [Twilio] Automated replies PAUSED for ${sender} (Live Agent Mode Active).`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: '[Automated responses paused - Live agent active]',
        status: 'PAUSED_FOR_AGENT',
        metaMessageId: messageId,
      });
      return res.type('text/xml').send(buildTwimlEmptyResponse());
    }

    // 7.5 Check if session is paused due to Owner Inactivity Timer (Owner recently sent a message)
    const inactivityStatus = await checkOwnerInactivityStatus(sender);
    if (inactivityStatus.isPaused) {
      console.log(`🤫 [Twilio] Automated replies PAUSED for ${sender} due to recent owner activity (${inactivityStatus.remainingMinutes}m remaining).`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: `[Auto-replies paused - Owner active (${inactivityStatus.remainingMinutes}m remaining)]`,
        status: 'PAUSED_OWNER_ACTIVE',
        routingCategory: 'OWNER_ACTIVE',
        routingIntent: 'OWNER_INACTIVITY_PAUSE',
        metaMessageId: messageId,
      });
      return res.type('text/xml').send(buildTwimlEmptyResponse());
    }

    // 8. Agent keyword detection
    const requestedAgent = detectAgentKeyword(messageText);
    if (requestedAgent) {
      console.log(`🚨 [Twilio] Live Agent requested by ${sender} via keyword.`);
      await activateHandover(sender, 'KEYWORD_AGENT');

      const isEnglishQuery = /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(messageText) && !/\b(kya|bhai|bolo|karo|nahi)\b/i.test(messageText);
      const handoverReply = isEnglishQuery
        ? "I am connecting you with our live agent team immediately. Automated responses have been paused. A team member will assist you shortly."
        : "Main aapko hamari live team se connect kar raha hoon. AI replies pause kar diye gaye hain, hamari team aapse jald hi rabta karegi.";

      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: handoverReply,
        status: 'AGENT_HANDOFF_TRIGGERED',
        metaMessageId: messageId,
      });
      await recordMessageExchange(sender, messageText, handoverReply);
      return res.type('text/xml').send(buildTwimlMessageResponse(handoverReply));
    }

    // 9. Game turn check
    const gameTurnResult = await processGameTurn(sender, messageText);
    if (gameTurnResult.handled && gameTurnResult.replyText) {
      console.log(`🎮 [Twilio] Game turn processed for ${sender}.`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: gameTurnResult.replyText,
        status: 'PROCESSED',
        metaMessageId: messageId,
      });
      await recordMessageExchange(sender, messageText, gameTurnResult.replyText);
      return res.type('text/xml').send(buildTwimlMessageResponse(gameTurnResult.replyText));
    }

    let replyText = '';
    let routingCategory = 'COMPLEX';
    let routingIntent = 'AI_COMPLEX';

    // 🛑 PROFANITY & ABUSE DETECTION INTERCEPT (Owner-Predefined Reply)
    const isProfanityFilterActive = settings.profanityFilterEnabled ?? true;
    if (isProfanityFilterActive) {
      const profanityResult = detectProfanity(messageText, settings.customProfanityKeywords || []);
      if (profanityResult.hasProfanity) {
        const strikeInfo = handleProfanityStrike(sender, profanityResult.detectedWord, settings);
        console.log(`🛑 [Twilio] ABUSE / PROFANITY DETECTED from ${sender} (Word: "${profanityResult.detectedWord}", Strike: ${strikeInfo.strike}, Action: ${strikeInfo.action}). Intercepting.`);
        replyText = strikeInfo.replyText;
        routingCategory = 'PROFANITY';
        routingIntent = strikeInfo.strike === 1 ? 'PROFANITY_FIRST_WARNING' : `PROFANITY_RETALIATION_STRIKE_${strikeInfo.strike}`;
      }
    }

    // 🎨 HUGGING FACE TEXT-TO-IMAGE GENERATION INTERCEPT
    let generatedImageResult = null;
    const isImageGenActive = settings.imageGenerationEnabled ?? true;
    if (!replyText && isImageGenActive) {
      const imagePromptExtraction = extractImagePrompt(messageText);
      if (imagePromptExtraction.isImageRequest && imagePromptExtraction.prompt) {
        console.log(`🎨 [Twilio] Image request: "${imagePromptExtraction.prompt}"`);
        try {
          generatedImageResult = await generateHuggingFaceImage(
            imagePromptExtraction.prompt,
            settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell'
          );
          replyText = `🎨 Generated Image for: "${imagePromptExtraction.prompt}"\nModel: ${generatedImageResult.model} (${generatedImageResult.durationSeconds}s)`;
          routingCategory = 'IMAGE_GEN';
          routingIntent = 'TEXT_TO_IMAGE_FLUX';
        } catch (imgErr) {
          console.error('[Twilio] Image generation error:', imgErr.message);
          replyText = `Image generation error: ${imgErr.message}`;
        }
      }
    }

    // 📰 REAL-TIME WORLD NEWS INTERCEPT (World News API)
    const isNewsActive = settings.newsEnabled ?? true;
    if (!replyText && isNewsActive) {
      const newsQuery = extractNewsQuery(messageText);
      if (newsQuery.isNewsRequest) {
        console.log(`📰 [Twilio] Real-time news request detected! Topic: "${newsQuery.topic || 'Top Headlines'}"`);
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
          }
        } catch (newsErr) {
          console.error('[Twilio] Real-time news fetch error:', newsErr.message);
        }
      }
    }

    try {
      if (!replyText) {
        const matchedSchedule = await checkActiveSchedule(new Date(), matchedContact?.relationship, sender);
        if (matchedSchedule) {
          console.log(`📅 [Twilio] Active schedule matched: "${matchedSchedule.title}"`);
          replyText = matchedSchedule.autoReplyText;
          routingCategory = 'SCHEDULE';
          routingIntent = 'SCHEDULED_EVENT';
        }
      }
    } catch (schedErr) {
      console.warn('[Twilio] Schedule check warning:', schedErr.message);
    }

    // 11. Message Classification & Routing (Routine vs Complex)
    if (!replyText) {
      try {
        const classification = await classifyMessage(messageText, matchedContact);
        if (classification.category === 'ROUTINE' && classification.templateReply) {
          console.log(`⚡ [Twilio] Routine inquiry identified: [${classification.intentKey}] -> Predefined template reply.`);
          replyText = classification.templateReply;
          routingCategory = 'ROUTINE';
          routingIntent = classification.intentKey;
        } else {
          console.log(`🤖 [Twilio] Complex query identified: [${classification.intentKey}] -> Routing to Gemini AI model.`);
          routingCategory = 'COMPLEX';
          routingIntent = classification.intentKey;
        }
      } catch (routeErr) {
        console.warn('[Twilio] Routing classification warning:', routeErr.message);
      }
    }

    // 12. Generate Google Gemini AI Reply for complex queries
    let failResult = null;
    if (!replyText) {
      console.log(`🤖 [Twilio] Generating ${isAutoReplyAll ? 'respectful & peaceful ' : 'polite '}Gemini reply for ${sender}...`);
      try {
        const chatHistory = await getGeminiChatHistory(sender);
        const dynamicPrompt = buildDynamicPersonaPrompt(
          settings.systemPrompt,
          matchedContact,
          sender,
          messageText,
          null,
          isAutoReplyAll
        );
        replyText = await generateGeminiReply(messageText, dynamicPrompt, chatHistory);
        await resetFailedAttempts(sender);
      } catch (geminiErr) {
        console.error('[Twilio] Gemini error:', geminiErr.message);
        failResult = await recordFailedAttempt(sender);
        if (failResult.triggeredHandover) {
          replyText = "I apologize, but I am unable to properly resolve your query. I have notified our live agent team immediately and paused automated replies so a human can step in to assist you.";
        } else {
          await MessageLog.create({
            sender,
            messageIn: messageText,
            messageOut: '',
            status: 'ERROR',
            routingCategory,
            routingIntent,
            errorMessage: `Gemini failure (attempt ${failResult.unresolvedAttempts}/3): ${geminiErr.message}`,
            metaMessageId: messageId,
          });
          return res.type('text/xml').send(buildTwimlEmptyResponse());
        }
      }
    }

    // 13. Record log in MongoDB
    await MessageLog.create({
      sender,
      messageIn: messageText,
      messageOut: replyText,
      status: generatedImageResult
        ? 'IMAGE_GENERATED'
        : routingCategory === 'PROFANITY'
        ? 'PROFANITY_BLOCKED'
        : failResult?.triggeredHandover
        ? 'AGENT_HANDOFF_TRIGGERED'
        : 'PROCESSED',
      mediaUrl: generatedImageResult?.publicUrl || null,
      routingCategory,
      routingIntent,
      metaMessageId: messageId,
    });

    // 13. Record to ChatSession history
    try {
      await recordMessageExchange(sender, messageText, replyText);
    } catch (histErr) {
      console.warn('[Twilio] History record error:', histErr.message);
    }

    // 14. Increment contact count & handle auto-closing message
    if (effectiveLimit > 0) {
      const incResult = await incrementSessionMessageCount(sender, effectiveLimit);
      if (incResult.reachedCapNow && incResult.currentCount === effectiveLimit) {
        const closingText = (settings.limitReachedClosingMessage && settings.limitReachedClosingMessage.trim() !== '')
          ? settings.limitReachedClosingMessage.trim()
          : 'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye AI wasim bot se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much!';

        replyText += `\n\n${closingText}`;
      }
    }

    console.log(`✅ [Twilio] Successfully generated response for ${sender}`);
    return res.type('text/xml').send(buildTwimlMessageResponse(replyText));
  } catch (err) {
    console.error('Twilio webhook processing exception:', err);
    return res.type('text/xml').send(buildTwimlEmptyResponse());
  }
};

/**
 * Event handler for incoming WhatsApp messages (POST /webhook)
 * Automatically detects and processes Twilio WhatsApp webhooks or Meta Cloud API webhooks
 */
const handleIncoming = async (req, res) => {
  // Auto-detect if request is from Twilio WhatsApp webhook
  const isTwilio = Boolean(
    req.body && (
      req.body.AccountSid ||
      req.body.MessageSid ||
      req.body.SmsSid ||
      (typeof req.body.From === 'string' && req.body.From.startsWith('whatsapp:'))
    )
  );

  if (isTwilio) {
    return handleTwilioWebhook(req, res);
  }

  // Always return 200 OK to Meta quickly to acknowledge receipt
  try {
    const body = req.body;

    if (!body || body.object !== "whatsapp_business_account") {
      return res
        .status(200)
        .json({ status: "ignored_not_whatsapp_business_account" });
    }

    const entry = Array.isArray(body.entry) ? body.entry[0] : body.entry || {};
    const changes = Array.isArray(entry.changes)
      ? entry.changes[0]
      : entry.changes || {};
    const value = changes.value || {};

    const rawMessages = value.messages || body.messages;
    const messages = Array.isArray(rawMessages)
      ? rawMessages
      : rawMessages
        ? [rawMessages]
        : [];

    // Check if this is a message event or status update (e.g., delivered/read)
    if (messages.length === 0) {
      // Ignored non-message events (e.g. read receipts, delivery confirmations)
      return res.status(200).json({ status: "ignored_no_messages" });
    }

    const message = messages[0];
    const contacts = Array.isArray(value.contacts)
      ? value.contacts[0]
      : value.contacts;
    const sender = message.from || contacts?.wa_id || "unknown";
    const messageId = message.id || null;

    // We process text messages, or provide a default notice if media/interactive
    let messageText = "";
    if (message.type === "text" && message.text?.body) {
      messageText = message.text.body;
    } else {
      messageText = `[Received ${message.type} message]`;
    }

    console.log(`📩 Incoming message from ${sender}: "${messageText}"`);

    // Fetch current bot settings from MongoDB
    const settings = await BotSettings.getSettings();

    // 1. Check if Bot is Enabled
    if (!settings.isEnabled) {
      console.log(
        `⏸️ Bot is currently DISABLED. Skipping message from ${sender}.`,
      );
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: "",
        status: "BOT_DISABLED",
        metaMessageId: messageId,
      });
      return res.status(200).json({ status: "bot_disabled" });
    }

    // 2. Phone Number Filter: Process only from selected allowed phone numbers unless autoReplyAll is enabled
    const isAutoReplyAll = Boolean(settings.autoReplyAll);
    const cleanSender = normalizePhoneNumber(sender);
    let matchedContact = null;

    try {
      const allContacts = await WhitelistContact.find();
      matchedContact = allContacts.find((c) => {
        const cClean = normalizePhoneNumber(c.phoneNumber);
        return cleanSender === cClean || cleanSender.endsWith(cClean) || cClean.endsWith(cleanSender);
      });
    } catch (cErr) {
      console.warn("Webhook contact lookup warning:", cErr.message);
    }

    if (!isAutoReplyAll) {
      const rawAllowed = settings.allowedPhoneNumber || '';
      const allowedList = rawAllowed
        .split(/[,;\n\s]+/)
        .map((num) => num.replace(/\D/g, ''))
        .filter((num) => num.length >= 7 && num !== '1234567890');

      const isAllowedByString = allowedList.some(
        (allowed) => cleanSender === allowed || cleanSender.endsWith(allowed) || allowed.endsWith(cleanSender)
      );

      const isAllowed = matchedContact || isAllowedByString;

      if (!isAllowed && (allowedList.length > 0 || rawAllowed.trim() !== '')) {
        console.log(
          `🚫 Phone Filter: Sender ${sender} is not in your selected allowed numbers list and Auto-Reply All is OFF. Message filtered.`
        );
        await MessageLog.create({
          sender,
          messageIn: messageText,
          messageOut: '',
          status: 'IGNORED_PHONE_MISMATCH',
          metaMessageId: messageId,
        });
        return res.status(200).json({ status: 'ignored_phone_mismatch' });
      }
    }

    if (isAutoReplyAll) {
      console.log(`🌐 Auto-Reply All is ACTIVE: Processing incoming webhook message from ${sender} with respectful, polite, and peaceful tone.`);
    }

    // 2.2 Max Message Cap Check (Per-Contact or Global default)
    const effectiveLimit = (matchedContact && typeof matchedContact.maxMessageLimit === 'number' && matchedContact.maxMessageLimit > 0)
      ? matchedContact.maxMessageLimit
      : (settings.defaultMaxMessagesPerContact || 0);
    const sessionCountInfo = await getSessionMessageCount(sender);
    if (effectiveLimit > 0 && sessionCountInfo.messagesSentCount >= effectiveLimit) {
      console.log(`🛑 MAX MESSAGE LIMIT REACHED (${sessionCountInfo.messagesSentCount}/${effectiveLimit}) for ${sender}. Skipping automated reply.`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: `[Auto-Cap Reached (${sessionCountInfo.messagesSentCount}/${effectiveLimit}) - AI response skipped]`,
        status: 'CAP_REACHED',
        metaMessageId: messageId,
      });
      return res.status(200).json({ status: 'cap_reached' });
    }

    // 2.5 Check if session is paused for Live Agent
    const isPausedForAgent = await isSessionHandedOff(sender);
    if (isPausedForAgent) {
      console.log(`🛑 Automated replies PAUSED for ${sender} (Live Agent Mode Active).`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: '[Automated responses paused - Live agent active]',
        status: 'PAUSED_FOR_AGENT',
        metaMessageId: messageId,
      });
      return res.status(200).json({ status: 'paused_for_agent' });
    }

    // 2.55 Check if session is paused due to Owner Inactivity Timer (Owner recently sent a message)
    const inactivityStatus = await checkOwnerInactivityStatus(sender);
    if (inactivityStatus.isPaused) {
      console.log(`🤫 Automated replies PAUSED for ${sender} due to recent owner activity (${inactivityStatus.remainingMinutes}m remaining).`);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: `[Auto-replies paused - Owner active (${inactivityStatus.remainingMinutes}m remaining)]`,
        status: 'PAUSED_OWNER_ACTIVE',
        routingCategory: 'OWNER_ACTIVE',
        routingIntent: 'OWNER_INACTIVITY_PAUSE',
        metaMessageId: messageId,
      });
      return res.status(200).json({ status: 'paused_owner_active' });
    }

    // 2.6 Check if user explicitly typed 'agent' or 'human' keyword
    const requestedAgent = detectAgentKeyword(messageText);
    if (requestedAgent) {
      console.log(`🚨 Live Agent requested by ${sender} via keyword ("${messageText}"). Pausing automated responses.`);
      await activateHandover(sender, 'KEYWORD_AGENT');

      const isEnglishQuery = /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(messageText) && !/\b(kya|bhai|bolo|karo|nahi)\b/i.test(messageText);
      const handoverReply = isEnglishQuery
        ? "I am connecting you with our live agent team immediately. Automated responses have been paused. A team member will assist you shortly."
        : "Main aapko hamari live team se connect kar raha hoon. AI replies pause kar diye gaye hain, hamari team aapse jald hi rabta karegi.";

      try {
        await sendWhatsAppMessage(sender, handoverReply);
        await MessageLog.create({
          sender,
          messageIn: messageText,
          messageOut: handoverReply,
          status: 'AGENT_HANDOFF_TRIGGERED',
          metaMessageId: messageId,
        });
        await recordMessageExchange(sender, messageText, handoverReply);
      } catch (hErr) {
        console.error('Handover notification send error:', hErr.message);
      }
      return res.status(200).json({ status: 'agent_handoff_triggered', replyText: handoverReply });
    }

    // 2.7 Check if user is in game mode or triggering /game or /exit
    const gameTurnResult = await processGameTurn(sender, messageText);
    if (gameTurnResult.handled && gameTurnResult.replyText) {
      console.log(`🎮 Game turn processed for ${sender}.`);
      try {
        await sendWhatsAppMessage(sender, gameTurnResult.replyText);
        await MessageLog.create({
          sender,
          messageIn: messageText,
          messageOut: gameTurnResult.replyText,
          status: 'PROCESSED',
          metaMessageId: messageId,
        });
        await recordMessageExchange(sender, messageText, gameTurnResult.replyText);
        return res.status(200).json({ status: 'game_processed', replyText: gameTurnResult.replyText });
      } catch (gErr) {
        console.error('Game response send error:', gErr.message);
      }
    }

    // 3. Check for active predefined schedule (e.g. Gym timing, Birthday event)
    let replyText = "";
    let routingCategory = "COMPLEX";
    let routingIntent = "AI_COMPLEX";

    // 🛑 PROFANITY & ABUSE DETECTION INTERCEPT (Owner-Predefined Reply)
    const isProfanityFilterActive = settings.profanityFilterEnabled ?? true;
    if (isProfanityFilterActive) {
      const profanityResult = detectProfanity(messageText, settings.customProfanityKeywords || []);
      if (profanityResult.hasProfanity) {
        const strikeInfo = handleProfanityStrike(sender, profanityResult.detectedWord, settings);
        console.log(`🛑 [Meta] ABUSE / PROFANITY DETECTED from ${sender} (Word: "${profanityResult.detectedWord}", Strike: ${strikeInfo.strike}, Action: ${strikeInfo.action}). Intercepting.`);
        replyText = strikeInfo.replyText;
        routingCategory = 'PROFANITY';
        routingIntent = strikeInfo.strike === 1 ? 'PROFANITY_FIRST_WARNING' : `PROFANITY_RETALIATION_STRIKE_${strikeInfo.strike}`;
      }
    }

    // 🎨 HUGGING FACE TEXT-TO-IMAGE GENERATION INTERCEPT
    let generatedImageResult = null;
    const isImageGenActive = settings.imageGenerationEnabled ?? true;
    if (!replyText && isImageGenActive) {
      const imagePromptExtraction = extractImagePrompt(messageText);
      if (imagePromptExtraction.isImageRequest && imagePromptExtraction.prompt) {
        console.log(`🎨 [Meta] Image request: "${imagePromptExtraction.prompt}"`);
        try {
          generatedImageResult = await generateHuggingFaceImage(
            imagePromptExtraction.prompt,
            settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell'
          );
          replyText = `🎨 Generated Image for: "${imagePromptExtraction.prompt}"\nModel: ${generatedImageResult.model} (${generatedImageResult.durationSeconds}s)`;
          routingCategory = 'IMAGE_GEN';
          routingIntent = 'TEXT_TO_IMAGE_FLUX';
        } catch (imgErr) {
          console.error('[Meta] Image generation error:', imgErr.message);
          replyText = `Image generation error: ${imgErr.message}`;
        }
      }
    }

    // 📰 REAL-TIME WORLD NEWS INTERCEPT (World News API)
    const isNewsActive = settings.newsEnabled ?? true;
    if (!replyText && isNewsActive) {
      const newsQuery = extractNewsQuery(messageText);
      if (newsQuery.isNewsRequest) {
        console.log(`📰 [Meta] Real-time news request detected! Topic: "${newsQuery.topic || 'Top Headlines'}"`);
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
          }
        } catch (newsErr) {
          console.error('[Meta] Real-time news fetch error:', newsErr.message);
        }
      }
    }

    try {
      if (!replyText) {
        const matchedSchedule = await checkActiveSchedule(new Date(), matchedContact?.relationship, sender);
        if (matchedSchedule) {
          console.log(`📅 Active schedule matched: "${matchedSchedule.title}" -> Using scheduled auto-reply.`);
          replyText = matchedSchedule.autoReplyText;
          routingCategory = "SCHEDULE";
          routingIntent = "SCHEDULED_EVENT";
        }
      }
    } catch (schedErr) {
      console.warn("Schedule check error:", schedErr.message);
    }

    // Message Classification & Routing (Routine vs Complex)
    if (!replyText) {
      try {
        const classification = await classifyMessage(messageText, matchedContact);
        if (classification.category === 'ROUTINE' && classification.templateReply) {
          console.log(`⚡ Routine message identified: [${classification.intentKey}] -> Serving predefined template.`);
          replyText = classification.templateReply;
          routingCategory = 'ROUTINE';
          routingIntent = classification.intentKey;
        } else {
          console.log(`🤖 Complex inquiry identified: [${classification.intentKey}] -> Routing to Gemini AI model.`);
          routingCategory = 'COMPLEX';
          routingIntent = classification.intentKey;
        }
      } catch (routeErr) {
        console.warn("Routing classification error:", routeErr.message);
      }
    }

    // If no active schedule or routine template matched, process with Google Gemini API
    let failResult = null;
    if (!replyText) {
      console.log(`🤖 Generating ${isAutoReplyAll ? 'respectful & peaceful ' : 'polite '}Gemini reply for ${sender}...`);
      try {
        const chatHistory = await getGeminiChatHistory(sender);
        const dynamicPrompt = buildDynamicPersonaPrompt(
          settings.systemPrompt,
          matchedContact,
          sender,
          messageText,
          null,
          isAutoReplyAll
        );
        replyText = await generateGeminiReply(messageText, dynamicPrompt, chatHistory);
        await resetFailedAttempts(sender);
      } catch (geminiErr) {
        console.error("Gemini error:", geminiErr.message);
        failResult = await recordFailedAttempt(sender);
        if (failResult.triggeredHandover) {
          console.log(`🚨 AI failed to resolve query after 3 attempts for ${sender}. Pausing automated responses.`);
          replyText = "I apologize, but I am unable to properly resolve your query. I have notified our live agent team immediately and paused automated replies so a human can step in to assist you.";
        } else {
          await MessageLog.create({
            sender,
            messageIn: messageText,
            messageOut: "",
            status: "ERROR",
            routingCategory,
            routingIntent,
            errorMessage: `Gemini failure (attempt ${failResult.unresolvedAttempts}/3): ${geminiErr.message}`,
            metaMessageId: messageId,
          });
          return res
            .status(200)
            .json({ status: "gemini_error", error: geminiErr.message, unresolvedAttempts: failResult.unresolvedAttempts });
        }
      }
    }

    // 4. Send response back via Meta WhatsApp Cloud API
    try {
      if (generatedImageResult && generatedImageResult.publicUrl) {
        await sendWhatsAppImage(sender, generatedImageResult.publicUrl, replyText);
      } else {
        await sendWhatsAppMessage(sender, replyText);
      }

      // 5. Log processed conversation in MongoDB
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: replyText,
        status: generatedImageResult
          ? 'IMAGE_GENERATED'
          : routingCategory === 'PROFANITY'
          ? 'PROFANITY_BLOCKED'
          : failResult?.triggeredHandover
          ? 'AGENT_HANDOFF_TRIGGERED'
          : 'PROCESSED',
        mediaUrl: generatedImageResult?.publicUrl || null,
        routingCategory,
        routingIntent,
        metaMessageId: messageId,
      });

      // 6. Record to capped ChatSession history & increment message count
      try {
        await recordMessageExchange(sender, messageText, replyText);
      } catch (histErr) {
        console.warn('History record err:', histErr.message);
      }

      // Update message count & check if farewell closing announcement should be triggered
      if (effectiveLimit > 0) {
        const incResult = await incrementSessionMessageCount(sender, effectiveLimit);
        if (incResult.reachedCapNow && incResult.currentCount === effectiveLimit) {
          const closingText = (settings.limitReachedClosingMessage && settings.limitReachedClosingMessage.trim() !== '')
            ? settings.limitReachedClosingMessage.trim()
            : 'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye  AI wasim bot se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much!';

          console.log(`🏁 Sending Auto-Closing Announcement to ${sender}...`);
          setTimeout(async () => {
            try {
              await sendWhatsAppMessage(sender, closingText);
              await MessageLog.create({
                sender,
                messageIn: `[Auto-Cap Limit (${incResult.currentCount}/${effectiveLimit}) Final Trigger]`,
                messageOut: closingText,
                status: 'CAP_CLOSING_SENT',
                metaMessageId: `closing_${Date.now()}`,
              });
              await recordMessageExchange(sender, '[Limit Reached Announcement]', closingText);
            } catch (closeErr) {
              console.warn('Closing message send error:', closeErr.message);
            }
          }, 1500);
        }
      }

      console.log(`✅ Successfully replied to ${sender}`);
      return res.status(200).json({ status: failResult?.triggeredHandover ? 'agent_handoff_triggered' : 'success', replyText });
    } catch (sendErr) {
      console.error("WhatsApp send error:", sendErr.message);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: replyText,
        status: "ERROR",
        errorMessage: `WhatsApp send failure: ${sendErr.message}`,
        metaMessageId: messageId,
      });
      return res
        .status(200)
        .json({ status: "send_error", error: sendErr.message });
    }
  } catch (err) {
    console.error("Webhook processing exception:", err);
    return res.status(200).json({ status: "server_error", error: err.message });
  }
};

module.exports = {
  verifyWebhook,
  handleIncoming,
  handleTwilioWebhook,
  normalizePhoneNumber,
};
