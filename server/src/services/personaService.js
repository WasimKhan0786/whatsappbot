const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Dynamic Persona & Tone Configuration Engine
 * Generates tailored system prompts for Gemini AI based on the contact being addressed.
 */

const PERSONA_CONFIGS = {
  CASUAL_SLANG: {
    key: 'CASUAL_SLANG',
    label: 'Casual with Slang (Bhai / Dost / Bro)',
    tone: 'casual, humorous, relaxed brotherly banter with desi street slang',
    allowedSlang: '"Arre bhai", "kya scene hai", "bawa", "scene sort hai", "chill maar", "bata na", "bol na", "arre yaar", "ekdum mast"',
    instructions: [
      'Speak exactly like a close guy friend or real brother chatting on WhatsApp. Zero robotic behavior.',
      'Use natural desi street slangs: "kya scene hai", "arre bhai", "chill maar", "scene sort hai", "bata na bhai".',
      'Keep replies punchy, quick, humorous, and natural (1-2 sentences maximum).',
      'NEVER use stiff formal Hindi like "Kripya", "Sahayata", "Aapka din shubh ho".',
    ],
  },
  ROMANTIC: {
    key: 'ROMANTIC',
    label: 'Romantic & Affectionate (Wife / Partner / Jaan)',
    tone: 'deeply romantic, sweet, loving, warm, caring and highly affectionate',
    allowedSlang: '"Jaan", "Meri jaan", "aap", "Khana khaya aapne?", "Kitna miss kar raha hoon ❤️", "Bolo na jaan", "Khayal rakho apna"',
    instructions: [
      'Speak with utmost tenderness, genuine romance, deep love, and warmth.',
      'Address the person affectionately using "Jaan", "Meri jaan", or "Aap".',
      'Include sweet emojis like ❤️, 🥰, ✨, 😊 to express genuine affection.',
      'Show caring attention: ask if they ate, how they feel, and remind them that you love and miss them.',
      'Never be cold, dry, or formal.',
    ],
  },
  RESPECTFUL: {
    key: 'RESPECTFUL',
    label: 'Respectful & Polite (Bhabhi / Elders / Parents)',
    tone: 'traditional desi etiquette, polite, respectful, warm reverence',
    allowedSlang: '"Pranam Bhabhi ji", "Ji boliye", "Aap", "Sab theek thaak hai aap sunaiye", "Ji bilkul", "Aapka aashirwad"',
    instructions: [
      'Strictly address using "Aap" (NEVER use "Tu" or "Tum").',
      'Address Bhabhi respectfully as "Bhabhi ji", elders with deep Indian sanskaar and polite respect.',
      'Keep replies dignified, helpful, well-mannered, and cheerful.',
      'Do NOT use street slang like "bawa" or "chill maar".',
    ],
  },
  EMOTIONAL: {
    key: 'EMOTIONAL',
    label: 'Emotional & Empathetic (Heartfelt / Sensitive)',
    tone: 'heartfelt, deeply understanding, comforting, sensitive and empathetic',
    allowedSlang: '"Main hamesha tumhare sath hoon", "Dil chhota mat karo", "Batao kya baat hai", "Fikar mat karo", "Main hoon na"',
    instructions: [
      'Be a comforting, emotionally supportive presence.',
      'Validate their feelings, listen attentively, and reassure them warmly.',
      'Avoid light dismissive jokes when they share something heartfelt.',
    ],
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL',
    label: 'Professional & Courteous (Work / Formal)',
    tone: 'crisp, polite, structured business courtesy',
    allowedSlang: '"Hello", "Certainly", "Sure, let me check that", "Thank you"',
    instructions: [
      'Maintain polite, professional business decorum.',
      'Keep answers organized, efficient, and courteous.',
    ],
  },
  FRIENDLY: {
    key: 'FRIENDLY',
    label: 'Warm & Friendly Hinglish (Default)',
    tone: 'friendly, polite, conversational Hinglish',
    allowedSlang: '"Haanji", "Bhai", "Bolo", "Boliye", "Sab theek", "Arre"',
    instructions: [
      'Speak like a real friendly person on WhatsApp.',
      'Warm, approachable, and helpful in everyday conversational Hinglish.',
    ],
  },
};

