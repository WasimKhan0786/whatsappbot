const axios = require('axios');

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Resolves OpenWeatherMap API Key from environment variables
 * @returns {string}
 */
function getApiKey() {
  return (process.env.OPENWEATHER_API_KEY || '').trim();
}

const INDIAN_REGIONS = [
  'bihar', 'up', 'uttar pradesh', 'mp', 'madhya pradesh', 'maharashtra',
  'rajasthan', 'punjab', 'gujarat', 'haryana', 'jharkhand', 'bengal',
  'west bengal', 'karnataka', 'kerala', 'tamil nadu', 'telangana',
  'andhra pradesh', 'odisha', 'delhi', 'assam', 'india', 'district', 'dist',
];

/**
 * Fetches current weather for a city name or coordinates with multi-tiered resolution
 * @param {object} params
 * @param {string} [params.city] - City name (e.g. 'Delhi', 'Mumbai,IN', 'Siwan Bihar')
 * @param {number} [params.lat] - Latitude coordinate
 * @param {number} [params.lon] - Longitude coordinate
 * @param {string} [params.units='metric'] - Units ('metric' for Celsius, 'imperial' for Fahrenheit)
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
async function fetchCurrentWeather({ city, lat, lon, units = 'metric' } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'OPENWEATHER_API_KEY is not configured in .env',
    };
  }

  // If coordinates provided, direct query
  if (lat !== undefined && lon !== undefined) {
    try {
      const response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
        params: { appid: apiKey, lat, lon, units },
        timeout: 10000,
      });
      return formatWeatherPayload(response.data);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  if (!city || !city.trim()) {
    return { success: false, error: 'City name or coordinates are required' };
  }

  const rawCity = city.trim();
  const candidates = [rawCity];

  // Derive cleaned variations (e.g. "Siwan Bihar" -> "Siwan", "Siwan,IN")
  let stripped = rawCity;
  for (const reg of INDIAN_REGIONS) {
    const r = new RegExp(`\\b${reg}\\b`, 'gi');
    stripped = stripped.replace(r, '').trim();
  }
  if (stripped && stripped.toLowerCase() !== rawCity.toLowerCase()) {
    candidates.push(stripped);
    candidates.push(`${stripped},IN`);
  }

  if (rawCity.includes(' ')) {
    const firstWord = rawCity.split(' ')[0].trim();
    if (firstWord && !candidates.includes(firstWord)) {
      candidates.push(firstWord);
      candidates.push(`${firstWord},IN`);
    }
  }

  let lastError = null;

  for (const queryCity of candidates) {
    try {
      const response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
        params: { appid: apiKey, q: queryCity, units },
        timeout: 10000,
      });
      return formatWeatherPayload(response.data);
    } catch (err) {
      lastError = err.response?.data?.message || err.message;
    }
  }

  return {
    success: false,
    error: lastError || 'City not found',
  };
}

/**
 * Normalizes OpenWeather raw API response
 */
