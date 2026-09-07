const express = require('express');
const router = express.Router();
const { getStatus, logout, initBaileys } = require('../services/baileysService');

// GET /api/whatsapp-web/status
router.get('/status', (req, res) => {
  try {
    const status = getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/whatsapp-web/logout
router.post('/logout', async (req, res) => {
  try {
    const result = await logout();
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/whatsapp-web/restart
router.post('/restart', async (req, res) => {
  try {
    await initBaileys(true);
    res.json({
      success: true,
      message: 'WhatsApp Web service restarting...',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
