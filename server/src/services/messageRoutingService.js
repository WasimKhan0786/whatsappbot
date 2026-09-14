const RoutineTemplate = require('../models/RoutineTemplate');
const { resolveContactPersona, stripKinshipTerms } = require('./personaService');

/**
 * Message Classification & Routing System
 *
 * Categorizes incoming messages into:
 * 1. ROUTINE: Standard greetings, acknowledgements, availability checks, or quick FAQs
 *    -> Handled instantly via predefined response templates (Zero AI quota, <50ms latency).
 * 2. COMPLEX: In-depth questions, problem-solving, multi-topic queries, or creative interactions
 *    -> Routed to Google Gemini AI model for contextual understanding and reasoning.
 */

// Core Built-in Routine Intent Definitions
const DEFAULT_ROUTINE_INTENTS = [
  {
    intentKey: 'GREETING_ISLAMIC',
    name: 'Islamic Greeting (Salam / Assalam Walekum)',
    description: 'Triggered when contact greets with Islamic salutations.',
    patterns: [
      '\\b(assalam\\s*walekum|assalamualaikum|assalam\\s*o\\s*alaikum|salam\\s*walekum|asalaam\\s*walekum|walekum\\s*assalam|salam)\\b',
    ],
    defaultTemplate: 'Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?',
    personaOverrides: {
      RESPECTFUL: 'Walaikum Assalam ji! Kaise hain aap? Boliye kya baat thi.',
      ROMANTIC: 'Walaikum Assalam meri jaan! ❤️ Kaise ho aap? Khana khaya?',
      CASUAL_SLANG: 'Walaikum Assalam bawa! Kya scene hai? Sab sort hai?',
      EMOTIONAL: 'Walaikum Assalam! Sab theek toh hai na? Batao kya baat hai.',
      PROFESSIONAL: 'Walaikum Assalam. How can I assist you today?',
    },
  },
  {
    intentKey: 'GREETING_CASUAL',
    name: 'General Greetings & Well-Wishes',
    description: 'Standard conversational greetings (Hi, Hello, Good Morning, etc.).',
    patterns: [
      '^(hi+|hello+|hey+|hola|namaste|pranam|ram\\s*ram|good\\s*(morning|afternoon|evening|night)|subah\\s*bakhair|kaise\\s*ho|kya\\s*haal\\s*hai)(\\s+(bhai|yaar|bro|ji|wasim|dost|dear|jaan|sab))?[!?,.\\s]*$',
      '^(kya\\s*chal\\s*raha\\s*hai|aur\\s*bhai\\s*kya\\s*haal)[!?,.\\s]*$',
    ],
    defaultTemplate: 'Haanji bhai! Kaise ho? Boliye kya haal chaal?',
    personaOverrides: {
      RESPECTFUL: 'Pranam ji! Kaise hain aap? Sab theek thaak hai aap sunaiye.',
      ROMANTIC: 'Hello meri jaan! ❤️ Kitna miss kar raha tha aapko. Kaise ho?',
      CASUAL_SLANG: 'Arre bhai! Kya scene hai? Bol na kya haal chaal.',
      EMOTIONAL: 'Hello ji, hamesha khush rahiye. Bataiye sab kaisa chal raha hai?',
      PROFESSIONAL: 'Hello! Thank you for getting in touch. Please let me know how I may help.',
    },
  },
  {
    intentKey: 'ACKNOWLEDGEMENT',
    name: 'Simple Acknowledgements & OKs',
    description: 'Short confirmation phrases (Ok, Theek hai, Haan, Done, Noted).',
    patterns: [
      '^(ok+|okay+|accha+|acha+|haan+|haanji+)?\\s*(theek\\s*hai|thik\\s*hai|ok+|okay+|accha+|got\\s*it|done|noted|bilkul|sure|alright|no\\s*problem|koi\\s*baat\\s*nahi)(\\s+(bhai|yaar|bro|ji|wasim|dost|dear|jaan))?[!?,.\\s]*$',
      '\\b(ok\\s*theek\\s*hai|haan\\s*bhai|theek\\s*hai\\s*bhai)\\b',
    ],
    defaultTemplate: 'Theek hai bhai! Koi bhi zaroorat ho toh batana, main hoon yahan.',
    personaOverrides: {
      RESPECTFUL: 'Ji bilkul! Koi bhi baat ho toh zaroor bataiye.',
      ROMANTIC: 'Theek hai meri jaan, apna khayal rakhna ❤️',
      CASUAL_SLANG: 'Sahi hai bawa, scene sort hai ekdum!',
      EMOTIONAL: 'Theek hai, main hamesha aapke sath hoon.',
      PROFESSIONAL: 'Understood. Please let us know if you require anything else.',
    },
  },
  {
    intentKey: 'AVAILABILITY_BUSY',
    name: 'Availability & Calling Inquiry',
    description: 'Questions inquiring if the user is free or can take a call.',
    patterns: [
      '\\b(free\\s*ho\\??|busy\\s*ho\\??|kaha\\s*ho\\??|kidhar\\s*ho\\??|call\\s*karu[n]?\\??|baat\\s*ho\\s*sakti\\s*hai\\??|can\\s*you\\s*talk\\??|are\\s*you\\s*free\\??)\\b',
    ],
    defaultTemplate: 'Haanji bhai, filhaal thoda sa busy hoon. Bas thodi der mein aapse direct personally baat karta hoon.',
    personaOverrides: {
      RESPECTFUL: 'Ji namaste, filhaal thoda sa zaroori kaam mein hoon. Free hote hi turant aapse sampark karta hoon.',
      ROMANTIC: 'Haan meri jaan! Bas abhi thoda busy tha, thodi der mein aapse araam se baat karta hoon ❤️',
      CASUAL_SLANG: 'Arre bhai thoda fas gaya tha, 10 min mein ping karta hoon wapas!',
      EMOTIONAL: 'Bas thoda sa kaam tha, thodi der mein aapse sukoon se baat karta hoon.',
      PROFESSIONAL: 'Currently in a meeting or occupied. I will get back to you shortly.',
    },
  },
  {
    intentKey: 'GRATITUDE',
    name: 'Thanks & Appreciation',
    description: 'Expressions of thanks, gratitude, or appreciation.',
    patterns: [
      '^(thanks+|thank\\s*you|shukriya|dhanyawad|bohot\\s*shukriya|meharbani|welcome)(\\s+(bhai|yaar|bro|ji|wasim|dost|dear|jaan|so\\s*much|a\\s*lot))?[!?,.\\s]*$',
      '\\b(thanks+|thank\\s*you\\s*so\\s*much|bohot\\s*shukriya)\\b',
    ],
    defaultTemplate: 'Bohot bohot shukriya bhai! Khush rahiye aur koi baat ho toh bataiye.',
    personaOverrides: {
      RESPECTFUL: 'Aapka bohot dhanyawad ji! Sada khush rahiye.',
      ROMANTIC: 'Aapko thanks bolne ki zaroorat nahi meri jaan! ❤️',
      CASUAL_SLANG: 'Arre bhai bhai, mention not! Apna hi banda hai tu.',
      EMOTIONAL: 'Dil se shukriya, hamesha khush rahiye.',
      PROFESSIONAL: 'You are most welcome. It is always a pleasure assisting you.',
    },
  },
  {
    intentKey: 'FAREWELL',
    name: 'Farewells & Sign-offs',
    description: 'Signing off for the day or ending the conversation.',
    patterns: [
      '^(chalo\\s+)?(bye+|good\\s*night|alvida|tata|see\\s*you|milte\\s*hain)(\\s+(bye|good\\s*night|bhai|yaar|bro|ji|wasim|dost|dear|jaan))*[!?,.\\s]*$',
      '\\b(bye\\s*bye|good\\s*night|chalo\\s*bye)\\b',
    ],
    defaultTemplate: 'Theek hai bhai! Apna khayal rakhna, phir baat hoti hai. Bye!',
    personaOverrides: {
      RESPECTFUL: 'Ji shubh raatri, apna khayal rakhiyega. Phir baat hoti hai.',
      ROMANTIC: 'Good night meri jaan, sweet dreams! Khayal rakhna apna ❤️',
      CASUAL_SLANG: 'Chal bawa milte hain phir, chill maar!',
      EMOTIONAL: 'Khayal rakhna apna, dil se dua hai aapke liye.',
      PROFESSIONAL: 'Thank you. Have a great day ahead.',
    },
  },
];

