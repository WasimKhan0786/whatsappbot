const ChatSession = require('../models/ChatSession');
const BotSettings = require('../models/BotSettings');

/**
 * Retrieves daily session management settings (strategy: RESET vs ARCHIVE, retention days)
 */
async function getDailySessionConfig() {
  try {
    const settings = await BotSettings.findOne({ key: 'global_settings' }).select('dailySessionStrategy dailyArchiveRetentionDays').lean();
    return {
      strategy: settings?.dailySessionStrategy || 'RESET',
      retentionDays: settings?.dailyArchiveRetentionDays || 3,
    };
  } catch (e) {
    return { strategy: 'RESET', retentionDays: 3 };
  }
}

/**
 * Default maximum number of recent messages preserved per chat session.
 * For example: 20 messages = 10 turns (user prompt + bot reply).
 */
const DEFAULT_MAX_MESSAGES = parseInt(process.env.CHAT_HISTORY_MAX_MESSAGES, 10) || 20;

/**
 * Sanitizes and normalizes messages array to strictly conform to Gemini multi-turn requirements:
 * 1. Role must be 'user' or 'model'.
 * 2. The first message in history must have role: 'user'.
 * 3. Roles must strictly alternate: 'user' -> 'model' -> 'user' -> 'model'.
 * 4. The last message in history must have role: 'model' (since the incoming message will be the next 'user' message).
 *
 * @param {Array} rawMessages - Array of raw message objects from DB
 * @returns {Array} - Sanitized Gemini Content objects
 */
function sanitizeHistoryForGemini(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return [];
  }

  // 1. Normalize into { role, parts: [{ text }] }
  const normalized = [];
  for (const msg of rawMessages) {
    const role = msg.role === 'model' ? 'model' : 'user';
    const text = msg.parts?.[0]?.text || msg.content || msg.text || '';
    if (typeof text === 'string' && text.trim() !== '') {
      normalized.push({
        role,
        parts: [{ text: text.trim() }],
      });
    }
  }

  if (normalized.length === 0) {
    return [];
  }

  // 2. Drop leading 'model' messages if any (Gemini history must start with 'user')
  while (normalized.length > 0 && normalized[0].role !== 'user') {
    normalized.shift();
  }

  if (normalized.length === 0) {
    return [];
  }

  // 3. Ensure strict alternation between 'user' and 'model'
  const alternating = [];
  for (const item of normalized) {
    if (alternating.length === 0) {
      alternating.push(item);
    } else {
      const prev = alternating[alternating.length - 1];
      if (prev.role === item.role) {
        // Append text to previous turn if same role
        prev.parts[0].text += `\n${item.parts[0].text}`;
      } else {
        alternating.push(item);
      }
    }
  }

  // 4. Ensure history ends with 'model' so that the new incoming prompt from the user becomes the next 'user' turn
  while (alternating.length > 0 && alternating[alternating.length - 1].role !== 'model') {
    alternating.pop();
  }

  return alternating;
}

/**
 * Returns today's date string in YYYY-MM-DD format for target timezone (default Asia/Kolkata)
 */
