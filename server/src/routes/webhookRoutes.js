const express = require('express');
const router = express.Router();
const {
  verifyWebhook,
  handleIncoming,
  handleTwilioWebhook,
} = require('../controllers/webhookController');

// GET /webhook: Verification handshake with Meta WhatsApp Cloud API
router.get('/', verifyWebhook);

// POST /webhook: Incoming event & message notifications (auto-detects Twilio or Meta)
router.post('/', handleIncoming);

// POST /webhook/twilio: Dedicated endpoint for Twilio WhatsApp Webhook
router.post('/twilio', handleTwilioWebhook);

// GET /webhook/twilio: Informational handshake endpoint for browser testing
router.get('/twilio', (req, res) => {
  res.json({
    status: 'online',
    service: 'Twilio WhatsApp Webhook Receiver',
    method: 'POST',
    accountSid: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.slice(0, 6)}...` : 'Not configured',
    instructions: 'Configure this URL as your "WHEN A MESSAGE COMES IN" webhook in Twilio Console Sandbox/Numbers settings.',
  });
});

module.exports = router;