/**
 * Seeds or synchronizes default routine templates in MongoDB Atlas on startup
 */
async function seedDefaultRoutineTemplates() {
  try {
    for (const item of DEFAULT_ROUTINE_INTENTS) {
      await RoutineTemplate.updateOne(
        { intentKey: item.intentKey },
        {
          $setOnInsert: {
            name: item.name,
            description: item.description,
            defaultTemplate: item.defaultTemplate,
            personaOverrides: item.personaOverrides,
            isEnabled: true,
          },
          $set: {
            patterns: item.patterns,
          },
        },
        { upsert: true }
      );
    }
    console.log(`✅ [MessageRouter] Synchronized ${DEFAULT_ROUTINE_INTENTS.length} predefined routine templates.`);
  } catch (err) {
    console.warn('[MessageRouter] Seeding routine templates warning:', err.message);
  }
}

/**
 * Analyzes and classifies an incoming message into ROUTINE or COMPLEX
 *
 * @param {string} messageText - The text received from the sender
 * @param {object|null} contact - Optional matched WhitelistContact document
 * @param {boolean} isAutoReplyAll - Whether Global Auto-Reply All is active
 * @returns {Promise<{ category: 'ROUTINE' | 'COMPLEX', intentKey: string, confidence: number, templateReply: string|null, reason: string }>}
 */
