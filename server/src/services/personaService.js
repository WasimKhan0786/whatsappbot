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
 */
function buildDynamicPersonaPrompt(baseSystemPrompt, contact, senderPhone) {
  const persona = resolveContactPersona(contact);
  const contactName = contact?.name ? `"${contact.name}"` : (contact?.relationship ? `"${contact.relationship}"` : 'this contact');
  const relationship = contact?.relationship || 'Friend';
  const customInstructions = contact?.customToneInstructions?.trim() || '';

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
2. STRICTLY IGNORE PAST CHAT TOPICS & DETAILS: Completely disregard and ignore the specific events, tasks, places, activities, or historical situations from past chat samples (e.g. do NOT mention being at the office, commuting, eating dinner, or past errands unless the contact specifically brings it up in their CURRENT incoming message).
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

  return `${baseSystemPrompt || ''}\n\n${personaDirective}`;
}

module.exports = {
  PERSONA_CONFIGS,
  resolveContactPersona,
  analyzeChatSample,
  buildDynamicPersonaPrompt,
};

