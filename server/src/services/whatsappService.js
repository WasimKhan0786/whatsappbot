const axios = require('axios');

/**
 * Send WhatsApp text message via Meta WhatsApp Cloud API
 * @param {string} to - Recipient phone number in international format (e.g. 15551234567)
 * @param {string} messageText - Message body to send
 * @returns {Promise<object>} - Cloud API response
 */
async function sendWhatsAppMessage(to, messageText) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Clean phone number: remove non-digits
  const cleanRecipient = to.replace(/\D/g, '');

  // Check if credentials are real or placeholder
  const isMockToken = !token || token.includes('your_meta') || token.startsWith('mock_');
  const isMockPhoneId = !phoneNumberId || phoneNumberId === '100000000000000' || phoneNumberId === '123456789012345';

  if (isMockToken || isMockPhoneId) {
    console.log(`[WhatsApp Mock Mode] Outgoing message to ${cleanRecipient}: "${messageText.substring(0, 80)}..."`);
    return {
      success: true,
      isMock: true,
      message: 'WhatsApp message simulated successfully (Meta Cloud API credentials not yet configured).',
      recipient: cleanRecipient,
    };
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanRecipient,
    type: 'text',
    text: {
      preview_url: false,
      body: messageText,
    },
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return {
      success: true,
      isMock: false,
      data: response.data,
    };
  } catch (error) {
    const errorDetail = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`Failed to send WhatsApp message to ${cleanRecipient}:`, errorDetail);
    throw new Error(`WhatsApp Cloud API error: ${errorDetail}`);
  }
}

module.exports = {
  sendWhatsAppMessage,
};