async function classifyMessage(messageText, contact = null, isAutoReplyAll = false) {
  if (!messageText || typeof messageText !== 'string') {
    return {
      category: 'COMPLEX',
      intentKey: 'NON_TEXT',
      confidence: 1.0,
      templateReply: null,
      reason: 'Non-text or empty message forwarded to AI',
    };
  }

  const cleanText = messageText.trim();
  const lowerText = cleanText.toLowerCase();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  // 1. Complexity Gate: Long messages (> 110 characters or > 18 words) indicate complex multi-faceted inquiries
  if (cleanText.length > 110 || wordCount > 18) {
    return {
      category: 'COMPLEX',
      intentKey: 'LONG_NARRATIVE_QUERY',
      confidence: 0.95,
      templateReply: null,
      reason: 'Message length exceeds routine threshold; forwarded to Gemini AI',
    };
  }

  // 2. Complexity Gate: Indicators of deep reasoning, math, coding, or problem-solving
  const complexKeywords = /\b(kyu|kyun|why|explain|samjhao|kaise\s*karein|how\s*to|difference|problem|error|solution|solve|calc|formula|code|help\s*me\s*with|details\s*about)\b/i;
  if (complexKeywords.test(lowerText) && !lowerText.includes('kaise ho') && !lowerText.includes('kaise hain')) {
    return {
      category: 'COMPLEX',
      intentKey: 'ANALYTICAL_QUERY',
      confidence: 0.9,
      templateReply: null,
      reason: 'Analytical or problem-solving intent detected; forwarded to Gemini AI',
    };
  }

  // 3. Load active routine templates from DB (or fallback to defaults)
  let templates = [];
  try {
    templates = await RoutineTemplate.find({ isEnabled: true }).lean();
  } catch (dbErr) {
    templates = DEFAULT_ROUTINE_INTENTS;
  }

  if (!templates || templates.length === 0) {
    templates = DEFAULT_ROUTINE_INTENTS;
  }

  // 4. Pattern matching against Routine Templates
  const persona = isAutoReplyAll ? { key: 'PROFESSIONAL' } : resolveContactPersona(contact);
  const personaKey = isAutoReplyAll ? 'PROFESSIONAL' : (persona?.key || 'FRIENDLY');

  for (const tpl of templates) {
    for (const patStr of tpl.patterns || []) {
      try {
        const regex = new RegExp(patStr, 'i');
        if (regex.test(lowerText)) {
          // Resolve persona-adapted template reply
          let reply = tpl.defaultTemplate;
          if (tpl.personaOverrides && tpl.personaOverrides[personaKey]) {
            reply = tpl.personaOverrides[personaKey];
          }

          if (isAutoReplyAll && reply) {
            reply = stripKinshipTerms(reply);
          }

          // Increment usage count asynchronously
          RoutineTemplate.updateOne({ intentKey: tpl.intentKey }, { $inc: { usageCount: 1 } }).catch(() => {});

          return {
            category: 'ROUTINE',
            intentKey: tpl.intentKey,
            confidence: 0.98,
            templateReply: reply,
            reason: `Matched routine pattern for [${tpl.name}]`,
          };
        }
      } catch (regexErr) {
        // Skip invalid regex pattern
      }
    }
  }

  // 5. Default fallback: All unmapped messages are treated as COMPLEX
  return {
    category: 'COMPLEX',
    intentKey: 'GENERAL_COMPLEX',
    confidence: 0.85,
    templateReply: null,
    reason: 'No routine template matched; routing to Gemini AI model for full context reasoning',
  };
}

module.exports = {
  DEFAULT_ROUTINE_INTENTS,
  seedDefaultRoutineTemplates,
  classifyMessage,
};
