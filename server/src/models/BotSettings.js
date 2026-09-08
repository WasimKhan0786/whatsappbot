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
  allowedPhoneNumber: {
    type: String,
    default: '+1234567890',
    trim: true,
  },
  systemPrompt: {
    type: String,
    default:
      'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nCore Conversational & Mirroring Rules:\n- Analyze the incoming message for its language, tone, and style, and generate a response that matches them perfectly, ensuring the interaction feels natural and consistent with the user\'s input.\n- Language Mirroring: If the user writes in English, reply in natural fluent English. If in Hinglish, reply in Hinglish. If in Hindi (Devanagari script) or another language, reply in that exact script/language.\n- Tone & Cadence Mirroring: Match the emotional register (casual banter, courteous respect, professional, or empathetic). Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.\n- Provide short, precise, and clear answers to all general knowledge and informational questions, avoiding unnecessary details while ensuring accuracy and clarity.\n- Identify the requested shayari category—such as romantic, emotional, or motivational—and generate a fitting shayari based on the user\'s specific choice.\n- When the user asks to play a text game or sends \'/game\', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone. When the user sends \'/exit\', immediately stop the game and return to your natural conversational behaviour.\n- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".',
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
      'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke AI WhatsApp Assistant se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much! ✨',
    trim: true,
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
      allowedPhoneNumber: process.env.ALLOWED_PHONE_NUMBER || '',
      systemPrompt:
        'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nCore Conversational & Mirroring Rules:\n- Analyze the incoming message for its language, tone, and style, and generate a response that matches them perfectly, ensuring the interaction feels natural and consistent with the user\'s input.\n- Language Mirroring: If the user writes in English, reply in natural fluent English. If in Hinglish, reply in Hinglish. If in Hindi (Devanagari script) or another language, reply in that exact script/language.\n- Tone & Cadence Mirroring: Match the emotional register (casual banter, courteous respect, professional, or empathetic). Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.\n- Provide short, precise, and clear answers to all general knowledge and informational questions, avoiding unnecessary details while ensuring accuracy and clarity.\n- Identify the requested shayari category—such as romantic, emotional, or motivational—and generate a fitting shayari based on the user\'s specific choice.\n- When the user asks to play a text game or sends \'/game\', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone. When the user sends \'/exit\', immediately stop the game and return to your natural conversational behaviour.\n- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".',
      limitReachedClosingMessage:
        'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke AI WhatsApp Assistant se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much! ✨',
    });
  } else {
    let needsSave = false;
    if (!settings.systemPrompt.includes('/game')) {
      settings.systemPrompt += '\n- When the user asks to play a text game or sends \'/game\', display a numbered menu with text-based games like Trivia, Riddles, Two Truths and a Lie, or Romantic Games, and conduct the chosen game with a fun, engaging, and casual tone. When the user sends \'/exit\', immediately stop the game and return to your natural conversational behaviour.';
      needsSave = true;
    }
    if (!settings.limitReachedClosingMessage) {
      settings.limitReachedClosingMessage =
        'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke AI WhatsApp Assistant se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much! ✨';
      needsSave = true;
    }
    if (needsSave) {
      await settings.save();
    }
  }
  return settings;
};

module.exports = mongoose.model('BotSettings', botSettingsSchema);
