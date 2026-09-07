const express = require('express');
const router = express.Router();
const { verifyWebhook, handleIncoming } = require('../controllers/webhookController');

// GET /webhook: Verification handshake with Meta WhatsApp Cloud API
router.get('/', verifyWebhook);

// POST /webhook: Incoming event & message notifications
router.post('/', handleIncoming);

module.exports = router;
