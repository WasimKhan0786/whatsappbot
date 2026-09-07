const ChatSession = require('../models/ChatSession');

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
 * Retrieve sanitized recent chat history for a session formatted for Gemini API.
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

    // Take only the last 'limit' messages
    const recentMessages = session.messages.slice(-limit);
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

    const turnsToAdd = [];
    if (userText) {
      turnsToAdd.push({
        role: 'user',
        parts: [{ text: userText }],
        timestamp: new Date(),
      });
    }
    if (botText) {
      turnsToAdd.push({
        role: 'model',
        parts: [{ text: botText }],
        timestamp: new Date(),
      });
    }

    const maxMessages = !isNaN(maxLimit) && maxLimit > 0 ? maxLimit : DEFAULT_MAX_MESSAGES;

    // MongoDB atomic update with $push and negative $slice to keep only the most recent N items
    const updated = await ChatSession.findOneAndUpdate(
      { sessionId: cleanSessionId },
      {
        $push: {
          messages: {
            $each: turnsToAdd,
            $slice: -maxMessages,
          },
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    return updated;
  } catch (err) {
    console.error(`[ChatHistoryService] Error recording exchange for ${sessionId}:`, err.message);
    return null;
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
};

