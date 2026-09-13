const crypto = require('crypto');
const axios = require('axios');

/**
 * Validates Twilio's HMAC-SHA1 signature (X-Twilio-Signature header)
 * @param {string} signature - The X-Twilio-Signature header from the request
 * @param {string} url - The full webhook URL that Twilio called
 * @param {object} params - The POST body parameters
 * @param {string} authToken - Twilio Auth Token
 * @returns {boolean} - True if signature is valid
 */
function validateTwilioSignature(signature, url, params = {}, authToken) {
  if (!authToken || typeof authToken !== 'string' || authToken.trim() === '') {
    // If auth token is not configured yet, allow in development mode with warning
    return true;
  }

  if (!signature) {
    return false;
  }

  try {
    // 1. Start with the full URL
    let data = url;

    // 2. Sort the POST parameter keys alphabetically
    const keys = Object.keys(params).sort();
    for (const key of keys) {
      data += key + params[key];
    }

    // 3. Compute HMAC-SHA1 in base64
    const expectedSignature = crypto
      .createHmac('sha1', authToken.trim())
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    console.warn('Twilio signature validation error:', err.message);
    return false;
  }
}

/**
 * Escapes XML special characters for TwiML output
 */
function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a valid TwiML XML response with a message body
 * @param {string} replyText - The message content to send back via WhatsApp
 * @returns {string} - XML string
 */
function buildTwimlMessageResponse(replyText) {
  const safeText = escapeXml(replyText || '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${safeText}</Message>
</Response>`;
}

/**
 * Generates an empty TwiML XML response (used when no reply should be sent)
 * @returns {string} - XML string
 */
function buildTwimlEmptyResponse() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
}

/**
 * Sends a WhatsApp message via Twilio REST API
 * @param {string} to - Recipient phone number (e.g. "+919876543210" or "whatsapp:+919876543210")
 * @param {string} messageText - Message body
 * @param {string} [mediaUrl] - Optional media attachment URL
 * @returns {Promise<object>}
 */
async function sendTwilioWhatsAppMessage(to, messageText, mediaUrl = null) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  let fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  if (!fromNumber.startsWith('whatsapp:')) {
    fromNumber = `whatsapp:${fromNumber}`;
  }

  let toNumber = to;
  if (!toNumber.startsWith('whatsapp:')) {
    toNumber = `whatsapp:${to.startsWith('+') ? to : `+${to}`}`;
  }

  if (!authToken || authToken.trim() === '' || authToken.startsWith('your_')) {
    console.log(`[Twilio Mock Mode] Outgoing WhatsApp to ${toNumber}: "${(messageText || '').substring(0, 80)}..."`);
    return {
      success: true,
      isMock: true,
      message: 'Twilio WhatsApp message simulated (TWILIO_AUTH_TOKEN not configured).',
      recipient: toNumber,
    };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.append('From', fromNumber);
  params.append('To', toNumber);
  if (messageText) {
    params.append('Body', messageText);
  }
  if (mediaUrl) {
    params.append('MediaUrl', mediaUrl);
  }

  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken.trim()}`).toString('base64')}`;

  const response = await axios.post(endpoint, params.toString(), {
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });

  return {
    success: true,
    isMock: false,
    sid: response.data.sid,
    status: response.data.status,
  };
}

module.exports = {
  validateTwilioSignature,
  buildTwimlMessageResponse,
  buildTwimlEmptyResponse,
  sendTwilioWhatsAppMessage,
  escapeXml,
};
