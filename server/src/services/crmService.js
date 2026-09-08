const { GoogleGenerativeAI } = require('@google/generative-ai');
const WhitelistContact = require('../models/WhitelistContact');

/**
 * Analyzes incoming message text & history to classify sentiment, intent, and lead tag.
 * Automatically updates or creates the WhitelistContact record in MongoDB Atlas.
 * 
 * @param {string} phoneNumber - Sender's phone number
 * @param {string} incomingMessageText - The text sent by the customer
 * @param {Array} chatHistory - Optional recent chat exchange history
 * @returns {Promise<object>} Analyzed CRM classification object
 */
async function analyzeAndTagContact(phoneNumber, incomingMessageText, chatHistory = []) {
  if (!phoneNumber || !incomingMessageText || incomingMessageText.trim() === '') {
    return null;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const cleanPhone = phoneNumber.trim();

  let classification = {
    sentiment: 'NEUTRAL',
    crmTag: 'NEUTRAL',
    intentSummary: incomingMessageText.substring(0, 100),
  };

  // Rule-based heuristic shortcuts for fast tagging before AI evaluation
  const lowerMsg = incomingMessageText.toLowerCase();

  if (/\b(price|cost|kitne ka hai|rate|buy|kharidna|quotation|catalog|pricing|order)\b/i.test(lowerMsg)) {
    classification.crmTag = 'HOT_LEAD';
    classification.sentiment = 'INTERESTED';
  } else if (/\b(urgent|asap|turant|immediately|issue|problem|kahna|kharab|not working|broken|refund|scam)\b/i.test(lowerMsg)) {
    classification.crmTag = 'SUPPORT_COMPLAINT';
    classification.sentiment = 'FRUSTRATED';
  } else if (/\b(thanks|thank you|shukriya|great|awesome|dhanyawad|love it|superb)\b/i.test(lowerMsg)) {
    classification.sentiment = 'HAPPY';
  }

  // If Gemini API Key is available, perform deep AI classification
  if (apiKey && apiKey.trim() !== '' && apiKey !== 'YOUR_GEMINI_API_KEY') {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

      const prompt = `You are a CRM Lead Classifier and Customer Sentiment Analyzer.
Analyze the following WhatsApp message from a customer and classify it precisely.

Customer Message: "${incomingMessageText}"

Return ONLY a valid JSON object in the following format (no markdown formatting, no code blocks):
{
  "sentiment": "HAPPY" | "INTERESTED" | "NEUTRAL" | "FRUSTRATED",
  "crmTag": "HOT_LEAD" | "HIGH_PRIORITY" | "SUPPORT_COMPLAINT" | "COLD_LEAD" | "NEUTRAL",
  "intentSummary": "A concise 1-sentence summary of customer request or intent"
}

Guidelines for Tags:
- HOT_LEAD: High purchase intent, asking about pricing, demo, catalogs, payment options, or wanting to buy.
- SUPPORT_COMPLAINT: Reporting bugs, complaints, bad experience, refund requests, or urgent help.
- HIGH_PRIORITY: High-value inquiries, VIP clients, explicit urgent meeting requests.
- COLD_LEAD: Low interest, single word casual responses, unsubscribing or declining.
- NEUTRAL: General greeting, casual chat, chit-chat, or ambiguous text.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Clean markdown fencing if returned by Gemini
      const cleanJsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      if (parsed.sentiment) classification.sentiment = parsed.sentiment.toUpperCase();
      if (parsed.crmTag) classification.crmTag = parsed.crmTag.toUpperCase();
      if (parsed.intentSummary) classification.intentSummary = parsed.intentSummary;
    } catch (err) {
      console.warn(`[CRM Classifier] Gemini AI classification note:`, err.message);
    }
  }

  // Find or create contact in WhitelistContact model
  try {
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    let contact = await WhitelistContact.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: '+' + cleanDigits },
      ],
    });

    if (!contact && cleanDigits) {
      const allContacts = await WhitelistContact.find();
      contact = allContacts.find((c) => {
        const cClean = c.phoneNumber.replace(/\D/g, '');
        return cleanDigits === cClean || cleanDigits.endsWith(cClean) || cClean.endsWith(cleanDigits);
      });
    }

    if (contact) {
      contact.crmTag = classification.crmTag;
      contact.sentimentScore = classification.sentiment;
      contact.intentSummary = classification.intentSummary;
      contact.crmUpdatedAt = new Date();
      await contact.save();
      console.log(`[CRM Lead Board] 🏷️ Contact ${contact.phoneNumber} updated: Tag=[${classification.crmTag}] | Sentiment=[${classification.sentiment}]`);
    } else {
      // Auto-create new contact entry for CRM dashboard tracking
      contact = await WhitelistContact.create({
        phoneNumber: cleanPhone.startsWith('+') ? cleanPhone : '+' + cleanPhone.replace(/\D/g, ''),
        name: `Customer (${cleanPhone.slice(-4)})`,
        relationship: 'Customer/Lead',
        persona: 'AUTO',
        crmTag: classification.crmTag,
        sentimentScore: classification.sentiment,
        intentSummary: classification.intentSummary,
        crmUpdatedAt: new Date(),
      });
      console.log(`[CRM Lead Board] 🆕 Auto-created CRM contact for ${phoneNumber}: Tag=[${classification.crmTag}]`);
    }

    return classification;
  } catch (dbErr) {
    console.error('[CRM Lead Board] Error updating DB contact:', dbErr.message);
    return classification;
  }
}

module.exports = {
  analyzeAndTagContact,
};
