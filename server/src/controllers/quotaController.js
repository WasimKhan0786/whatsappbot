const MessageLog = require('../models/MessageLog');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cache live check for 2 minutes to conserve quota
let cachedHealth = {
  lastChecked: 0,
  isHealthy: true,
  latencyMs: 350,
  activeModel: 'gemini-flash-lite-latest',
};

/**
 * GET /api/quota
 * Returns Google Gemini API quota metrics, daily usage, and remaining limits
 */
const getGeminiQuota = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasKey = Boolean(apiKey && apiKey.trim() !== '' && apiKey !== 'YOUR_GEMINI_API_KEY');

    // Google Gemini Free Tier standard limits for Flash models
    const DAILY_LIMIT = 1500;
    const RPM_LIMIT = 15;

    // Calculate today's UTC start (Google quotas reset at 00:00 UTC)
    const now = new Date();
    const todayUTCStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    // Calculate time until next UTC midnight reset
    const nextMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const diffMs = Math.max(0, nextMidnightUTC - now);
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    // Query processed messages today from MessageLog
    const usedToday = await MessageLog.countDocuments({
      status: 'PROCESSED',
      createdAt: { $gte: todayUTCStart },
    });

    const totalAllTime = await MessageLog.countDocuments({ status: 'PROCESSED' });
    const ignoredToday = await MessageLog.countDocuments({
      status: 'IGNORED_PHONE_MISMATCH',
      createdAt: { $gte: todayUTCStart },
    });

    const remainingToday = Math.max(0, DAILY_LIMIT - usedToday);
    const percentRemaining = Number(((remainingToday / DAILY_LIMIT) * 100).toFixed(1));
    const percentUsed = Number(((usedToday / DAILY_LIMIT) * 100).toFixed(1));

    // Status level
    let healthTier = 'healthy';
    if (remainingToday < 50) {
      healthTier = 'critical';
    } else if (remainingToday < 300) {
      healthTier = 'warning';
    }

    // Optional quick ping if cache expired (older than 2 minutes)
    const nowTime = Date.now();
    if (hasKey && nowTime - cachedHealth.lastChecked > 120000) {
      try {
        const startPing = Date.now();
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
        await model.generateContent('ping');
        cachedHealth = {
          lastChecked: nowTime,
          isHealthy: true,
          latencyMs: Date.now() - startPing,
          activeModel: 'gemini-flash-lite-latest',
        };
      } catch (err) {
        cachedHealth = {
          lastChecked: nowTime,
          isHealthy: false,
          latencyMs: null,
          activeModel: 'gemini-flash-latest (failover)',
        };
      }
    }

    res.json({
      success: true,
      data: {
        hasKey,
        dailyLimit: DAILY_LIMIT,
        usedToday,
        remainingToday,
        percentRemaining,
        percentUsed,
        rpmLimit: RPM_LIMIT,
        resetIn: `${diffHours}h ${diffMinutes}m`,
        healthTier,
        isHealthy: cachedHealth.isHealthy,
        latencyMs: cachedHealth.latencyMs,
        activeModel: cachedHealth.activeModel,
        failoverModels: [
          'gemini-flash-lite-latest',
          'gemini-flash-latest',
          'gemini-3.1-flash-lite',
          'gemini-3.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-3.7-flash',
          'gemini-3.8-flash',
        ],
        stats: {
          totalAllTime,
          ignoredToday,
        },
      },
    });
  } catch (error) {
    console.error('Error in getGeminiQuota:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quota metrics',
    });
  }
};

module.exports = {
  getGeminiQuota,
};
