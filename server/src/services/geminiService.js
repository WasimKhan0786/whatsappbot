const { GoogleGenerativeAI } = require('@google/generative-ai');

let currentGeminiKeyIndex = 0;

function getGeminiKeyPool() {
  const rawPool = process.env.GEMINI_KEYS || '';
  const singleKey = process.env.GEMINI_API_KEY || '';

  const keys = [
    ...rawPool.split(/[,;\n\s]+/),
    singleKey,
  ]
    .map((k) => k.trim())
    .filter((k) => k.length > 10 && !k.includes('your_') && !k.includes('YOUR_'));

  return [...new Set(keys)];
}

/**
 * Generate a polite response using Google Gemini API with optional media processing and style mirroring
 * @param {string} userMessage - Text sent by the user
 * @param {string} customSystemPrompt - Optional prompt instructing persona and tone
 * @param {Array} [chatHistory=[]] - Multi-turn conversation history
 * @param {object|null} [mediaPayload=null] - Processed media data (extracted text, style guidance, inline compressed image)
 * @param {string} [semanticContext=''] - Relevant long-term past conversation memory from Pinecone vector search
 * @returns {Promise<string>} - Polite AI generated response mirroring original content & style
 */
async function generateGeminiReply(userMessage, customSystemPrompt, chatHistory = [], mediaPayload = null, semanticContext = '') {
  const keyPool = getGeminiKeyPool();

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
    '- Daily Session Context Prioritization: Prioritize the current day\'s chat context. If no relevant information is found in the daily session to address an incoming message, analyze the message independently and generate an appropriate, context-aware reply.\n' +
    '- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".';

  let systemInstruction = customSystemPrompt || defaultPrompt;
  if (semanticContext && typeof semanticContext === 'string' && semanticContext.trim() !== '') {
    systemInstruction = `${systemInstruction}\n\n${semanticContext.trim()}`;
  }

  // Build message input parts (text + optional inline compressed image)
  let contentParts = [];
  let userText = userMessage || '';

  if (mediaPayload) {
    let mediaSection = '';
    const fileLabel = mediaPayload.filename || (mediaPayload.mediaType === 'pdf' ? 'PDF Document' : (mediaPayload.mediaType === 'voice' ? 'Voice Note' : 'Attached Media'));

    if (mediaPayload.extractedText && mediaPayload.extractedText.trim() !== '') {
      mediaSection = `--- [EXTRACTED CONTENT FROM ${fileLabel.toUpperCase()}] ---\n${mediaPayload.extractedText.trim()}\n--- [END OF ${fileLabel.toUpperCase()} CONTENT] ---`;
    }

    let styleDirective = '';
    if (mediaPayload.styleInfo?.styleDirective) {
      styleDirective = `[STYLE & CONTENT MIRRORING DIRECTIVE]:\n${mediaPayload.styleInfo.styleDirective}\nEnsure your reply directly addresses the contents above and mirrors the style, structure, and language tone of the original file.`;
    }

    const isPlaceholderText = !userText || userText.trim() === '' || userText === '[Sent Image]' || userText.startsWith('[Sent ');

    let actionPrompt = '';
    if (mediaPayload.mediaType === 'image') {
      if (isPlaceholderText) {
        actionPrompt = 'The user sent an image / photo. Look closely at the visual content of this image, understand what is shown (objects, people, scenery, text, actions, colors, or meme), and respond with a natural, engaging WhatsApp reaction or commentary in your designated persona and language tone.';
      } else {
        actionPrompt = `The user sent an image with the message: "${userText}". Look at the attached image carefully, analyze what is shown, and answer their message/question while commenting naturally on the visual content.`;
      }
    } else if (mediaPayload.mediaType === 'voice') {
      actionPrompt = 'The user sent a WhatsApp voice message / audio note. Listen carefully to their spoken words, recognize their language, tone, and question, and respond with a natural, friendly WhatsApp reply matching their language and cadence.';
    } else if (mediaPayload.mediaType === 'pdf') {
      actionPrompt = isPlaceholderText
        ? 'Please review the extracted text from the user\'s PDF document, summarize or address its key contents, and respond politely mirroring its style.'
        : `The user sent a PDF document with the comment: "${userText}". Review the extracted document content and respond directly to their query.`;
    } else {
      actionPrompt = `Please review the attached ${fileLabel}, analyze its content, and respond mirroring its style and tone.`;
    }

    const promptString = [actionPrompt, mediaSection, styleDirective].filter(Boolean).join('\n\n').trim();

    if (mediaPayload.inlineData) {
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
      contentParts = promptString;
    }
  } else {
    contentParts = userText;
  }

  // Fallback if no keys available
  if (keyPool.length === 0) {
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

  let lastError = null;

  // Try across available keys in pool
  for (let keyAttempt = 0; keyAttempt < keyPool.length; keyAttempt++) {
    const keyIdx = (currentGeminiKeyIndex + keyAttempt) % keyPool.length;
    const activeApiKey = keyPool[keyIdx];
    const genAI = new GoogleGenerativeAI(activeApiKey);

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
        });

        let replyText = '';

        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
          try {
            const chat = model.startChat({ history: chatHistory });
            const result = await chat.sendMessage(contentParts);
            const response = await result.response;
            replyText = response.text();
          } catch (chatErr) {
            const result = await model.generateContent(contentParts);
            const response = await result.response;
            replyText = response.text();
          }
        } else {
          const result = await model.generateContent(contentParts);
          const response = await result.response;
          replyText = response.text();
        }

        if (replyText && replyText.trim() !== '') {
          currentGeminiKeyIndex = keyIdx; // Remember healthy key
          return replyText.trim();
        }
      } catch (error) {
        lastError = error;
        const msg = error.message || '';
        const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
        if (isQuota) {
          console.warn(`[Gemini] Key #${keyIdx + 1} quota/rate-limited on ${modelName}. Rotating to next key...`);
          break; // Break model loop to rotate key
        }
        continue;
      }
    }
  }

  console.error('All Gemini keys and candidate models exhausted. Last error:', lastError?.message);
  throw new Error(`Gemini AI service error: ${lastError?.message}`);
}

module.exports = {
  generateGeminiReply,
};
