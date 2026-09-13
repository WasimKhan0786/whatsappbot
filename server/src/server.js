const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const webhookRoutes = require('./routes/webhookRoutes');
const apiRoutes = require('./routes/apiRoutes');
const whatsappWebRoutes = require('./routes/whatsappWebRoutes');
const locationRoutes = require('./routes/locationRoutes');
const { initBaileys } = require('./services/baileysService');
const { seedDefaultSchedules } = require('./services/scheduleService');
const { runDailySessionArchiver } = require('./services/chatHistoryService');
const { handleFatalError } = require('./services/errorRecoveryService');
const { seedDefaultRoutineTemplates } = require('./services/messageRoutingService');

// Load environment variables
dotenv.config();

// Global Uncaught Exception & Promise Rejection Supervisors
process.on('uncaughtException', async (err) => {
  console.error('🔥 [Process Supervisor] Uncaught Exception intercepted:', err?.message || err);
  try {
    await handleFatalError(err, 'UNCAUGHT_EXCEPTION');
  } catch (supervisorErr) {
    console.error('Fatal failure inside error supervisor:', supervisorErr.message);
  }
});

process.on('unhandledRejection', async (reason) => {
  console.error('🔥 [Process Supervisor] Unhandled Promise Rejection intercepted:', reason?.message || reason);
  try {
    await handleFatalError(reason, 'UNHANDLED_REJECTION');
  } catch (supervisorErr) {
    console.error('Fatal failure inside error supervisor:', supervisorErr.message);
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB().then(() => {
  seedDefaultSchedules();
  seedDefaultRoutineTemplates();
  runDailySessionArchiver();

  // Periodic daily session archiver ticker (runs every 15 minutes to guarantee timely midnight rollovers)
  setInterval(async () => {
    try {
      await runDailySessionArchiver();
    } catch (e) {
      console.warn('[DailySessionManager] Background tick error:', e.message);
    }
  }, 15 * 60 * 1000);
});

// Middleware
app.use(cors({
  origin: '*', // Allow dashboard access
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Mount Routes
app.use('/webhook', webhookRoutes);
app.use('/api', apiRoutes);
app.use('/api/whatsapp-web', whatsappWebRoutes);
app.use('/api/location', locationRoutes);

// Serve generated AI images statically
const generatedImagesPath = path.resolve(__dirname, '../public/generated_images');
if (!fs.existsSync(generatedImagesPath)) {
  fs.mkdirSync(generatedImagesPath, { recursive: true });
}
app.use('/generated-images', express.static(generatedImagesPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve built React client in production / standalone deployment
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[Static] Serving React frontend from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Root API info endpoint when client is not built
  app.get('/', (req, res) => {
    res.json({
      service: 'WhatsApp AI Automation Server',
      status: 'running',
      endpoints: {
        whatsappWeb: '/api/whatsapp-web/status',
        webhook: '/webhook',
        settings: '/api/settings',
        logs: '/api/logs',
        health: '/health',
      },
    });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);

  // Notify recovery supervisor of server-level unhandled 500 error
  handleFatalError(err, 'API_FAILURE').catch(() => {});

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`
======================================================
🚀 WhatsApp Cloud API & Gemini Bot Server is running!
📡 Port:           ${PORT}
🌐 Base URL:       http://localhost:${PORT}
🔗 Webhook URL:    http://localhost:${PORT}/webhook
⚙️ Settings API:   http://localhost:${PORT}/api/settings
📱 WhatsApp Web:   http://localhost:${PORT}/api/whatsapp-web/status
======================================================
  `);

  // Initialize WhatsApp Web (Baileys) Socket Connection
  initBaileys();
});