function getTodayDateString(date = new Date()) {
  const timeZone = process.env.TIMEZONE || 'Asia/Kolkata';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns Date object for start of current day (00:00:00.000) in target timezone
 */
function getStartOfToday(date = new Date()) {
  const timeZone = process.env.TIMEZONE || 'Asia/Kolkata';
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(d);

  const partMap = {};
  for (const p of parts) partMap[p.type] = p.value;

  const localMidnightMs =
    (parseInt(partMap.hour || '0', 10) * 3600 +
      parseInt(partMap.minute || '0', 10) * 60 +
      parseInt(partMap.second || '0', 10)) * 1000 +
    d.getMilliseconds();

  return new Date(d.getTime() - localMidnightMs);
}

/**
 * Retrieve sanitized recent chat history for a session formatted for Gemini API.
 * Strictly filters to ONLY include messages from the current active day.
 *
 * @param {string} sessionId - Phone number or unique session identifier
 * @param {number} [limit] - Max number of messages to fetch (default: CHAT_HISTORY_MAX_MESSAGES or 20)
 * @returns {Promise<Array>} - Gemini Content objects
 */
async function getGeminiChatHistory(sessionId, limit = DEFAULT_MAX_MESSAGES) {
  if (!sessionId) {
    return [];
  }

  try {
    const cleanSessionId = String(sessionId).trim();
    const session = await ChatSession.findOne({ sessionId: cleanSessionId });

    if (!session || !session.messages || session.messages.length === 0) {
      return [];
    }

    // Daily Session Filter: strictly only analyze today's active conversation
    const startOfToday = getStartOfToday();
    const todayMessages = session.messages.filter((msg) => {
      const msgTime = msg.timestamp ? new Date(msg.timestamp) : null;
      return msgTime && msgTime >= startOfToday;
    });

    if (todayMessages.length === 0) {
      return [];
    }

    // Take only the last 'limit' messages from today's active turns
    const recentMessages = todayMessages.slice(-limit);
    return sanitizeHistoryForGemini(recentMessages);
  } catch (err) {
    console.warn(`[ChatHistoryService] Error retrieving history for ${sessionId}:`, err.message);
    return [];
  }
}

/**
 * Atomically records a message exchange (user prompt and bot reply) into MongoDB
 * using $slice to strictly cap the number of stored messages per chat session.
 *
 * @param {string} sessionId - Phone number or unique session identifier
 * @param {string} userMessage - Incoming user message
 * @param {string} botReply - Outgoing AI bot reply
 * @param {number} [maxLimit] - Max messages to retain in document (default: CHAT_HISTORY_MAX_MESSAGES or 20)
 * @returns {Promise<object|null>} - Updated ChatSession document
 */
async function recordMessageExchange(sessionId, userMessage, botReply, maxLimit = DEFAULT_MAX_MESSAGES) {
  if (!sessionId) {
    return null;
  }

  try {
    const cleanSessionId = String(sessionId).trim();
    const userText = typeof userMessage === 'string' ? userMessage.trim() : '';
    const botText = typeof botReply === 'string' ? botReply.trim() : '';

    if (!userText && !botText) {
      return null;
    }

    const todayDateStr = getTodayDateString();
    const startOfToday = getStartOfToday();
    const now = new Date();

    const turnsToAdd = [];
    if (userText) {
      turnsToAdd.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: now,
      });
    }
    if (botText) {
      turnsToAdd.push({
        role: 'model',
        parts: [{ text: botText }],
        timestamp: now,
      });
    }

    const maxMessages = !isNaN(maxLimit) && maxLimit > 0 ? maxLimit : DEFAULT_MAX_MESSAGES;

    // Retrieve or initialize session
    let session = await ChatSession.findOne({ sessionId: cleanSessionId });

    if (!session) {
      session = new ChatSession({
        sessionId: cleanSessionId,
        currentSessionDate: todayDateStr,
        messages: turnsToAdd,
        updatedAt: now,
      });
      await session.save();
      return session;
    }

    // Check if session contains messages from a prior day or currentSessionDate has changed
    const isPriorDay = session.currentSessionDate && session.currentSessionDate !== todayDateStr;
    const hasPriorDayMessages = session.messages && session.messages.some((m) => m.timestamp && new Date(m.timestamp) < startOfToday);

    if (isPriorDay || hasPriorDayMessages) {
      const priorDayMsgs = session.messages.filter((m) => !m.timestamp || new Date(m.timestamp) < startOfToday);
      const todayMsgs = session.messages.filter((m) => m.timestamp && new Date(m.timestamp) >= startOfToday);
      const config = await getDailySessionConfig();

      if (config.strategy === 'ARCHIVE' && priorDayMsgs.length > 0) {
        const archiveEntry = {
          date: session.currentSessionDate || 'prior_day',
          messageCount: priorDayMsgs.length,
          messages: priorDayMsgs,
          archivedAt: now,
        };

        if (!session.archivedDailyContexts) session.archivedDailyContexts = [];
        session.archivedDailyContexts.push(archiveEntry);

        // Strictly cap archived daily contexts to prevent MongoDB Atlas free-tier accumulation
        if (session.archivedDailyContexts.length > config.retentionDays) {
          session.archivedDailyContexts = session.archivedDailyContexts.slice(-config.retentionDays);
        }
        console.log(`🌅 [DailySessionManager] Archived ${priorDayMsgs.length} prior day turns for ${cleanSessionId} (Retained max ${config.retentionDays} days).`);
      } else {
        // RESET mode: Purge old context to ensure zero data accumulation and maximum free-tier efficiency
        if (session.archivedDailyContexts && session.archivedDailyContexts.length > 0) {
          session.archivedDailyContexts = [];
        }
        console.log(`🧹 [DailySessionManager] Daily reset: purged prior day context for ${cleanSessionId} (Free-tier zero accumulation mode).`);
      }

      // Reset active conversation array to only today's turns
      session.messages = todayMsgs.concat(turnsToAdd);
      session.currentSessionDate = todayDateStr;
      session.unresolvedAttempts = 0; // Reset unresolved attempts for the new day
    } else {
      // Add turns to today's active conversation
      session.messages = (session.messages || []).concat(turnsToAdd);
      session.currentSessionDate = todayDateStr;
    }

    // Keep active list bounded by maxMessages
    if (session.messages.length > maxMessages) {
      session.messages = session.messages.slice(-maxMessages);
    }

    session.updatedAt = now;
    await session.save();
    return session;
  } catch (err) {
    console.error(`[ChatHistoryService] Error recording exchange for ${sessionId}:`, err.message);
    return null;
  }
}

