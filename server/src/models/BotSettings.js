const mongoose = require('mongoose');

const botSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global_settings',
  },
  isEnabled: {
    type: Boolean,
    default: true,
    required: true,
  },
  autoReplyAll: {
    type: Boolean,
    default: false,
  },
  allowedPhoneNumber: {
    type: String,
    default: '+1234567890',
    trim: true,
  },
  systemPrompt: {
    type: String,
    default:
      'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nCore Conversational & Mirroring Rules:\n- Analyze the incoming message for its language, tone, and style, and generate a response that matches them perfectly, ensuring the interaction feels natural and consistent with the user\'s input.\n- Language Mirroring: If the user writes in English, reply in natural fluent English. If in Hinglish, reply in Hinglish. If in Hindi (Devanagari script) or another language, reply in that exact script/language.\n- Tone & Cadence Mirroring: Match the emotional register (casual banter, courteous respect, professional, or empathetic). Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.\n- Provide short, precise, and clear answers to all general knowledge and informational questions, avoiding unnecessary details while ensuring accuracy and clarity.\n- Identify the requested shayari category—such as romantic, emotional, or motivational—and generate a fitting shayari based on the user\'s specific choice.\n- When the user asks to play a text game or sends \'/game\', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone. When the user sends \'/exit\', immediately stop the game and return to your natural conversational behaviour.\n- Prioritize the current day\'s chat context. If no relevant information is found in the daily session to address an incoming message, analyze the message independently and generate an appropriate reply.\n- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".',
  },
  humanSimulationEnabled: {
    type: Boolean,
    default: true,
  },
  minReadingDelayMs: {
    type: Number,
    default: 2000,
  },
  maxReadingDelayMs: {
    type: Number,
    default: 6000,
  },
  typingSpeedCPM: {
    type: Number,
    default: 250,
  },
  defaultMaxMessagesPerContact: {
    type: Number,
    default: 0, // 0 = Unlimited
  },
  limitReachedClosingMessage: {
    type: String,
    default:
      'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye  AI wasim bot se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much!',
    trim: true,
  },
  dailySessionStrategy: {
    type: String,
    enum: ['RESET', 'ARCHIVE'],
    default: 'RESET', // Clears previous day's context for maximum database efficiency on MongoDB Atlas free tier
  },
  dailyArchiveRetentionDays: {
    type: Number,
    default: 3, // When in ARCHIVE mode, keep maximum 3 days of historical bundles to prevent data accumulation
  },
  profanityFilterEnabled: {
    type: Boolean,
    default: true,
  },
  profanityReplyMessage: {
    type: String,
    default:
      'Kripya sabhya bhasha ka prayog karein. Hum yahan aadar aur maryada ke saath baat karne ke liye upasthit hain. Please maintain respectful communication.',
    trim: true,
  },
  customProfanityKeywords: {
    type: [String],
    default: [],
  },
  imageGenerationEnabled: {
    type: Boolean,
    default: true,
  },
  imageGenerationModel: {
    type: String,
    default: 'black-forest-labs/FLUX.1-schnell',
    trim: true,
  },
  imageGenerationNotice: {
    type: String,
    default: '🎨 Creating your image with AI, please wait a moment...',
    trim: true,
  },
  ownerInactivityTimerEnabled: {
    type: Boolean,
    default: true,
  },
  ownerInactivityDurationMinutes: {
    type: Number,
    default: 15,
  },
  ownerInactivityScope: {
    type: String,
    enum: ['PER_CHAT', 'GLOBAL'],
    default: 'PER_CHAT',
  },
  ownerGlobalLastActivityAt: {
    type: Date,
    default: null,
  },
  ownerGlobalPausedUntil: {
    type: Date,
    default: null,
  },
  newsEnabled: {
    type: Boolean,
    default: true,
  },
  newsDefaultCountry: {
    type: String,
    default: 'in',
    trim: true,
  },
  newsDefaultLanguage: {
    type: String,
    default: 'en',
    trim: true,
  },
  newsMaxArticles: {
    type: Number,
    default: 3,
  },
  googleSearchEnabled: {
    type: Boolean,
    default: true,
  },
  googleSearchCx: {
    type: String,
    default: '8002fdf14f0bb4998',
    trim: true,
  },
  googleSearchApiKey: {
    type: String,
    default: '',
    trim: true,
  },
  googleSearchMaxResults: {
    type: Number,
    default: 4,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Helper static method to get or create settings
botSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'global_settings' });
  if (!settings) {
    settings = await this.create({
      key: 'global_settings',
      isEnabled: true,
      autoReplyAll: false,
      allowedPhoneNumber: process.env.ALLOWED_PHONE_NUMBER || '',
      systemPrompt:
        'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nCore Conversational & Mirroring Rules:\n- Analyze the incoming message for its language, tone, and style, and generate a response that matches them perfectly, ensuring the interaction feels natural and consistent with the user\'s input.\n- Language Mirroring: If the user writes in English, reply in natural fluent English. If in Hinglish, reply in Hinglish. If in Hindi (Devanagari script) or another language, reply in that exact script/language.\n- Tone & Cadence Mirroring: Match the emotional register (casual banter, courteous respect, professional, or empathetic). Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.\n- Provide short, precise, and clear answers to all general knowledge and informational questions, avoiding unnecessary details while ensuring accuracy and clarity.\n- Identify the requested shayari category—such as romantic, emotional, or motivational—and generate a fitting shayari based on the user\'s specific choice.\n- When the user asks to play a text game or sends \'/game\', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone. When the user sends \'/exit\', immediately stop the game and return to your natural conversational behaviour.\n- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".',
      limitReachedClosingMessage:
        'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye  AI wasim bot se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much!',
      profanityFilterEnabled: true,
      profanityReplyMessage:
        'Kripya sabhya bhasha ka prayog karein. Hum yahan aadar aur maryada ke saath baat karne ke liye upasthit hain. Please maintain respectful communication.',
      customProfanityKeywords: [],
      imageGenerationEnabled: true,
      imageGenerationModel: 'black-forest-labs/FLUX.1-schnell',
      imageGenerationNotice: '🎨 Creating your image with AI, please wait a moment...',
      ownerInactivityTimerEnabled: true,
      ownerInactivityDurationMinutes: 15,
      ownerInactivityScope: 'PER_CHAT',
      newsEnabled: true,
      newsDefaultCountry: 'in',
      newsDefaultLanguage: 'en',
      newsMaxArticles: 3,
    });
  } else {
    let needsSave = false;
    if (settings.autoReplyAll === undefined) {
      settings.autoReplyAll = false;
      needsSave = true;
    }
    if (!settings.systemPrompt.includes('/game')) {
      settings.systemPrompt += '\n- When the user asks to play a text game or sends \'/game\', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone. When the user sends \'/exit\', immediately stop the game and return to your natural conversational behaviour.';
      needsSave = true;
    }
    if (!settings.systemPrompt.includes('Prioritize the current day')) {
      settings.systemPrompt += '\n- Prioritize the current day\'s chat context. If no relevant information is found in the daily session to address an incoming message, analyze the message independently and generate an appropriate reply.';
      needsSave = true;
    }
    if (!settings.limitReachedClosingMessage || settings.limitReachedClosingMessage.includes('AI WhatsApp Assistant')) {
      settings.limitReachedClosingMessage =
        'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye  AI wasim bot se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much!';
      needsSave = true;
    }
    if (settings.dailySessionStrategy === undefined) {
      settings.dailySessionStrategy = 'RESET';
      needsSave = true;
    }
    if (settings.dailyArchiveRetentionDays === undefined) {
      settings.dailyArchiveRetentionDays = 3;
      needsSave = true;
    }
    if (settings.profanityFilterEnabled === undefined) {
      settings.profanityFilterEnabled = true;
      needsSave = true;
    }
    if (!settings.profanityReplyMessage) {
      settings.profanityReplyMessage =
        'Kripya sabhya bhasha ka prayog karein. Hum yahan aadar aur maryada ke saath baat karne ke liye upasthit hain. Please maintain respectful communication.';
      needsSave = true;
    }
    if (settings.customProfanityKeywords === undefined) {
      settings.customProfanityKeywords = [];
      needsSave = true;
    }
    if (settings.imageGenerationEnabled === undefined) {
      settings.imageGenerationEnabled = true;
      needsSave = true;
    }
    if (!settings.imageGenerationModel) {
      settings.imageGenerationModel = 'black-forest-labs/FLUX.1-schnell';
      needsSave = true;
    }
    if (!settings.imageGenerationNotice) {
      settings.imageGenerationNotice = '🎨 Creating your image with AI, please wait a moment...';
      needsSave = true;
    }
    if (settings.ownerInactivityTimerEnabled === undefined) {
      settings.ownerInactivityTimerEnabled = true;
      needsSave = true;
    }
    if (settings.ownerInactivityDurationMinutes === undefined) {
      settings.ownerInactivityDurationMinutes = 15;
      needsSave = true;
    }
    if (!settings.ownerInactivityScope) {
      settings.ownerInactivityScope = 'PER_CHAT';
      needsSave = true;
    }
    if (settings.newsEnabled === undefined) {
      settings.newsEnabled = true;
      needsSave = true;
    }
    if (!settings.newsDefaultCountry) {
      settings.newsDefaultCountry = 'in';
      needsSave = true;
    }
    if (!settings.newsDefaultLanguage) {
      settings.newsDefaultLanguage = 'en';
      needsSave = true;
    }
    if (!settings.newsMaxArticles) {
      settings.newsMaxArticles = 3;
      needsSave = true;
    }
    if (settings.googleSearchEnabled === undefined) {
      settings.googleSearchEnabled = true;
      needsSave = true;
    }
    if (!settings.googleSearchCx) {
      settings.googleSearchCx = '8002fdf14f0bb4998';
      needsSave = true;
    }
    if (settings.googleSearchMaxResults === undefined) {
      settings.googleSearchMaxResults = 4;
      needsSave = true;
    }
    if (needsSave) {
      await settings.save();
    }
  }
  return settings;
};

module.exports = mongoose.model('BotSettings', botSettingsSchema);
