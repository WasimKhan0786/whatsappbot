const axios = require('axios');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

/**
 * Executes a Cloudflare Workers AI model inference
 * @param {string} model - Cloudflare Workers AI model identifier
 * @param {object} inputPayload - JSON payload expected by the model
 * @returns {Promise<any>}
 */
async function runWorkersAI(model, inputPayload) {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error('Cloudflare Account ID or API Token not configured');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`;
  const response = await axios.post(url, inputPayload, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  if (response.data && response.data.success && response.data.result) {
    return response.data.result;
  }
  throw new Error(response.data?.errors?.[0]?.message || 'Cloudflare Workers AI unknown response error');
}

/**
 * Generates conversational response using Cloudflare Workers AI (Llama-3.1-8b-instruct)
 * @param {string} userMessage
 * @param {string} systemPrompt
 * @param {Array} [chatHistory=[]]
 * @param {string} [semanticContext='']
 * @returns {Promise<string|null>}
 */
async function generateCloudflareReply(userMessage, systemPrompt = '', chatHistory = [], semanticContext = '') {
  try {
    const messages = [];

    let combinedSystem = systemPrompt || 'You are a helpful, respectful, and natural WhatsApp assistant.';
    if (semanticContext) {
      combinedSystem = `${combinedSystem}\n\n${semanticContext}`;
    }

    messages.push({ role: 'system', content: combinedSystem });

    for (const msg of chatHistory.slice(-6)) {
      if (msg.role === 'user' && msg.parts?.[0]?.text) {
        messages.push({ role: 'user', content: msg.parts[0].text });
      } else if (msg.role === 'model' && msg.parts?.[0]?.text) {
        messages.push({ role: 'assistant', content: msg.parts[0].text });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    const result = await runWorkersAI('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      max_tokens: 256,
      temperature: 0.7,
    });

    return result.response || null;
  } catch (err) {
    console.warn('[Cloudflare Workers AI] Inference error:', err.message);
    return null;
  }
}

/**
 * Summarizes long text using Cloudflare Workers AI
 * @param {string} text - Text to summarize
 * @returns {Promise<string|null>}
 */
async function summarizeTextWithCloudflare(text) {
  try {
    const result = await runWorkersAI('@cf/facebook/bart-large-cnn', {
      input_text: text.substring(0, 4000),
      max_length: 150,
    });
    return result.summary || null;
  } catch (err) {
    console.warn('[Cloudflare Workers AI] Summarization error:', err.message);
    return null;
  }
}

/**
 * Translates text between languages using Cloudflare Workers AI
 * @param {string} text
 * @param {string} targetLang - e.g. 'en', 'hi', 'es'
 * @returns {Promise<string|null>}
 */
async function translateTextWithCloudflare(text, targetLang = 'en') {
  try {
    const result = await runWorkersAI('@cf/meta/m2m100-1.2b', {
      text,
      target_lang: targetLang,
    });
    return result.translated_text || null;
  } catch (err) {
    console.warn('[Cloudflare Workers AI] Translation error:', err.message);
    return null;
  }
}

module.exports = {
  runWorkersAI,
  generateCloudflareReply,
  summarizeTextWithCloudflare,
  translateTextWithCloudflare,
};
