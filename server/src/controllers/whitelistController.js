const WhitelistContact = require('../models/WhitelistContact');
const BotSettings = require('../models/BotSettings');
const { analyzeChatSample } = require('../services/personaService');

function cleanPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits ? '+' + digits : '';
}

// Sync BotSettings.allowedPhoneNumber with WhitelistContact collection
async function syncBotSettings() {
  try {
    const contacts = await WhitelistContact.find();
    const phoneList = contacts.map((c) => c.phoneNumber).join(',');
    await BotSettings.findOneAndUpdate(
      { key: 'global_settings' },
      { allowedPhoneNumber: phoneList },
      { upsert: true }
    );
  } catch (err) {
    console.error('[WhitelistController] Failed to sync BotSettings:', err.message);
  }
}

// GET /api/whitelist
async function getContacts(req, res) {
  try {
    const contacts = await WhitelistContact.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/whitelist
async function addContact(req, res) {
  try {
    const { phoneNumber, relationship, name, notes, persona, customToneInstructions } = req.body;

    if (!phoneNumber || phoneNumber.trim() === '') {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    const formattedPhone = cleanPhone(phoneNumber);
    if (!formattedPhone || formattedPhone.length < 8) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
    }

    const cleanRelationship = (relationship || 'Friend').trim();
    const cleanName = (name || '').trim();
    const cleanNotes = (notes || '').trim();
    const cleanPersona = (persona || 'AUTO').trim();
    const cleanCustomTone = (customToneInstructions || '').trim();
    const cleanChatSample = (req.body.rawChatSample || '').trim();

    let styleProfile = undefined;
    if (cleanChatSample && cleanChatSample.length >= 20) {
      try {
        const displayName = cleanName || cleanRelationship;
        styleProfile = await analyzeChatSample(cleanChatSample, displayName, cleanRelationship);
      } catch (styleErr) {
        console.warn('[WhitelistController] Chat analysis warning on add:', styleErr.message);
      }
    }

    const updateDoc = {
      phoneNumber: formattedPhone,
      relationship: cleanRelationship,
      name: cleanName,
      notes: cleanNotes,
      persona: cleanPersona,
      customToneInstructions: cleanCustomTone,
    };

    if (styleProfile) {
      updateDoc.rawChatSample = cleanChatSample;
      updateDoc.styleProfile = styleProfile;
    }

    // Upsert contact with dynamic persona and optional style profile
    const contact = await WhitelistContact.findOneAndUpdate(
      { phoneNumber: formattedPhone },
      updateDoc,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Sync to BotSettings
    await syncBotSettings();

    res.status(201).json({
      success: true,
      message: `Contact ${formattedPhone} (${cleanRelationship}) added to whitelist.`,
      data: contact,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/whitelist/:id/analyze-chat
async function analyzeAndSaveChatStyle(req, res) {
  try {
    const { id } = req.params;
    const { chatText } = req.body;

    if (!chatText || chatText.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Chat sample text must contain at least 20 characters of conversational exchanges.',
      });
    }

    const contact = await WhitelistContact.findById(id);
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found.' });
    }

    const displayName = contact.name || contact.relationship;
    const profile = await analyzeChatSample(chatText, displayName, contact.relationship);

    contact.rawChatSample = chatText;
    contact.styleProfile = profile;
    await contact.save();

    res.json({
      success: true,
      message: `Chat style successfully analyzed and learned for ${displayName}!`,
      data: contact,
    });
  } catch (error) {
    console.error('[WhitelistController] analyzeAndSaveChatStyle error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// DELETE /api/whitelist/:id/chat-style
async function clearChatStyle(req, res) {
  try {
    const { id } = req.params;
    const contact = await WhitelistContact.findById(id);
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found.' });
    }

    contact.rawChatSample = '';
    contact.styleProfile = {
      hasCustomStyle: false,
      analyzedAt: null,
      tone: '',
      vocabulary: [],
      typingHabits: '',
      typicalPhrases: [],
      sampleSnippets: [],
      stylePromptDirective: '',
    };
    await contact.save();

    res.json({
      success: true,
      message: `Custom chat style cleared for ${contact.phoneNumber}. Reverted to standard dynamic persona.`,
      data: contact,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// DELETE /api/whitelist/:id
async function deleteContact(req, res) {
  try {
    const { id } = req.params;
    const deleted = await WhitelistContact.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Contact not found.' });
    }

    // Sync to BotSettings
    await syncBotSettings();

    res.json({
      success: true,
      message: `Contact ${deleted.phoneNumber} removed from whitelist.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getContacts,
  addContact,
  deleteContact,
  analyzeAndSaveChatStyle,
  clearChatStyle,
  syncBotSettings,
};

