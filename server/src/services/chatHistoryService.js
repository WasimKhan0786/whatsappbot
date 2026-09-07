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

module.exports = {
  DEFAULT_MAX_MESSAGES,
  sanitizeHistoryForGemini,
  getGeminiChatHistory,
  recordMessageExchange,
  clearChatHistory,
  getChatSessionStats,
};