function formatWeatherPayload(d) {
  const weatherObj = d.weather?.[0] || {};
  const main = d.main || {};
  const wind = d.wind || {};
  const sys = d.sys || {};

  return {
    success: true,
    city: d.name,
    country: sys.country || '',
    temp: Math.round(main.temp),
    feelsLike: Math.round(main.feels_like),
    tempMin: Math.round(main.temp_min),
    tempMax: Math.round(main.temp_max),
    humidity: main.humidity,
    pressure: main.pressure,
    condition: weatherObj.main || 'Clear',
    description: weatherObj.description || '',
    icon: weatherObj.icon || '01d',
    windSpeed: wind.speed || 0, // m/s
    windDeg: wind.deg || 0,
    visibilityKm: d.visibility ? (d.visibility / 1000).toFixed(1) : '10',
    sunrise: sys.sunrise ? new Date(sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    sunset: sys.sunset ? new Date(sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  };
}

/**
 * Helper to clean filler words from extracted city candidate
 */
function cleanExtractedCity(raw) {
  if (!raw) return '';
  let c = raw.trim().replace(/[?.!,]+/g, '').trim();
  // Remove trailing filler words (kaisa, hai, h, batao, update, today, aaj, etc.)
  c = c.replace(/\s+(kaisa|kya|hai|h|batao|update|today|aaj|now|report|info|details|rahega|bataiye)$/gi, '').trim();
  return c;
}

/**
 * Extracts a city and weather intent from incoming message text
 * Supports /weather, /mausam, "Siwan Bihar ka weather kaisa h", "mumbai ka mausam", etc.
 * @param {string} text 
 * @returns {{ isWeatherRequest: boolean, city: string }}
 */
function extractWeatherQuery(text) {
  if (!text || typeof text !== 'string') {
    return { isWeatherRequest: false, city: '' };
  }

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Explicit commands: /weather <city>, /mausam <city>
  const cmdMatch = trimmed.match(/^[\/!](weather|mausam)\s*(.*)$/i);
  if (cmdMatch) {
    const city = cleanExtractedCity(cmdMatch[2]) || 'Delhi';
    return { isWeatherRequest: true, city };
  }

  // 2. Pattern: <city> [ka|me|mein|ki]? (weather|mausam|temperature|temp) ...
  // Example: "Siwan Bihar ka weather kaisa h", "Delhi me mausam kaisa hai", "Mumbai weather"
  const cityLeadMatch = trimmed.match(/^([a-zA-Z\s]+?)\s+(?:ka|me|mein|ki|ke)?\s*(?:weather|mausam|temperature|temp|barish)(?:\s+(?:kaisa|kya|batao|bataiye|h|hai|update|report|status|rahega|chal\s*raha|ho\s*rahi).*|\s*)$/i);
  if (cityLeadMatch && cityLeadMatch[1].trim()) {
    const candidate = cleanExtractedCity(cityLeadMatch[1]);
    if (candidate && !['aaj', 'kal', 'wahan', 'abhi'].includes(candidate.toLowerCase())) {
      return { isWeatherRequest: true, city: candidate };
    }
  }

  // 3. Pattern: (weather|temperature|mausam|temp|forecast) of/in/for/at/ka/me <city>
  // Example: "weather in Patna", "temperature of Mumbai", "mausam in Siwan"
  const prepMatch = trimmed.match(/(?:weather|temperature|mausam|temp|forecast)\s+(?:in|of|for|at|ka|ki|me|mein)\s+([a-zA-Z\s]+)/i);
  if (prepMatch && prepMatch[1].trim()) {
    const candidate = cleanExtractedCity(prepMatch[1]);
    if (candidate) {
      return { isWeatherRequest: true, city: candidate };
    }
  }

  // 4. Pattern: kaisa (hai|h) weather/mausam in/of/ka <city>
  const kaisaMatch = trimmed.match(/(?:kaisa\s+(?:hai|h)\s+(?:weather|mausam)|mausam\s+kaisa\s+(?:hai|h)|weather\s+kaisa\s+(?:hai|h))\s+(?:in|of|ka|me|mein)\s+([a-zA-Z\s]+)/i);
  if (kaisaMatch && kaisaMatch[1].trim()) {
    const candidate = cleanExtractedCity(kaisaMatch[1]);
    if (candidate) {
      return { isWeatherRequest: true, city: candidate };
    }
  }

  // 5. English city weather format: "Delhi weather", "Kolkata temperature"
  const enCityMatch = trimmed.match(/^([a-zA-Z\s]+)\s+(?:weather|temperature|temp|forecast)[?.!]?$/i);
  if (enCityMatch && enCityMatch[1].trim()) {
    const candidate = cleanExtractedCity(enCityMatch[1]);
    if (candidate && !['today', 'tomorrow', 'current', 'live'].includes(candidate.toLowerCase())) {
      return { isWeatherRequest: true, city: candidate };
    }
  }

  // 6. Broad sentence check if word weather or mausam is used with a city
  if (/\b(weather|mausam|temperature)\b/i.test(trimmed)) {
    const words = trimmed.split(/\s+/).filter(w => !['ka', 'ki', 'ke', 'me', 'mein', 'kaisa', 'kya', 'hai', 'h', 'weather', 'mausam', 'temperature', 'temp', 'batao', 'bataiye', 'aaj', 'kal', 'the', 'in', 'of', 'for', 'is', 'what', 'how'].includes(w.toLowerCase().replace(/[?.!,]/g, '')));
    if (words.length > 0) {
      const candidate = cleanExtractedCity(words.join(' '));
      if (candidate) {
        return { isWeatherRequest: true, city: candidate };
      }
    }
    return { isWeatherRequest: true, city: 'Delhi' };
  }

  // 4. Standalone "weather" or "mausam" without city defaults to Delhi
  if (/^(weather|mausam|aaj ka mausam)[?.!]?$/i.test(trimmed)) {
    return { isWeatherRequest: true, city: 'Delhi' };
  }

  return { isWeatherRequest: false, city: '' };
}

/**
 * Maps weather condition to appropriate Emoji
 * @param {string} condition 
 * @returns {string}
 */
function getWeatherEmoji(condition) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
  if (c.includes('thunder') || c.includes('storm')) return '⛈️';
  if (c.includes('snow')) return '❄️';
  if (c.includes('cloud')) return '☁️';
  if (c.includes('clear')) return '☀️';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze') || c.includes('smoke')) return '🌫️';
  return '🌤️';
}

/**
 * Formats weather data into clean, readable WhatsApp Markdown
 * @param {object} w 
 * @param {string} [requestedCity]
 * @returns {string}
 */
function formatWeatherForWhatsApp(w, requestedCity = '') {
  if (!w || !w.success) {
    const cityNote = requestedCity ? ` for "${requestedCity}"` : '';
    return `🌦️ *Weather Forecast*\n\nMaaf kijiye, weather details fetch nahi ho paayi${cityNote}: ${w?.error || 'City not found'}. Kripya city ka naam sahi se check karein (e.g. */weather Delhi* ya *weather in Mumbai*).`;
  }

  const emoji = getWeatherEmoji(w.condition);
  const locationName = w.country ? `${w.city}, ${w.country}` : w.city;

  let out = `${emoji} *Live Weather: ${locationName}*\n`;
  out += `━━━━━━━━━━━━━━━━━━━━━\n`;
  out += `🌡️ *Temperature:* ${w.temp}°C (Feels like: ${w.feelsLike}°C)\n`;
  out += `🌥️ *Condition:* ${w.description ? w.description.charAt(0).toUpperCase() + w.description.slice(1) : w.condition}\n`;
  out += `📊 *Range:* ${w.tempMin}°C min / ${w.tempMax}°C max\n`;
  out += `💧 *Humidity:* ${w.humidity}%\n`;
  out += `💨 *Wind Speed:* ${w.windSpeed} m/s (~${Math.round(w.windSpeed * 3.6)} km/h)\n`;
  out += `👁️ *Visibility:* ${w.visibilityKm} km\n`;

  if (w.sunrise && w.sunset) {
    out += `🌅 *Sunrise:* ${w.sunrise}  |  🌇 *Sunset:* ${w.sunset}\n`;
  }

  out += `━━━━━━━━━━━━━━━━━━━━━\n`;
  out += `_Powered by OpenWeatherMap API ⚡_`;

  return out.trim();
}

module.exports = {
  fetchCurrentWeather,
  extractWeatherQuery,
  formatWeatherForWhatsApp,
  getWeatherEmoji,
};
