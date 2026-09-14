const axios = require('axios');

const REMOVE_BG_API_URL = 'https://api.remove.bg/v1.0/removebg';

/**
 * Checks if user is asking to remove photo background
 * @param {string} text - Message text or caption
 * @param {object|null} mediaDetails - Attached media info
 * @returns {boolean}
 */
function isBackgroundRemovalRequested(text = '', mediaDetails = null) {
  if (!text || typeof text !== 'string') return false;

  const lower = text.toLowerCase();
  const hasBgCommand =
    /\b(background hata|remove bg|bg remove|background remove|transparent bg|remove background|bg hata do|photo ka background)\b/i.test(lower) ||
    lower.includes('/bgremove') ||
    lower.includes('/removebg');

  return hasBgCommand;
}

/**
 * Removes image background using Remove.bg API
 * @param {Buffer} imageBuffer - Source image binary buffer
 * @returns {Promise<{ success: boolean, transparentBuffer: Buffer|null, isQuotaExhausted: boolean, error?: string }>}
 */
async function removeImageBackground(imageBuffer) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey || !imageBuffer || apiKey.includes('your_')) {
    return { success: false, transparentBuffer: null, isQuotaExhausted: false, error: 'API key missing' };
  }

  try {
    console.log(`[Remove.bg] ✂️ Processing image background removal (${imageBuffer.length} bytes)...`);

    const response = await axios.post(
      REMOVE_BG_API_URL,
      {
        image_file_b64: imageBuffer.toString('base64'),
        size: 'regular',
      },
      {
        headers: {
          'X-Api-Key': apiKey.trim(),
          'Content-Type': 'application/json',
          Accept: 'image/png',
        },
        responseType: 'arraybuffer',
        timeout: 25000,
      }
    );

    const transparentBuffer = Buffer.from(response.data);
    console.log(`[Remove.bg] ✅ Background removed successfully (${transparentBuffer.length} bytes PNG)`);

    return {
      success: true,
      transparentBuffer,
      isQuotaExhausted: false,
    };
  } catch (err) {
    const status = err.response?.status;
    const isQuota = status === 402 || status === 429;
    console.warn(`[Remove.bg] API notice [Status: ${status}]:`, err.message);

    return {
      success: false,
      transparentBuffer: null,
      isQuotaExhausted: isQuota,
      error: err.message,
    };
  }
}

module.exports = {
  isBackgroundRemovalRequested,
  removeImageBackground,
};
