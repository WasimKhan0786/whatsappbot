const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let pineconeClientInstance = null;
let pineconeIndexInstance = null;

const DEFAULT_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'whatsapp-bot-memory';
const DEFAULT_NAMESPACE = process.env.PINECONE_NAMESPACE || 'whatsapp-chats';

/**
 * Initializes and returns singleton Pinecone client
 */
function getPineconeClient() {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_pinecone_api_key')) {
    return null;
  }
  if (!pineconeClientInstance) {
    pineconeClientInstance = new Pinecone({ apiKey: apiKey.trim() });
  }
  return pineconeClientInstance;
}

/**
 * Returns the configured Pinecone Index
 */
function getPineconeIndex() {
  const client = getPineconeClient();
  if (!client) return null;
  if (!pineconeIndexInstance) {
    pineconeIndexInstance = client.index(DEFAULT_INDEX_NAME);
  }
  return pineconeIndexInstance;
}

/**
 * Generates a 768-dimensional dense vector embedding using Google Gemini API
 * @param {string} text - Message or conversation snippet to embed
 * @returns {Promise<number[]|null>} - 768-dim float array
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return null;
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn('[Pinecone] Cannot generate embedding: GEMINI_API_KEY is not configured.');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey.trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const response = await model.embedContent({
      content: { parts: [{ text: text.trim().substring(0, 2048) }] },
      outputDimensionality: 768,
    });
    return response.embedding.values;
  } catch (err) {
    console.warn('[Pinecone] Embedding generation error:', err.message);
    return null;
  }
}

/**
 * Normalizes phone number digits for deterministic Pinecone metadata filtering
 * @param {string} phone
 * @returns {string}
 */
function normalizeSenderKey(phone) {
  if (!phone) return 'anonymous';
  const clean = String(phone).replace(/\D/g, '');
  return clean || String(phone).trim();
}

/**
 * Stores a conversation exchange (User Message + Bot Reply) as a vector in Pinecone
 * @param {string} senderPhone - Sender identifier/phone number
 * @param {string} userMessage - Message sent by the user
 * @param {string} botReply - Response sent by the bot
 * @param {object} [extraMetadata={}] - Optional additional metadata
 * @returns {Promise<boolean>}
 */
async function storeConversationVector(senderPhone, userMessage, botReply, extraMetadata = {}) {
  const index = getPineconeIndex();
  if (!index) {
    return false;
  }

  if (!userMessage && !botReply) {
    return false;
  }

  const cleanSender = normalizeSenderKey(senderPhone);
  const textToEmbed = `User: ${userMessage || ''}\nAssistant: ${botReply || ''}`.trim();

  try {
    const vectorValues = await generateEmbedding(textToEmbed);
    if (!vectorValues || vectorValues.length !== 768) {
      console.warn('[Pinecone] Failed to generate 768-dim embedding for message storage.');
      return false;
    }

    const vectorId = `msg_${cleanSender}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id: vectorId,
      values: vectorValues,
      metadata: {
        sender: cleanSender,
        rawSender: String(senderPhone || ''),
        userMessage: String(userMessage || '').substring(0, 1000),
        botReply: String(botReply || '').substring(0, 1000),
        timestamp: Date.now(),
        isoDate: new Date().toISOString(),
        ...extraMetadata,
      },
    };

    const targetNamespace = index.namespace(DEFAULT_NAMESPACE);
    await targetNamespace.upsert({ records: [record] });
    console.log(`[Pinecone] 🌲 Stored conversation vector for ${senderPhone} (ID: ${vectorId})`);
    return true;
  } catch (err) {
    console.warn(`[Pinecone] Upsert error for ${senderPhone}:`, err.message);
    return false;
  }
}

/**
 * Queries Pinecone for relevant past interactions for this user based on their incoming message
 * @param {string} senderPhone - User's phone number
 * @param {string} incomingMessage - New incoming message text
 * @param {number} [topK=3] - Maximum number of relevant interactions to retrieve
 * @param {number} [minScore=0.60] - Minimum cosine similarity threshold
 * @returns {Promise<Array<{ userMessage: string, botReply: string, score: number, timestamp: number }>>}
 */
async function queryRelevantHistory(senderPhone, incomingMessage, topK = 3, minScore = 0.60) {
  const index = getPineconeIndex();
  if (!index) {
    return [];
  }

  if (!incomingMessage || typeof incomingMessage !== 'string' || incomingMessage.trim() === '') {
    return [];
  }

  const cleanSender = normalizeSenderKey(senderPhone);

  try {
    const queryVector = await generateEmbedding(incomingMessage);
    if (!queryVector || queryVector.length !== 768) {
      return [];
    }

    const targetNamespace = index.namespace(DEFAULT_NAMESPACE);
    const queryResult = await targetNamespace.query({
      vector: queryVector,
      topK: Math.max(1, topK),
      includeMetadata: true,
      filter: {
        sender: { $eq: cleanSender },
      },
    });

    if (!queryResult || !Array.isArray(queryResult.matches)) {
      return [];
    }

    const matches = queryResult.matches
      .filter((m) => (m.score || 0) >= minScore && m.metadata)
      .map((m) => ({
        userMessage: m.metadata.userMessage || '',
        botReply: m.metadata.botReply || '',
        score: Math.round((m.score || 0) * 100) / 100,
        timestamp: m.metadata.timestamp || 0,
      }))
      .filter((m) => m.userMessage || m.botReply);

    if (matches.length > 0) {
      console.log(`[Pinecone] 🧠 Retrieved ${matches.length} semantic past interactions for ${senderPhone} (Top score: ${matches[0].score})`);
    }

    return matches;
  } catch (err) {
    console.warn(`[Pinecone] Query error for ${senderPhone}:`, err.message);
    return [];
  }
}

/**
 * Formats retrieved Pinecone past interactions into a context block for Gemini system prompt
 * @param {Array<{ userMessage: string, botReply: string, score: number }>} matches
 * @returns {string}
 */
function formatSemanticContextForPrompt(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return '';
  }

  const items = matches.map((m, idx) => {
    const scorePct = Math.round(m.score * 100);
    return `[Past Context Item ${idx + 1} (${scorePct}% relevant)]:
User previously said: "${m.userMessage}"
You previously replied: "${m.botReply}"`;
  });

  return `
======================================================
RELEVANT PAST CONVERSATION MEMORY (PINECONE VECTOR RETRIEVAL):
The following relevant interactions were retrieved from this user's long-term chat history.
Use this background context naturally to maintain seamless conversation continuity and recall past topics, agreements, or preferences if relevant to their new message.

${items.join('\n\n')}
======================================================
`;
}

module.exports = {
  getPineconeClient,
  getPineconeIndex,
  generateEmbedding,
  storeConversationVector,
  queryRelevantHistory,
  formatSemanticContextForPrompt,
  DEFAULT_INDEX_NAME,
  DEFAULT_NAMESPACE,
};
