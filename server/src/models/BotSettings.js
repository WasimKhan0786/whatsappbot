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
      'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nGuidelines:\n- Natural, friendly aur polite desi chat style (Hinglish me) baat karo.\n- Words use karo: "haanji", "bhai", "bolo", "boliye", "aap boliye", "arre", "theek hai".\n- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".\n- Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.',
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
        'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI assistant hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nGuidelines:\n- Natural, friendly aur polite desi chat style (Hinglish me) baat karo.\n- Words use karo: "haanji", "bhai", "bolo", "boliye", "aap boliye", "arre", "theek hai".\n- Agar koi "Assalam Walekum" ya "salam" bole, toh reply: "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".\n- Messages hamesha realistic aur short (1-2 sentences) rakho jaise aam log WhatsApp par type karte hain.',
    });
  }
  return settings;
};

module.exports = mongoose.model('BotSettings', botSettingsSchema);
