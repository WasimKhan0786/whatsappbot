const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Generate a polite response using Google Gemini API
 * @param {string} userMessage - Text sent by the user
 * @param {string} customSystemPrompt - Optional prompt instructing persona and tone
 * @returns {Promise<string>} - Polite AI generated response
 */
async function generateGeminiReply(userMessage, customSystemPrompt, chatHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  const defaultPrompt =
    'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\n' +
    'Security Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\n' +
    'Guidelines:\n' +
    '- Natural, friendly aur polite desi chat style (Hinglish me) baat karo.\n' +
    '- Words use karo: "haanji", "bhai", "bolo", "boliye", "aap boliye", "arre", "theek hai".\n' +
    '- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".\n' +
    '- Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.';

  const systemInstruction = customSystemPrompt || defaultPrompt;

  // Graceful fallback if API key is not yet set by the user
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    console.warn('⚠️ GEMINI_API_KEY is not configured in .env. Returning polite fallback message.');
    return `Hello! Thank you for reaching out. We received your message: "${userMessage}". ` +
      `(Note: Google Gemini API key is not yet configured in server .env file. Please add your GEMINI_API_KEY to enable live AI replies).`;
  }

  const CANDIDATE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction,
      });

      let replyText = '';

      // If multi-turn chat history is provided, start a contextual chat session
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        try {
          const chat = model.startChat({
            history: chatHistory,
          });
          const result = await chat.sendMessage(userMessage);
          const response = await result.response;
          replyText = response.text();
        } catch (chatErr) {
          console.warn(`[Gemini] Multi-turn chat failed on ${modelName} (${chatErr.message.substring(0, 60)}). Falling back to direct prompt...`);
          // Fallback to direct generateContent if history format triggered an issue
          const result = await model.generateContent(userMessage);
          const response = await result.response;
          replyText = response.text();
        }
      } else {
        // Direct single-turn prompt
        const result = await model.generateContent(userMessage);
        const response = await result.response;
        replyText = response.text();
      }

      if (replyText && replyText.trim() !== '') {
        return replyText.trim();
      }
    } catch (error) {
      console.warn(`[Gemini] Model ${modelName} encountered: ${error.message.substring(0, 90)}. Trying next candidate model...`);
      lastError = error;
      continue;
    }
  }

  console.error('All Gemini candidate models exhausted. Last error:', lastError?.message);
  throw new Error(`Gemini AI service error: ${lastError?.message}`);
}

module.exports = {
  generateGeminiReply,
};
