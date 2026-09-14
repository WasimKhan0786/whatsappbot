const Groq = require('groq-sdk');

let groqClientInstance = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_groq_api_key')) {
    return null;
  }
  if (!groqClientInstance) {
    groqClientInstance = new Groq({ apiKey: apiKey.trim() });
  }
  return groqClientInstance;
}

function isGroqAvailable() {
  return Boolean(getGroqClient());
}

/**
 * Generates ultra-fast conversational reply using Groq (Llama-3.1-8b-instant)
 * @param {string} userMessage - User's input text
 * @param {string} systemPrompt - Persona / style system instruction
 * @param {Array} [chatHistory=[]] - Multi-turn conversation history
 * @param {string} [semanticContext=''] - Pinecone vector retrieval memory
 * @returns {Promise<string|null>}
 */
async function generateGroqReply(userMessage, systemPrompt = '', chatHistory = [], semanticContext = '') {
  const client = getGroqClient();
  if (!client) {
    return null;
  }

  try {
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

    const primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    let completion = null;

    try {
      completion = await client.chat.completions.create({
        model: primaryModel,
        messages,
        temperature: 0.7,
        max_tokens: 300,
      });
    } catch (modelErr) {
      console.warn(`[Groq] Primary model (${primaryModel}) failed: ${modelErr.message}. Trying groq/compound-mini fallback...`);
      completion = await client.chat.completions.create({
        model: 'groq/compound-mini',
        messages,
        temperature: 0.7,
        max_tokens: 300,
      });
    }

    const reply = completion.choices?.[0]?.message?.content || null;
    if (reply) {
      console.log(`[Groq] ⚡ Fast routine reply generated successfully via Groq`);
    }
    return reply;
  } catch (err) {
    console.warn('[Groq] Generation warning:', err.message);
    return null;
  }
}

module.exports = {
  getGroqClient,
  isGroqAvailable,
  generateGroqReply,
};
