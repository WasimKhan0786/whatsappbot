const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const envPath = path.resolve(__dirname, '../../.env');

/**
 * Mask sensitive credentials for safe frontend display
 * e.g. AIzaSy••••••••1234
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string' || key.trim() === '' || key === 'YOUR_GEMINI_API_KEY') {
    return 'Not Configured';
  }
  const clean = key.trim();
  if (clean.length <= 8) {
    return '••••••••';
  }
  return `${clean.substring(0, 6)}••••••••${clean.substring(clean.length - 4)}`;
}

/**
 * Parse an .env formatted string into an object of key-value pairs
 */
function parseEnvContent(rawText) {
  const result = {};
  if (!rawText || typeof rawText !== 'string') return result;

  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let val = trimmed.substring(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      result[key] = val;
    }
  }
  return result;
}

/**
 * Serialize key-value pairs back into an .env formatted string,
 * preserving existing file comments and structure where possible.
 */
function updateEnvFile(existingText, newKeyValues) {
  const lines = existingText ? existingText.split(/\r?\n/) : [];
  const handledKeys = new Set();
  const outputLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      outputLines.push(line);
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      if (Object.prototype.hasOwnProperty.call(newKeyValues, key)) {
        outputLines.push(`${key}=${newKeyValues[key]}`);
        handledKeys.add(key);
      } else {
        outputLines.push(line);
      }
    } else {
      outputLines.push(line);
    }
  }

  // Append any new keys that were not already in the file
  for (const [key, val] of Object.entries(newKeyValues)) {
    if (!handledKeys.has(key)) {
      outputLines.push(`${key}=${val}`);
    }
  }

  return outputLines.join('\n');
}

/**
 * Live test probe to verify if a Google Gemini API key is valid
 */
async function probeGeminiApiKey(apiKey) {
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    return { isValid: false, message: 'API key is empty or placeholder.' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
    const result = await model.generateContent('ping');
    const response = await result.response;
    const text = response.text();
    return {
      isValid: true,
      message: 'Gemini API key verified successfully and is active!',
      probeResponse: (text || '').trim().substring(0, 50),
    };
  } catch (err) {
    return {
      isValid: false,
      message: `Gemini API probe failed: ${err.message}`,
    };
  }
}

/**
 * GET /api/env
 * Return masked status of the environment configuration
 */
const getEnvConfig = async (req, res) => {
  try {
    const currentGeminiKey = process.env.GEMINI_API_KEY || '';
    const hasKey = Boolean(currentGeminiKey && currentGeminiKey !== 'YOUR_GEMINI_API_KEY' && currentGeminiKey.trim() !== '');

    res.json({
      success: true,
      data: {
        hasGeminiKey: hasKey,
        maskedGeminiKey: maskApiKey(currentGeminiKey),
        allowedPhoneNumber: process.env.ALLOWED_PHONE_NUMBER || '',
        chatHistoryMaxMessages: parseInt(process.env.CHAT_HISTORY_MAX_MESSAGES, 10) || 20,
        chatSessionTtlDays: parseInt(process.env.CHAT_SESSION_TTL_DAYS, 10) || 7,
        messageLogTtlDays: parseInt(process.env.MESSAGE_LOG_TTL_DAYS, 10) || 30,
        port: process.env.PORT || 5000,
        hasWhatsAppToken: Boolean(process.env.WHATSAPP_TOKEN && !process.env.WHATSAPP_TOKEN.startsWith('mock_')),
      },
    });
  } catch (err) {
    console.error('Error in getEnvConfig:', err);
    res.status(500).json({ success: false, error: 'Failed to read environment configuration' });
  }
};

/**
 * POST /api/env
 * Dynamically update .env on disk and process.env in memory without requiring a server reboot
 */
const updateEnvConfig = async (req, res) => {
  try {
    const { geminiApiKey, envContent, envVariables } = req.body;

    const updatesToApply = {};

    // 1. Direct Gemini API Key update
    if (typeof geminiApiKey === 'string' && geminiApiKey.trim() !== '') {
      updatesToApply.GEMINI_API_KEY = geminiApiKey.trim();
    }

    // 2. Full or partial .env file upload content
    if (typeof envContent === 'string' && envContent.trim() !== '') {
      const parsedFromFile = parseEnvContent(envContent);
      Object.assign(updatesToApply, parsedFromFile);
    }

    // 3. Object-based updates
    if (envVariables && typeof envVariables === 'object') {
      for (const [k, v] of Object.entries(envVariables)) {
        if (typeof v === 'string' || typeof v === 'number') {
          updatesToApply[k] = String(v).trim();
        }
      }
    }

    if (Object.keys(updatesToApply).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid environment variables provided to update.',
      });
    }

    // 4. Hot reload process.env in memory immediately
    for (const [key, val] of Object.entries(updatesToApply)) {
      process.env[key] = val;
    }

    // 5. Read existing .env file and persist changes
    let existingEnvText = '';
    try {
      if (fs.existsSync(envPath)) {
        existingEnvText = fs.readFileSync(envPath, 'utf8');
      }
    } catch (readErr) {
      console.warn('Could not read existing .env file, will create new:', readErr.message);
    }

    const updatedEnvText = updateEnvFile(existingEnvText, updatesToApply);
    fs.writeFileSync(envPath, updatedEnvText, 'utf8');

    console.log(`[EnvController] 🔄 Environment dynamically updated (${Object.keys(updatesToApply).join(', ')}). No reboot needed.`);

    // 6. Test probe if GEMINI_API_KEY was updated
    let geminiProbeResult = null;
    if (updatesToApply.GEMINI_API_KEY) {
      geminiProbeResult = await probeGeminiApiKey(updatesToApply.GEMINI_API_KEY);
    }

    return res.json({
      success: true,
      message: 'Environment configuration updated successfully and applied dynamically!',
      updatedKeys: Object.keys(updatesToApply),
      maskedGeminiKey: maskApiKey(process.env.GEMINI_API_KEY),
      geminiProbe: geminiProbeResult,
    });
  } catch (err) {
    console.error('Error updating environment configuration:', err);
    return res.status(500).json({
      success: false,
      error: `Failed to update environment: ${err.message}`,
    });
  }
};

module.exports = {
  getEnvConfig,
  updateEnvConfig,
  probeGeminiApiKey,
  maskApiKey,
};