/**
 * Daily midnight rollover & context archiver/resetter
 * Scans all sessions and clears/archives previous days' conversation context,
 * maintaining database efficiency within MongoDB Atlas free tier limits.
 *
 * @returns {Promise<{ success: boolean, processedCount: number, mode: string, activeDate: string }>}
 */
async function runDailySessionArchiver() {
  const todayDateStr = getTodayDateString();
  const startOfToday = getStartOfToday();
  const now = new Date();
  const config = await getDailySessionConfig();

  console.log(`🌅 [DailySessionManager] Running daily session rollover (Strategy: ${config.strategy}, Active date: ${todayDateStr})...`);

  try {
    const sessions = await ChatSession.find({
      $or: [
        { currentSessionDate: { $ne: todayDateStr }, 'messages.0': { $exists: true } },
        { 'messages.timestamp': { $lt: startOfToday } },
      ],
    });

    let processedCount = 0;

    for (const session of sessions) {
      const priorDayMsgs = (session.messages || []).filter((m) => !m.timestamp || new Date(m.timestamp) < startOfToday);
      const todayMsgs = (session.messages || []).filter((m) => m.timestamp && new Date(m.timestamp) >= startOfToday);

      if (priorDayMsgs.length > 0 || session.currentSessionDate !== todayDateStr) {
        if (config.strategy === 'ARCHIVE' && priorDayMsgs.length > 0) {
          const archiveEntry = {
            date: session.currentSessionDate || 'prior_day',
            messageCount: priorDayMsgs.length,
            messages: priorDayMsgs,
            archivedAt: now,
          };

          if (!session.archivedDailyContexts) session.archivedDailyContexts = [];
          session.archivedDailyContexts.push(archiveEntry);
          if (session.archivedDailyContexts.length > config.retentionDays) {
            session.archivedDailyContexts = session.archivedDailyContexts.slice(-config.retentionDays);
          }
        } else {
          // RESET mode: empty archived contexts to maintain minimal storage footprint
          session.archivedDailyContexts = [];
        }

        session.messages = todayMsgs;
        session.currentSessionDate = todayDateStr;
        session.unresolvedAttempts = 0;
        session.updatedAt = now;
        await session.save();
        processedCount++;
      }
    }

    console.log(`🌅 [DailySessionManager] Daily rollover finished: ${processedCount} sessions updated via ${config.strategy} mode, active context fresh for ${todayDateStr}.`);
    return { success: true, processedCount, mode: config.strategy, activeDate: todayDateStr };
  } catch (err) {
    console.error('[DailySessionManager] Error running daily session archiver:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Clears or resets the chat session history for a given sessionId
 *
 * @param {string} sessionId - Phone number or unique session identifier
 * @returns {Promise<boolean>}
 */
async function clearChatHistory(sessionId) {
  if (!sessionId) return false;
  try {
    const cleanSessionId = String(sessionId).trim();
    await ChatSession.deleteOne({ sessionId: cleanSessionId });
    return true;
  } catch (err) {
    console.error(`[ChatHistoryService] Error clearing history for ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * Retrieve session metadata and message stats
 *
 * @param {string} sessionId - Phone number or unique session identifier
 * @returns {Promise<object|null>}
 */
async function getChatSessionStats(sessionId) {
  if (!sessionId) return null;
  try {
    const cleanSessionId = String(sessionId).trim();
    const session = await ChatSession.findOne({ sessionId: cleanSessionId });
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      messageCount: session.messages?.length || 0,
      updatedAt: session.updatedAt,
      messages: session.messages || [],
    };
  } catch (err) {
    console.error(`[ChatHistoryService] Error fetching stats for ${sessionId}:`, err.message);
    return null;
  }
}

/**
 * Checks if incoming text requests a live agent or real human
 * @param {string} text - User message
 * @returns {boolean}
 */
function detectAgentKeyword(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();
  const pattern = /\b(agent|human|live\s*agent|real\s*human|real\s*person|human\s*agent|support\s*agent|talk\s*to\s*human|connect\s*to\s*agent|customer\s*care|executive)\b/i;
  return pattern.test(clean);
}

/**
 * Check if automated responses are paused for this session due to live agent handover
 * @param {string} sessionId - Phone number or session ID
 * @returns {Promise<boolean>}
 */
async function isSessionHandedOff(sessionId) {
  if (!sessionId) return false;
  try {
    const cleanSessionId = String(sessionId).trim();
    const session = await ChatSession.findOne({ sessionId: cleanSessionId });
    return Boolean(session && session.isHandedOff === true);
  } catch (err) {
    console.error(`[ChatHistoryService] Error checking handoff status for ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * Activates live agent handover for a chat session, immediately pausing automated replies
 * @param {string} sessionId - Phone number or session ID
 * @param {string} reason - 'KEYWORD_AGENT' | 'KEYWORD_HUMAN' | 'MAX_FAILED_ATTEMPTS'
 * @returns {Promise<object|null>}
 */
async function activateHandover(sessionId, reason = 'KEYWORD_AGENT') {
  if (!sessionId) return null;
  try {
    const cleanSessionId = String(sessionId).trim();
    console.log(`🚨 [LiveAgentHandover] Pausing automated replies for ${cleanSessionId} (Reason: ${reason})`);

    const updated = await ChatSession.findOneAndUpdate(
      { sessionId: cleanSessionId },
      {
        $set: {
          isHandedOff: true,
          handedOffAt: new Date(),
          handoverReason: reason,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return updated;
  } catch (err) {
    console.error(`[ChatHistoryService] Error activating handover for ${sessionId}:`, err.message);
    return null;
  }
}

/**
 * Records a failed/unresolved query attempt.
 * If consecutive unresolved attempts reach 3, automatically triggers live agent handover.
 * @param {string} sessionId - Phone number or session ID
 * @returns {Promise<{ triggeredHandover: boolean, attempts: number }>}
 */
async function recordFailedAttempt(sessionId) {
  if (!sessionId) return { triggeredHandover: false, attempts: 0, unresolvedAttempts: 0 };
  try {
    const cleanSessionId = String(sessionId).trim();
    const session = await ChatSession.findOne({ sessionId: cleanSessionId });
    const currentAttempts = (session?.unresolvedAttempts || 0) + 1;

    if (currentAttempts >= 3) {
      await ChatSession.updateOne(
        { sessionId: cleanSessionId },
        {
          $set: {
            unresolvedAttempts: currentAttempts,
            isHandedOff: true,
            handedOffAt: new Date(),
            handoverReason: 'MAX_FAILED_ATTEMPTS',
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      console.log(`🚨 [LiveAgentHandover] Pausing automated replies for ${cleanSessionId} (Reason: MAX_FAILED_ATTEMPTS)`);
      return { triggeredHandover: true, attempts: currentAttempts, unresolvedAttempts: currentAttempts };
    }

    await ChatSession.updateOne(
      { sessionId: cleanSessionId },
      { $set: { unresolvedAttempts: currentAttempts, updatedAt: new Date() } },
      { upsert: true }
    );

    return { triggeredHandover: false, attempts: currentAttempts, unresolvedAttempts: currentAttempts };
  } catch (err) {
    console.error(`[ChatHistoryService] Error recording failed attempt for ${sessionId}:`, err.message);
    return { triggeredHandover: false, attempts: 0, unresolvedAttempts: 0 };
  }
}

/**
 * Resets the failed attempts counter to 0 upon a clean, successful interaction
 * @param {string} sessionId - Phone number or session ID
 */
async function resetFailedAttempts(sessionId) {
  if (!sessionId) return;
  try {
    const cleanSessionId = String(sessionId).trim();
    await ChatSession.updateOne(
      { sessionId: cleanSessionId },
      { $set: { unresolvedAttempts: 0 } }
    );
  } catch (err) {
    // Non-fatal
  }
}

/**
 * Resumes automated AI responses for a paused chat session
 * @param {string} sessionId - Phone number or session ID
 * @returns {Promise<object|null>}
 */
async function resumeSession(sessionId) {
  if (!sessionId) return null;
  try {
    const cleanSessionId = String(sessionId).trim();
    const updated = await ChatSession.findOneAndUpdate(
      { sessionId: cleanSessionId },
      {
        $set: {
          isHandedOff: false,
          handedOffAt: null,
          handoverReason: null,
          unresolvedAttempts: 0,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
    console.log(`▶️ [LiveAgentHandover] Resumed automated AI responses for ${cleanSessionId}`);
    return updated || { sessionId: cleanSessionId, isHandedOff: false, unresolvedAttempts: 0 };
  } catch (err) {
    console.error(`[ChatHistoryService] Error resuming session for ${sessionId}:`, err.message);
    return null;
  }
}

/**
 * Returns all chat sessions currently paused for a live agent
 * @returns {Promise<Array>}
 */
async function getActiveHandoffs() {
  try {
    const sessions = await ChatSession.find({ isHandedOff: true }).sort({ handedOffAt: -1 });
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      handedOffAt: s.handedOffAt,
      handoverReason: s.handoverReason,
      unresolvedAttempts: s.unresolvedAttempts,
      updatedAt: s.updatedAt,
      lastMessage: s.messages?.[s.messages.length - 1]?.parts?.[0]?.text || '',
    }));
  } catch (err) {
    console.error('[ChatHistoryService] Error fetching active handoffs:', err.message);
    return [];
  }
}

/**
 * Gets or initializes message count for a session
 * @param {string} sessionId
 * @returns {Promise<{ messagesSentCount: number, isCapReached: boolean, isFarewellSent: boolean }>}
 */
async function getSessionMessageCount(sessionId) {
  const cleanSessionId = sessionId.trim();
  try {
    const session = await ChatSession.findOne({ sessionId: cleanSessionId });
    return {
      messagesSentCount: session?.messagesSentCount || 0,
      isCapReached: session?.isCapReached || false,
      isFarewellSent: session?.isFarewellSent || false,
    };
  } catch (err) {
    return { messagesSentCount: 0, isCapReached: false, isFarewellSent: false };
  }
}

/**
 * Increments messages sent count for a session and checks if limit reached
 * @param {string} sessionId
 * @param {number} effectiveLimit
 * @returns {Promise<{ currentCount: number, reachedCapNow: boolean, isFarewellSent: boolean }>}
 */
async function incrementSessionMessageCount(sessionId, effectiveLimit = 0) {
  const cleanSessionId = sessionId.trim();
  try {
    let session = await ChatSession.findOne({ sessionId: cleanSessionId });
    if (!session) {
      session = new ChatSession({ sessionId: cleanSessionId });
    }
    session.messagesSentCount = (session.messagesSentCount || 0) + 1;
    const reachedCapNow = effectiveLimit > 0 && session.messagesSentCount >= effectiveLimit;
    if (reachedCapNow) {
      session.isCapReached = true;
      if (!session.capReachedAt) {
        session.capReachedAt = new Date();
      }
    }
    session.updatedAt = new Date();
    await session.save();
    return {
      currentCount: session.messagesSentCount,
      reachedCapNow,
      isFarewellSent: Boolean(session.isFarewellSent),
    };
  } catch (err) {
    console.warn(`[ChatHistoryService] Error updating session count for ${sessionId}:`, err.message);
    return { currentCount: 1, reachedCapNow: false, isFarewellSent: false };
  }
}

/**
 * Resolves the configured farewell message:
 * 1. Contact-specific customClosingMessage (if configured)
 * 2. Settings limitReachedClosingMessage (if configured)
 * 3. Default farewell message
 */
function resolveFarewellClosingMessage(matchedContact, settings = {}) {
  if (matchedContact?.customClosingMessage && matchedContact.customClosingMessage.trim() !== '') {
    return matchedContact.customClosingMessage.trim();
  }
  if (settings?.limitReachedClosingMessage && settings.limitReachedClosingMessage.trim() !== '') {
    return settings.limitReachedClosingMessage.trim();
  }
  return 'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye  AI wasim bot se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much!';
}

/**
 * Retrieves per-contact message count, cap limit, and farewell status
 * @param {string} contactPhone
 * @param {object|null} matchedContact
 * @param {object} settings
 * @returns {Promise<{ effectiveLimit: number, currentCount: number, isCapReached: boolean, isFarewellSent: boolean }>}
 */
async function getContactMessageCountInfo(contactPhone, matchedContact = null, settings = {}) {
  const cleanPhone = (contactPhone || '').trim();
  const effectiveLimit = matchedContact && typeof matchedContact.maxMessageLimit === 'number' && matchedContact.maxMessageLimit > 0
    ? matchedContact.maxMessageLimit
    : (settings?.defaultMaxMessagesPerContact || 0);

  let currentCount = 0;
  let isFarewellSent = false;
  let isCapReached = false;

  if (matchedContact) {
    currentCount = matchedContact.messagesSentCount || 0;
    isFarewellSent = Boolean(matchedContact.isFarewellSent);
    isCapReached = Boolean(matchedContact.isCapReached) || (effectiveLimit > 0 && currentCount >= effectiveLimit);
  } else if (cleanPhone) {
    try {
      const session = await ChatSession.findOne({ sessionId: cleanPhone });
      currentCount = session?.messagesSentCount || 0;
      isFarewellSent = Boolean(session?.isFarewellSent);
      isCapReached = Boolean(session?.isCapReached) || (effectiveLimit > 0 && currentCount >= effectiveLimit);
    } catch (e) {
      // ignore
    }
  }

  return {
    effectiveLimit,
    currentCount,
    isCapReached,
    isFarewellSent,
  };
}

/**
 * Increments the message count for this contact separately and checks if cap is reached
 * @param {string} contactPhone
 * @param {object|null} matchedContact
 * @param {number} effectiveLimit
 * @returns {Promise<{ currentCount: number, reachedCapNow: boolean, isFarewellSent: boolean }>}
 */
async function incrementContactMessageCount(contactPhone, matchedContact = null, effectiveLimit = 0) {
  const cleanPhone = (contactPhone || '').trim();
  let currentCount = 0;
  let reachedCapNow = false;
  let isFarewellSent = false;

  if (matchedContact) {
    matchedContact.messagesSentCount = (matchedContact.messagesSentCount || 0) + 1;
    currentCount = matchedContact.messagesSentCount;
    reachedCapNow = effectiveLimit > 0 && currentCount >= effectiveLimit;
    if (reachedCapNow) {
      matchedContact.isCapReached = true;
      if (!matchedContact.capReachedAt) matchedContact.capReachedAt = new Date();
    }
    isFarewellSent = Boolean(matchedContact.isFarewellSent);
    try {
      await matchedContact.save();
    } catch (e) {
      console.warn(`[ChatHistoryService] Error saving contact count for ${cleanPhone}:`, e.message);
    }
    // Also sync to ChatSession so history session stays consistent
    if (cleanPhone) {
      try {
        await ChatSession.findOneAndUpdate(
          { sessionId: cleanPhone },
          {
            $set: {
              messagesSentCount: currentCount,
              isCapReached: Boolean(matchedContact.isCapReached),
              capReachedAt: matchedContact.capReachedAt || (reachedCapNow ? new Date() : null),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      } catch (sessSyncErr) {}
    }
  } else if (cleanPhone) {
    const incResult = await incrementSessionMessageCount(cleanPhone, effectiveLimit);
    currentCount = incResult.currentCount;
    reachedCapNow = incResult.reachedCapNow;
    isFarewellSent = Boolean(incResult.isFarewellSent);
  }

  return {
    currentCount,
    reachedCapNow,
    isFarewellSent,
  };
}

/**
 * Marks that the farewell closing announcement has been delivered to this contact
 * @param {string} contactPhone
 * @param {object|null} matchedContact
 */
async function markContactFarewellSent(contactPhone, matchedContact = null) {
  const cleanPhone = (contactPhone || '').trim();
  const now = new Date();
  if (matchedContact) {
    matchedContact.isFarewellSent = true;
    matchedContact.isCapReached = true;
    if (!matchedContact.capReachedAt) matchedContact.capReachedAt = now;
    try {
      await matchedContact.save();
    } catch (e) {}
  }
  if (cleanPhone) {
    try {
      await ChatSession.updateOne(
        { sessionId: cleanPhone },
        {
          $set: {
            isFarewellSent: true,
            isCapReached: true,
            capReachedAt: now,
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    } catch (e) {}
  }
}

module.exports = {
  DEFAULT_MAX_MESSAGES,
  sanitizeHistoryForGemini,
  getGeminiChatHistory,
  recordMessageExchange,
  clearChatHistory,
  getChatSessionStats,
  detectAgentKeyword,
  isSessionHandedOff,
  activateHandover,
  recordFailedAttempt,
  resetFailedAttempts,
  resumeSession,
  getActiveHandoffs,
  getSessionMessageCount,
  incrementSessionMessageCount,
  getContactMessageCountInfo,
  incrementContactMessageCount,
  markContactFarewellSent,
  resolveFarewellClosingMessage,
  getTodayDateString,
  getStartOfToday,
  runDailySessionArchiver,
};