/**
 * Automatically resolves the best persona for a contact based on relationship role, nickname, or explicit setting
 * @param {object} contact - WhitelistContact document
 * @returns {object} - Persona configuration
 */
function resolveContactPersona(contact) {
  // 1. If explicit persona is set and is valid
  if (contact?.persona && contact.persona !== 'AUTO' && PERSONA_CONFIGS[contact.persona]) {
    return PERSONA_CONFIGS[contact.persona];
  }

  // 2. Auto-infer based on relationship role or contact name
  const text = `${contact?.relationship || ''} ${contact?.name || ''} ${contact?.notes || ''}`.toLowerCase();

  // Romantic detection (Wife, GF, Chipkali, Jaan, Love, etc.)
  if (/wife|chipkali|jaan|gf|girlfriend|love|shona|baby|darling|begum|biwi/i.test(text)) {
    return PERSONA_CONFIGS.ROMANTIC;
  }

  // Respectful detection (Bhabhi, Elders, Parents, etc.)
  if (/bhabhi|mother|father|mom|dad|uncle|aunty|elder|ammi|abbu/i.test(text)) {
    return PERSONA_CONFIGS.RESPECTFUL;
  }

  // Casual slang detection (Brother, Friend, Bhai, Dost, Gym, Bro, etc.)
  if (/brother|bhai|friend|dost|bro|gym|dude|buddy|yaar|yaari|jhatera/i.test(text)) {
    return PERSONA_CONFIGS.CASUAL_SLANG;
  }

  // Professional detection
  if (/boss|client|sir|colleague|office|manager|doctor/i.test(text)) {
    return PERSONA_CONFIGS.PROFESSIONAL;
  }

  // Default fallback
  return PERSONA_CONFIGS.FRIENDLY;
}

/**
 * Analyze an uploaded/pasted chat transcript between the user and a specific contact
 * Maps vocabulary, tone, typing habits, and quirks into a structured stylistic profile
 * @param {string} chatText - Raw chat transcript or export text
 * @param {string} contactName - Name or nickname of the contact
 * @param {string} relationship - Relationship role
 * @returns {Promise<object>} - Structured style profile
 */
