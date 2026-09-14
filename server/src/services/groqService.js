const Groq = require('groq-sdk');

let keyPool = [];
let currentKeyIndex = 0;
const clientCache = new Map();

/**
 * Loads and refreshes the pool of Groq API keys
 * @returns {string[]}
 */
function getGroqKeyPool() {
  const rawPool = process.env.GROQ_KEYS || '';
  const singleKey = process.env.GROQ_API_KEY || '';

  const keys = [
    ...rawPool.split(/[,;\n\s]+/),
    singleKey,
  ]
    .map((k) => k.trim())
    .filter((k) => k.length > 10 && !k.includes('your_'));

  // Deduplicate keys
  return [...new Set(keys)];
}

function getGroqClient(key) {
  if (!clientCache.has(key)) {
    clientCache.set(key, new Groq({ apiKey: key }));
  }
  return clientCache.get(key);
}

function isGroqAvailable() {
  return getGroqKeyPool().length > 0;
}

/**
 * Generates ultra-fast conversational reply using Groq with automatic multi-key failover
 * @param {string} userMessage - User's input text
 * @param {string} systemPrompt - Persona / style system instruction
 * @param {Array} [chatHistory=[]] - Multi-turn conversation history
 * @param {string} [semanticContext=''] - Pinecone vector retrieval memory
 * @returns {Promise<string|null>}
 */
async function generateGroqReply(userMessage, systemPrompt = '', chatHistory = [], semanticContext = '') {
  const pool = getGroqKeyPool();
  if (pool.length === 0) {
    return null;
  }

  const messages = [];
  let combinedSystem = systemPrompt || 'You are a natural, fast, and helpful WhatsApp assistant.';
  if (semanticContext && semanticContext.trim() !== '') {
    combinedSystem = `${combinedSystem}\n\n${semanticContext.trim()}`;
  }

  messages.push({ role: 'system', content: combinedSystem });

  // Format previous turns for Groq
  if (Array.isArray(chatHistory)) {
    for (const turn of chatHistory.slice(-8)) {
      if (turn.role === 'user' && turn.parts?.[0]?.text) {
        messages.push({ role: 'user', content: turn.parts[0].text });
      } else if (turn.role === 'model' && turn.parts?.[0]?.text) {
        messages.push({ role: 'assistant', content: turn.parts[0].text });
      }
    }
  }

  messages.push({ role: 'user', content: userMessage });

  const candidateModels = [
    process.env.GROQ_MODEL,
    'openai/gpt-oss-20b',
    'groq/compound-mini',
    'groq/compound',
    'qwen/qwen3.6-27b',
  ].filter(Boolean);

  // Attempt generation across available keys and models
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const keyIndex = (currentKeyIndex + attempt) % pool.length;
    const activeKey = pool[keyIndex];
    const client = getGroqClient(activeKey);

    for (const modelName of candidateModels) {
      try {
        const completion = await client.chat.completions.create({
          model: modelName,
          messages,
          temperature: 0.7,
          max_tokens: 350,
        });

        const reply = completion.choices?.[0]?.message?.content || null;
        if (reply) {
          currentKeyIndex = keyIndex; // Remember healthy key
          console.log(`[Groq] ⚡ Fast routine reply generated via Groq [Model: ${modelName}] (Key #${keyIndex + 1} of ${pool.length})`);
          return reply;
        }
      } catch (err) {
        const isRateLimit = err.status === 429 || (err.message && err.message.includes('rate_limit'));
        if (isRateLimit) {
          console.warn(`[Groq] Key #${keyIndex + 1} rate limited. Rotating to next key...`);
          break; // Break model loop to rotate key immediately
        }
        // If 404 model not found, try next candidate model
        continue;
      }
    }
  }

  return null;
}

module.exports = {
  isGroqAvailable,
  generateGroqReply,
};
