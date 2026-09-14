const axios = require('axios');

const NASA_BASE_URL = 'https://api.nasa.gov';

/**
 * Resolves the NASA API Key from environment variables
 * @returns {string}
 */
function getNasaApiKey() {
  return (process.env.NASA_API_KEY || 'DEMO_KEY').trim();
}

/**
 * Fetches NASA Astronomy Picture of the Day (APOD)
 * @param {object} [options]
 * @param {string} [options.date] - Optional date in YYYY-MM-DD format
 * @param {number} [options.count] - Optional number of random pictures to fetch
 * @returns {Promise<{ success: boolean, title?: string, date?: string, explanation?: string, mediaType?: string, imageUrl?: string, hdUrl?: string, copyright?: string, error?: string }>}
 */
async function fetchNasaApod(options = {}) {
  const apiKey = getNasaApiKey();
  const params = { api_key: apiKey };

  if (options.date) params.date = options.date;
  if (options.count) params.count = options.count;

  try {
    const response = await axios.get(`${NASA_BASE_URL}/planetary/apod`, {
      params,
      timeout: 12000,
    });

    const data = response.data;
    // If count parameter was used, data will be an array
    const item = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      title: item.title || 'Astronomy Picture of the Day',
      date: item.date || new Date().toISOString().split('T')[0],
      explanation: item.explanation || '',
      mediaType: item.media_type || 'image', // 'image' or 'video'
      imageUrl: item.url || item.hdurl || '',
      hdUrl: item.hdurl || item.url || '',
      copyright: item.copyright ? item.copyright.trim() : 'NASA / APOD',
    };
  } catch (err) {
    console.error('[NASA APOD] Fetch error:', err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data?.error?.message || err.message,
    };
  }
}

/**
 * Fetches Near Earth Objects (Asteroids) approaching Earth today
 * @returns {Promise<{ success: boolean, count?: number, nearestAsteroid?: object, asteroids?: Array, error?: string }>}
 */
async function fetchNearEarthObjects() {
  const apiKey = getNasaApiKey();
  const today = new Date().toISOString().split('T')[0];

  try {
    const response = await axios.get(`${NASA_BASE_URL}/neo/rest/v1/feed`, {
      params: {
        api_key: apiKey,
        start_date: today,
        end_date: today,
      },
      timeout: 12000,
    });

    const data = response.data;
    const todayObjects = data.near_earth_objects?.[today] || [];
    const count = data.element_count || todayObjects.length;

    const asteroids = todayObjects.map((ast) => {
      const closeApproach = ast.close_approach_data?.[0] || {};
      return {
        name: ast.name,
        isPotentiallyHazardous: Boolean(ast.is_potentially_hazardous_asteroid),
        diameterMeters: Math.round(ast.estimated_diameter?.meters?.estimated_diameter_max || 0),
        missDistanceKm: Math.round(Number(closeApproach.miss_distance?.kilometers || 0)),
        velocityKmH: Math.round(Number(closeApproach.relative_velocity?.kilometers_per_hour || 0)),
      };
    });

    // Find closest asteroid
    const nearestAsteroid = asteroids.length > 0
      ? asteroids.reduce((prev, curr) => (prev.missDistanceKm < curr.missDistanceKm ? prev : curr))
      : null;

    return {
      success: true,
      date: today,
      count,
      nearestAsteroid,
      asteroids: asteroids.slice(0, 5),
    };
  } catch (err) {
    console.error('[NASA NEO] Fetch error:', err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data?.error?.message || err.message,
    };
  }
}

/**
 * Analyzes incoming message text to detect NASA / space queries
 * @param {string} text 
 * @returns {{ isNasaRequest: boolean, type: 'APOD' | 'ASTEROID' | 'GENERAL' }}
 */
function extractNasaRequest(text) {
  if (!text || typeof text !== 'string') {
    return { isNasaRequest: false, type: 'GENERAL' };
  }

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Explicit commands: /nasa, /space, /apod, /asteroid
  if (/^[\/!](nasa|apod|space|spacepic)$/i.test(trimmed)) {
    return { isNasaRequest: true, type: 'APOD' };
  }
  if (/^[\/!](asteroid|asteroids|meteor|meteors)$/i.test(trimmed)) {
    return { isNasaRequest: true, type: 'ASTEROID' };
  }

  // 2. Natural language phrases for Astronomy Picture / NASA Photo
  if (
    lower.includes('nasa photo') ||
    lower.includes('nasa picture') ||
    lower.includes('space photo') ||
    lower.includes('space picture') ||
    lower.includes('astronomy picture') ||
    lower.includes('picture of the day') ||
    lower.includes('aaj ki space photo') ||
    lower.includes('aaj ki nasa photo') ||
    lower.includes('nasa ki photo') ||
    lower.includes('space pic') ||
    lower.includes('antariksh photo') ||
    lower.includes('universe photo')
  ) {
    return { isNasaRequest: true, type: 'APOD' };
  }

  // 3. Natural language phrases for Asteroids
  if (
    lower.includes('asteroid') ||
    lower.includes('asteroids') ||
    lower.includes('near earth object') ||
    lower.includes('dhartee ke paas asteroid') ||
    lower.includes('dharti ke paas asteroid')
  ) {
    return { isNasaRequest: true, type: 'ASTEROID' };
  }

  return { isNasaRequest: false, type: 'GENERAL' };
}