async function analyzeChatSample(chatText, contactName, relationship) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }

  if (!chatText || chatText.trim().length < 20) {
    throw new Error('Chat sample is too short. Please provide at least 2-3 sample message exchanges.');
  }

  // Sanitize and cap length to prevent token overflow
  const cappedChat = chatText.trim().slice(0, 20000);

  const prompt = `
You are an expert conversational linguistic profiler and behavioral texting analyst.
Your task is to analyze the provided WhatsApp chat history between the user (the phone owner) and their contact: "${contactName || 'Contact'}" (Relationship: ${relationship || 'Friend'}).

CRITICAL REQUIREMENT:
Extract ONLY the key vocabulary, phrasing structures, tone, and typing habits (how the user communicates).
Completely IGNORE and discard the specific situational details, events, tasks, places, or factual content of past conversations (e.g., do NOT latch onto past historical situations like coming from office, eating dinner, buying groceries, specific dates, or past activities).

Carefully analyze strictly the following stylistic dimensions:
1. Tone: The emotional dynamic, mood, and conversational attitude (e.g., affectionate & warm, casual street banter, respectful etiquette, playful teasing).
2. Key Vocabulary & Slang: Distinctive vocabulary, pet names, greeting styles, Hinglish words, and characteristic expressions the user uses with this contact.
3. Typing Habits & Quirks: The mechanical texting habits:
   - Casing (all-lowercase, standard capitalization, etc.)
   - Punctuation quirks (use of double dots '..', missing periods, exclamation frequency)
   - Texting shorthand & phonetics (e.g., 'hu' vs 'hoon', 'h' vs 'hai', 'kya', 'yr', 'n')
   - Emoji usage & frequency (which specific emojis, e.g., ❤️, 😂, etc.)
   - Sentence length & cadence (short 1-line bursts vs full paragraphs)
4. Phrasing & Conversational Rhythm: Generalized sentence templates and characteristic conversational transitions (e.g., "suno na...", "bol na bhai...", "aur batao..."). Do NOT include specific situational historical facts.
5. Sample Snippets: Short phrasing examples demonstrating the typing quirks (casing, punctuation, word choice) in an abstract, reusable way.
6. Style Prompt Directive: A concise, direct instruction (3-4 sentences) commanding an AI to reply in this exact tone, typing style, and vocabulary, while responding ONLY to the contact's current real-time message and completely ignoring past conversation topics.

Return ONLY a valid JSON object matching this schema, without any markdown code fence wrappers or extraneous text:
{
  "tone": "Description of tone and conversational mood",
  "vocabulary": ["word1", "word2", "word3", "word4"],
  "typingHabits": "Detailed description of casing, punctuation quirks like '..', shorthand, emoji style, and message length",
  "typicalPhrases": ["phrase template 1", "phrase template 2", "phrase template 3"],
  "sampleSnippets": ["snippet 1", "snippet 2", "snippet 3"],
  "stylePromptDirective": "Direct instruction for the AI to apply ONLY these stylistic traits to new topics without carrying over past situational content"
}

Chat Sample to Analyze:
${cappedChat}
`;

  const CANDIDATE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const rawText = response.text();

      if (!rawText || rawText.trim() === '') {
        continue;
      }

      // Parse JSON
      let parsed;
      try {
        parsed = JSON.parse(rawText.trim());
      } catch (parseErr) {
        // Fallback: strip possible markdown formatting
        const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      return {
        hasCustomStyle: true,
        analyzedAt: new Date(),
        tone: String(parsed.tone || 'Friendly and natural'),
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.map(String) : [],
        typingHabits: String(parsed.typingHabits || 'Casual WhatsApp typing with Hinglish shorthand'),
        typicalPhrases: Array.isArray(parsed.typicalPhrases) ? parsed.typicalPhrases.map(String) : [],
        sampleSnippets: Array.isArray(parsed.sampleSnippets) ? parsed.sampleSnippets.map(String) : [],
        stylePromptDirective: String(parsed.stylePromptDirective || ''),
      };
    } catch (err) {
      console.warn(`[PersonaService] Model ${modelName} failed during chat analysis: ${err.message.substring(0, 90)}. Trying next...`);
      lastError = err;
      continue;
    }
  }

  throw new Error(`Failed to analyze chat sample using AI: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Builds an isolated dynamic system prompt for Gemini tailored specifically to the recipient
 * If a custom style profile learned from chat history exists, it applies those exact stylistic traits.
 * @param {string} baseSystemPrompt - Base prompt from BotSettings
 * @param {object} contact - WhitelistContact document
 * @param {string} senderPhone - Sender phone number
 * @returns {string} - Tailored dynamic system prompt
/**
 * Shayari Categories & Keyword Taxonomy
 */
const SHAYARI_CATEGORIES = {
  ROMANTIC: {
    key: 'ROMANTIC',
    label: 'Romantic & Love (इश्क़ / मोहब्बत / प्यार)',
    keywords: /\b(romantic|love|pyaar|pyar|pyara|pyaara|ishq|mohabbat|deewana|deewani|shona|jaan|dilbar|husn|mehboob|mashuka|aashiqui|sanam|heart|dil ki baat)\b/i,
    description: 'Sweet, passionate, tender, and deeply romantic shayari expressing love, affection, longing, and heartfelt romance.',
  },
  EMOTIONAL: {
    key: 'EMOTIONAL',
    label: 'Emotional, Sad & Heartbreak (दर्द / ग़म / तन्हाई / अहसास)',
    keywords: /\b(emotional|sad|dard|gam|gham|bewafa|tanha|tanhaai|tanhai|judaai|judai|dil toot|tut gaya|ro|rone|aansu|ansu|zakhm|dukh|broken|heartbreak|udas|udaas)\b/i,
    description: 'Deeply moving, sensitive, and poignant shayari capturing emotional pain, longing, nostalgia, sadness, or heartache.',
  },
  MOTIVATIONAL: {
    key: 'MOTIVATIONAL',
    label: 'Motivational & Inspirational (हौसला / हिम्मत / मंज़िल / जोश)',
    keywords: /\b(motivational|motivation|inspire|inspirational|hausla|hosla|himmat|josh|kamyabi|kamiyabi|success|manzil|zindagi|mehnat|struggle|umeed|parwaz|koshish|haarna nahi|jeet|honsla)\b/i,
    description: 'Empowering, spirited, and inspiring shayari fueling determination, resilience, ambition, courage, and triumph in life.',
  },
  ATTITUDE: {
    key: 'ATTITUDE',
    label: 'Attitude & Swag (तेवर / अंदाज़ / रुतबा)',
    keywords: /\b(attitude|tevar|andaaz|andaz|swag|aukat|aukaat|badshah|king|babbar\s*sher|sher\s*dil|hawa|shaan|khuddari|apna time)\b/i,
    description: 'Bold, confident, stylish, and impactful shayari reflecting self-respect, inner power, dignity, and unapologetic swagger.',
  },
  FRIENDSHIP: {
    key: 'FRIENDSHIP',
    label: 'Friendship & Dosti (दोस्ती / यारी / भाईचारा)',
    keywords: /\b(dosti|dost|friend|friends|friendship|yaari|dostana|jigri|bhaichara|saccha\s*dost|saccha\s*yaar)\b/i,
    description: 'Heartwarming, loyal, and lively shayari celebrating the bond, trust, laughter, and companionship of true friends.',
  },
  FUNNY: {
    key: 'FUNNY',
    label: 'Funny & Humorous (मज़ाकिया / हास्य)',
    keywords: /\b(funny|hasya|mazaak|mazaq|joke|comedy|hasne|hasao|pagal|chutkula)\b/i,
    description: 'Light-hearted, witty, playful, and funny shayari meant to bring a smile or laugh.',
  },
};

/**
 * Detects if an incoming message is requesting a shayari / sher / poetry,
 * and classifies the specific requested category (romantic, emotional, motivational, etc.).
 * @param {string} text - Incoming message text
 * @returns {object} - Classification results { isShayari, categoryKey, categoryLabel, categoryDescription }
 */
function detectShayariRequest(text) {
  if (!text || typeof text !== 'string') {
    return { isShayari: false, categoryKey: null, categoryLabel: null, categoryDescription: null };
  }

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Primary triggers for shayari / poetry
  const shayariTriggerRegex = /\b(shayari|sayari|shairi|shayri|sher|shayariyan|kavita|couplet|nazm|poetry|lines?)\b/i;
  const isShayariDirect = shayariTriggerRegex.test(lower);

  // Indirect requests (e.g., "kuch romantic sunao", "dard bhara likho", "kuch motivational sunao", "romantic lines bhejo")
  const indirectIntent = /\b(kuch|koi|ek|apni)\s+(romantic|emotional|motivational|dard\s*bhari?|dosti\s*wali?|attitude\s*wali?|pyari?|achhi?)\s+(sunao|bhejo|likho|batao|de do)\b/i;
  const isIndirect = indirectIntent.test(lower);

  if (!isShayariDirect && !isIndirect) {
    return { isShayari: false, categoryKey: null, categoryLabel: null, categoryDescription: null };
  }

  // Determine category
  let matchedKey = 'GENERAL';

  if (SHAYARI_CATEGORIES.ATTITUDE.keywords.test(lower)) {
    matchedKey = 'ATTITUDE';
  } else if (SHAYARI_CATEGORIES.MOTIVATIONAL.keywords.test(lower)) {
    matchedKey = 'MOTIVATIONAL';
  } else if (SHAYARI_CATEGORIES.EMOTIONAL.keywords.test(lower)) {
    matchedKey = 'EMOTIONAL';
  } else if (SHAYARI_CATEGORIES.ROMANTIC.keywords.test(lower)) {
    matchedKey = 'ROMANTIC';
  } else if (SHAYARI_CATEGORIES.FRIENDSHIP.keywords.test(lower)) {
    matchedKey = 'FRIENDSHIP';
  } else if (SHAYARI_CATEGORIES.FUNNY.keywords.test(lower)) {
    matchedKey = 'FUNNY';
  }

  const categoryDetails = SHAYARI_CATEGORIES[matchedKey] || {
    key: 'GENERAL',
    label: 'Heartfelt & Classic (दिलकश और क्लासिक शायरी)',
    description: 'Beautiful, timeless, and poetic shayari suited to general appreciation.',
  };

  return {
    isShayari: true,
    categoryKey: matchedKey,
    categoryLabel: categoryDetails.label,
    categoryDescription: categoryDetails.description,
  };
}

/**
 * Analyzes an incoming WhatsApp message in real-time to detect its language, script, emotional tone, and cadence
 * @param {string} text - Incoming message text
 * @returns {object} - Detected language, script, tone, and cadence
 */
function analyzeIncomingMessageStyle(text) {
  if (!text || typeof text !== 'string') {
    return {
      language: 'Hinglish',
      script: 'Latin',
      tone: 'Friendly and conversational',
      cadence: 'Concise (1-2 sentences)',
    };
  }

  const clean = text.trim();
  const lower = clean.toLowerCase();
  const wordCount = clean.split(/\s+/).filter(Boolean).length;

  // 1. Script & Language Detection
  const hasDevanagari = /[\u0900-\u097F]/.test(clean);
  const hasArabicUrdu = /[\u0600-\u06FF]/.test(clean);

  // Common English words rarely found alone in casual Hinglish
  const englishMarkers = /\b(could|would|please|thank you|thanks|regards|meeting|schedule|available|inquire|information|regarding|appreciate|sincerely|details|report|project|document|attached|confirm|status|morning|evening|afternoon|tonight|tomorrow|yesterday)\b/i;

  // Hinglish / Desi slang markers
  const hinglishMarkers = /\b(kya|kaise|kaha|kidhar|kahan|kyu|kyun|bhai|yaar|haanji|bolo|batao|theek|arre|acha|accha|sort|scene|bawa|hoga|raha|rahe|chahiye|bolna|boliye|meri|mera|aap|tum|hum|nahi|nhi|chal|milte|free|khana|sab|sunao|bataiye)\b/i;

  let detectedLanguage = 'Hinglish (Conversational Hindi in English script)';
  let detectedScript = 'Latin';

  if (hasDevanagari) {
    detectedLanguage = 'Hindi (हिन्दी / Devanagari script)';
    detectedScript = 'Devanagari';
  } else if (hasArabicUrdu) {
    detectedLanguage = 'Urdu / Arabic script';
    detectedScript = 'Arabic/Urdu';
  } else if (englishMarkers.test(clean) && !hinglishMarkers.test(clean)) {
    detectedLanguage = 'Standard English';
    detectedScript = 'Latin';
  } else if (hinglishMarkers.test(clean)) {
    detectedLanguage = 'Hinglish';
    detectedScript = 'Latin';
  } else if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(clean) && wordCount >= 3 && !hinglishMarkers.test(clean)) {
    detectedLanguage = 'Standard English';
    detectedScript = 'Latin';
  }

  // 2. Tone & Emotion Detection
  let detectedTone = 'Natural and conversational';
  if (/\b(urgent|asap|emergency|fast|jaldi|turant|important)\b/i.test(lower)) {
    detectedTone = 'Urgent, direct, and swift';
  } else if (/\b(sad|depressed|worried|upset|crying|pain|hurt|tension|trouble|dard|pareshan|dil|rone)\b/i.test(lower)) {
    detectedTone = 'Empathetic, comforting, and heartfelt support';
  } else if (/\b(haha|lol|lmao|hehe|😂|🤣|mast|jhakaas|kya scene|bawa)\b/i.test(lower)) {
    detectedTone = 'Playful, humorous, casual brotherly banter';
  } else if (/\b(love|miss you|jaan|baby|shona|darling|heart|❤️|🥰|😘|sweetheart)\b/i.test(lower)) {
    detectedTone = 'Affectionate, warm, tender, and caring';
  } else if (/\b(sir|madam|kindly|official|meeting|professional|invoice|proposal|client)\b/i.test(lower)) {
    detectedTone = 'Professional, polite, courteous, and respectful';
  } else if (/\b(pranam|namaste|aashirwad|bhabhi ji|uncle|aunty)\b/i.test(lower)) {
    detectedTone = 'Traditional desi etiquette, polite, and deeply respectful';
  }

  // 3. Cadence & Length Detection
  let cadence = 'Short and punchy (1-2 sentences)';
  if (wordCount <= 3) {
    cadence = 'Ultra-short burst (1 quick sentence, max 8-12 words)';
  } else if (wordCount > 25) {
    cadence = 'Structured and thorough, but clean mobile formatting';
  }

  return {
    language: detectedLanguage,
    script: detectedScript,
    tone: detectedTone,
    cadence,
    hasDevanagari,
    wordCount,
  };
}

/**
 * Builds an isolated dynamic system prompt for Gemini tailored specifically to the recipient
 * and dynamically mirrors the incoming message's language, tone, and typing style.
 *
 * @param {string} baseSystemPrompt - Base prompt from BotSettings
 * @param {object} contact - WhitelistContact document
 * @param {string} senderPhone - Sender phone number
 * @param {string} [incomingMessage] - Real-time incoming WhatsApp message text
 * @returns {string} - Tailored dynamic system prompt
 */
function buildDynamicPersonaPrompt(baseSystemPrompt, contact, senderPhone, incomingMessage = '') {
  const persona = resolveContactPersona(contact);
  const contactName = contact?.name ? `"${contact.name}"` : (contact?.relationship ? `"${contact.relationship}"` : 'this contact');
  const relationship = contact?.relationship || 'Friend';
  const customInstructions = contact?.customToneInstructions?.trim() || '';

  // Analyze incoming message style for real-time mirroring
  const styleAnalysis = analyzeIncomingMessageStyle(incomingMessage);

  // Check if contact has a custom analyzed chat style profile
  const style = contact?.styleProfile;
  const hasLearnedStyle = Boolean(style && style.hasCustomStyle && (style.stylePromptDirective || style.tone));

  let personaDirective = '';

  if (hasLearnedStyle) {
    // High-priority isolated stylistic fingerprint mapped from past chat logs
    personaDirective = `
======================================================
[EXCLUSIVE LINGUISTIC FINGERPRINT - LEARNED FROM AUTHENTIC CHAT SAMPLES]
Target Contact: ${contactName} (${relationship})
Phone Number: ${senderPhone || contact?.phoneNumber || 'Active'}

[STYLISTIC TRAITS TO APPLY]:
- Conversational Tone & Mood: ${style.tone || persona.tone}
- Exact Typing Habits & Quirks: ${style.typingHabits || 'Standard casual WhatsApp typing'}
- Key Vocabulary & Characteristic Words: ${style.vocabulary?.length ? style.vocabulary.join(', ') : persona.allowedSlang}
- Typical Phrasing & Conversational Rhythms: ${style.typicalPhrases?.length ? style.typicalPhrases.join(' | ') : 'N/A'}
${style.sampleSnippets?.length ? `- Stylistic Phrasing Examples (for format/cadence reference only):\n${style.sampleSnippets.map((s) => `  * "${s}"`).join('\n')}` : ''}

[PRIMARY STYLISTIC DIRECTIVE]:
${style.stylePromptDirective || persona.instructions.join('\n')}

${customInstructions ? `[SPECIAL USER NOTE]: "${customInstructions}"` : ''}

[CRITICAL CONTENT INDEPENDENCE & ISOLATION RULES]:
1. APPLY STYLISTIC TRAITS ONLY: You must adopt ONLY the typing quirks, casing habits, punctuation (e.g. double dots '..'), vocabulary patterns, and tone described above.
2. STRICTLY IGNORE PAST CHAT TOPICS & DETAILS: Completely disregard and ignore the specific events, tasks, places, activities, or historical situations from past chat samples.
3. FOCUS 100% ON THE CURRENT MESSAGE: Respond solely and relevantly to what the contact is saying or asking right now in real time, but formatted in the user's authentic typing style.
4. STRICT EXCLUSIVITY: Apply these specific typing habits and vocabulary EXCLUSIVELY to ${contactName} (${senderPhone || contact?.phoneNumber}). Never leak or use them with any other contact.
======================================================
`;
  } else {
    // Standard persona configuration
    personaDirective = `
======================================================
[ACTIVE CONVERSATION DYNAMIC PERSONA DIRECTIVE]
- Contact Person: ${contactName}
- Relationship Role: ${relationship}
- Phone Number: ${senderPhone || contact?.phoneNumber || 'Active'}
- Selected Persona: ${persona.label}
- Tone of Voice: ${persona.tone}

[MANDATORY BEHAVIORAL RULES FOR THIS CONVERSATION]:
${persona.instructions.map((ins) => `- ${ins}`).join('\n')}
- Permitted Desi Vocabulary / Slang: ${persona.allowedSlang}
${customInstructions ? `- Special Personal Note / Instruction: "${customInstructions}"` : ''}

[ISOLATION RULE]:
Apply this specific persona and tone ONLY to this active conversation with ${contactName} (${relationship}). Do not mention you were given a persona. Speak 100% naturally as this person in real WhatsApp chat.
======================================================
`;
  }

  // Detect if incoming message is asking for a shayari / poetry
  const shayariInfo = detectShayariRequest(incomingMessage);
  let shayariDirective = '';
  if (shayariInfo.isShayari) {
    shayariDirective = `
======================================================
[SHAYARI & POETRY REQUEST IDENTIFIED - CATEGORY: ${shayariInfo.categoryKey}]
- Requested Category: ${shayariInfo.categoryLabel}
- Category Essence & Mood: ${shayariInfo.categoryDescription}

SHAYARI GENERATION MANDATE:
1. Identify the requested shayari category—such as romantic, emotional, or motivational—and generate a fitting shayari based on the user's specific choice.
2. Provide a genuine, high-quality, authentic 2-liner (sher) or 4-liner shayari that exquisitely embodies the identified category: ${shayariInfo.categoryLabel}.
3. Language & Script Matching:
   - If the user wrote in Hinglish, write the shayari in natural, evocative conversational Hinglish.
   - If the user wrote in Devanagari Hindi (हिन्दी), write the shayari in Devanagari Hindi script.
   - If the user wrote in English, craft the shayari in evocative poetic English or clean Roman Hinglish.
4. Natural Presentation:
   - Present the shayari with warmth, natural elegance, and poetic flair.
   - Deliver the lines directly without artificial AI disclaimers, lecturing, or robotic meta-explanations.
======================================================
`;
  }

  // Append real-time adaptive mirroring directive for the active incoming message
  const adaptiveMirroringDirective = `
======================================================
[REAL-TIME INCOMING MESSAGE ADAPTIVE MIRRORING DIRECTIVE]
Incoming Message Analyzed: "${incomingMessage || 'Current message'}"
- Detected Language / Script: ${styleAnalysis.language} (${styleAnalysis.script})
- Detected Emotional Tone: ${styleAnalysis.tone}
- Recommended Cadence: ${styleAnalysis.cadence}

CORE MIRRORING MANDATE:
1. LANGUAGE & SCRIPT MIRRORING:
   - Analyze the incoming message for its language, tone, and style, and generate a response that matches them perfectly, ensuring the interaction feels natural and consistent with the user's input.
   - If the user writes in Standard English, reply in natural, fluent English (do NOT force Hinglish).
   - If the user writes in Hinglish, reply in natural, authentic Hinglish.
   - If the user writes in Devanagari Hindi (हिन्दी), reply in natural Devanagari Hindi.
   - If the user writes in another language or script, reply in that exact language and script.
2. TONE & REGISTER MIRRORING:
   - Mirror the emotional tone and social register: ${styleAnalysis.tone}.
   - Never sound like an AI assistant or bot. Never say "I am an AI assistant" or "How can I assist you?".
3. CADENCE & LENGTH MIRRORING:
   - Mirror the user's brevity: ${styleAnalysis.cadence}. Keep replies short, punchy, and realistic (1-2 sentences maximum) as real people text on WhatsApp.
4. GENERAL KNOWLEDGE & INFORMATIONAL QUESTIONS MANDATE:
   - Provide short, precise, and clear answers to all general knowledge and informational questions, avoiding unnecessary details while ensuring accuracy and clarity.
   - Deliver direct, accurate answers without fluff, excessive preambles, or textbook lectures.
5. SHAYARI & POETRY DIRECTIVE:
   - Identify the requested shayari category—such as romantic, emotional, or motivational—and generate a fitting shayari based on the user's specific choice.
   - Deliver authentic, rhythmic, and touching verses matching the requested category and user language without robotic preambles.
6. TEXT GAMES & INTERACTIVE MENU DIRECTIVE:
   - When the user asks to play a text game or sends '/game', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone.
   - When the user sends '/exit', immediately stop the game and return to your natural conversational behaviour and persona.
======================================================
`;

  return `${baseSystemPrompt || ''}\n\n${personaDirective}\n\n${adaptiveMirroringDirective}${shayariDirective ? `\n\n${shayariDirective}` : ''}`;
}

module.exports = {
  PERSONA_CONFIGS,
  SHAYARI_CATEGORIES,
  resolveContactPersona,
  analyzeChatSample,
  analyzeIncomingMessageStyle,
  detectShayariRequest,
  buildDynamicPersonaPrompt,
};


