const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Generate a polite response using Google Gemini API with optional media processing and style mirroring
 * @param {string} userMessage - Text sent by the user
 * @param {string} customSystemPrompt - Optional prompt instructing persona and tone
 * @param {Array} [chatHistory=[]] - Multi-turn conversation history
 * @param {object|null} [mediaPayload=null] - Processed media data (extracted text, style guidance, inline compressed image)
 * @returns {Promise<string>} - Polite AI generated response mirroring original content & style
 */
async function generateGeminiReply(userMessage, customSystemPrompt, chatHistory = [], mediaPayload = null) {
  const apiKey = process.env.GEMINI_API_KEY;

  const defaultPrompt =
    'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\n' +
    'Security Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\n' +
    'Core Conversational & Mirroring Rules:\n' +
    '- Analyze the incoming message for its language, tone, and style, and generate a response that matches them perfectly, ensuring the interaction feels natural and consistent with the user\'s input.\n' +
    '- Language Mirroring: If the user writes in English, reply in natural fluent English. If they write in Hinglish, reply in Hinglish. If in Hindi (Devanagari script) or another language, reply in that exact script/language.\n' +
    '- Tone & Cadence Mirroring: Match the emotional register (casual banter, courteous respect, professional, or empathetic). Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.\n' +
    '- Media File & Document Style Mirroring: When processing user-uploaded images or PDFs, analyze the document format (formal report, tabular data, financial receipt, bullet points, or casual note) and tone. Mirror this exact structure and vocabulary register in your output.\n' +
    '- Provide short, precise, and clear answers to all general knowledge and informational questions, avoiding unnecessary details while ensuring accuracy and clarity.\n' +
    '- Identify the requested shayari category—such as romantic, emotional, or motivational—and generate a fitting shayari based on the user\'s specific choice.\n' +
    '- When the user asks to play a text game or sends \'/game\', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone. When the user sends \'/exit\', immediately stop the game and return to your natural conversational behaviour.\n' +
    '- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".';

  const systemInstruction = customSystemPrompt || defaultPrompt;

  // Build message input parts (text + optional inline compressed image)
  let contentParts = [];
  let userText = userMessage || '';

  if (mediaPayload) {
    let mediaSection = '';
    const fileLabel = mediaPayload.filename || (mediaPayload.mediaType === 'pdf' ? 'PDF Document' : (mediaPayload.mediaType === 'voice' ? 'Voice Note' : 'Attached Media'));

    if (mediaPayload.extractedText && mediaPayload.extractedText.trim() !== '') {
      mediaSection += `\n\n--- [EXTRACTED CONTENT FROM ${fileLabel.toUpperCase()}] ---\n${mediaPayload.extractedText.trim()}\n--- [END OF ${fileLabel.toUpperCase()} CONTENT] ---`;
    }

    let styleDirective = '';
    if (mediaPayload.styleInfo?.styleDirective) {
      styleDirective = `\n\n[STYLE & CONTENT MIRRORING DIRECTIVE]:\n${mediaPayload.styleInfo.styleDirective}\nEnsure your reply directly addresses the contents above and mirrors the style, structure, and language tone of the original file.`;
    }

    const combinedText = `${userText ? userText + '\n' : ''}${mediaSection}${styleDirective}`.trim();
    const defaultActionPrompt = mediaPayload.mediaType === 'voice'
      ? 'The user sent a WhatsApp voice message / audio note. Listen carefully to their spoken words, recognize their language, tone, and question, and respond with a natural, friendly WhatsApp reply matching their language and cadence.'
      : `Please review the attached ${fileLabel}, analyze its content, and respond mirroring its style and tone.`;
    const promptString = combinedText || defaultActionPrompt;

    if (mediaPayload.inlineData) {
      // Multimodal payload: compressed image + prompt text
      contentParts = [
        promptString,
        {
          inlineData: {
            mimeType: mediaPayload.inlineData.mimeType || 'image/jpeg',
            data: mediaPayload.inlineData.data,
          },
        },
      ];
    } else {
      // Token-efficient pure text payload
      contentParts = promptString;
    }
  } else {
    contentParts = userText;
  }

  // Graceful fallback if API key is not yet set by the user
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    console.warn('⚠️ GEMINI_API_KEY is not configured in .env. Returning polite fallback message.');
    return `Hello! Thank you for reaching out. We received your message: "${userText || 'Media File'}". ` +
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
          const result = await chat.sendMessage(contentParts);
          const response = await result.response;
          replyText = response.text();
        } catch (chatErr) {
          console.warn(`[Gemini] Multi-turn chat failed on ${modelName} (${chatErr.message.substring(0, 60)}). Falling back to direct prompt...`);
          // Fallback to direct generateContent
          const result = await model.generateContent(contentParts);
          const response = await result.response;
          replyText = response.text();
        }
      } else {
        // Direct single-turn prompt
        const result = await model.generateContent(contentParts);
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