/**
 * Formats NASA APOD data for clean WhatsApp presentation
 * @param {object} apod 
 * @returns {string}
 */
function formatNasaApodForWhatsApp(apod) {
  if (!apod || !apod.success) {
    return '🚀 *NASA Space Explorer*\n\nMaaf kijiye, is samay NASA se image fetch karne me samasya aayi. Kripya thodi der baad dobara koshish karein.';
  }

  let formatted = `🌌 *NASA Astronomy Picture of the Day*\n`;
  formatted += `📅 *Date:* ${apod.date}\n`;
  formatted += `✨ *Title:* ${apod.title}\n`;
  if (apod.copyright && apod.copyright !== 'NASA / APOD') {
    formatted += `📸 *Credit:* ${apod.copyright}\n`;
  }
  formatted += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Provide a neat summary of the explanation (max 350 chars for WhatsApp readability)
  if (apod.explanation) {
    const cleanExp = apod.explanation.replace(/\s+/g, ' ').trim();
    const shortExp = cleanExp.length > 350 ? cleanExp.substring(0, 350) + '...' : cleanExp;
    formatted += `📖 *Explanation:*\n_${shortExp}_\n\n`;
  }

  if (apod.hdUrl && apod.mediaType === 'image') {
    formatted += `🔭 *Full HD View:* ${apod.hdUrl}\n`;
  } else if (apod.mediaType === 'video' && apod.imageUrl) {
    formatted += `🎬 *Watch Video:* ${apod.imageUrl}\n`;
  }

  formatted += `\n_Powered by NASA Open APIs 🚀_`;
  return formatted.trim();
}

/**
 * Formats NASA Near Earth Objects (Asteroid) data for WhatsApp
 * @param {object} neoData 
 * @returns {string}
 */
function formatNasaNeoForWhatsApp(neoData) {
  if (!neoData || !neoData.success) {
    return '☄️ *NASA Asteroid Tracker*\n\nMaaf kijiye, asteroid data fetch karne me dikkat aayi.';
  }

  let formatted = `☄️ *NASA Near-Earth Asteroids Tracker*\n`;
  formatted += `📅 *Today's Date:* ${neoData.date}\n`;
  formatted += `🛰️ *Asteroids Passing Earth Today:* ${neoData.count}\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (neoData.nearestAsteroid) {
    const near = neoData.nearestAsteroid;
    formatted += `🎯 *Closest Approach Today:*\n`;
    formatted += `• *Name:* ${near.name}\n`;
    formatted += `• *Est. Diameter:* ~${near.diameterMeters} meters\n`;
    formatted += `• *Miss Distance:* ~${(near.missDistanceKm / 1000000).toFixed(2)} million km\n`;
    formatted += `• *Velocity:* ~${Math.round(near.velocityKmH).toLocaleString()} km/h\n`;
    formatted += `• *Hazard Status:* ${near.isPotentiallyHazardous ? '⚠️ Potentially Hazardous' : '✅ Safe (No Danger)'}\n\n`;
  }

  if (Array.isArray(neoData.asteroids) && neoData.asteroids.length > 1) {
    formatted += `📋 *Other Notable Asteroids Today:*\n`;
    neoData.asteroids.slice(1, 4).forEach((ast, idx) => {
      formatted += `${idx + 1}. *${ast.name}* (~${ast.diameterMeters}m, ~${(ast.missDistanceKm / 1000000).toFixed(2)}M km away)\n`;
    });
    formatted += `\n`;
  }

  formatted += `_Powered by NASA Planetary Defense & NeoWs 🛡️_`;
  return formatted.trim();
}

module.exports = {
  fetchNasaApod,
  fetchNearEarthObjects,
  extractNasaRequest,
  formatNasaApodForWhatsApp,
  formatNasaNeoForWhatsApp,
};
