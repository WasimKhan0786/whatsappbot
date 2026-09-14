const axios = require('axios');

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Resolves OpenWeatherMap API Key from environment variables
 * @returns {string}
 */
function getApiKey() {
  return (process.env.OPENWEATHER_API_KEY || '').trim();
}

/**
 * Fetches current weather for a city name or coordinates
 * @param {object} params
 * @param {string} [params.city] - City name (e.g. 'Delhi', 'Mumbai,IN', 'London')
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

  const queryParams = {
    appid: apiKey,
    units,
  };

  if (city && city.trim()) {
    queryParams.q = city.trim();
  } else if (lat !== undefined && lon !== undefined) {
    queryParams.lat = lat;
    queryParams.lon = lon;
  } else {
    return {
      success: false,
      error: 'City name or coordinates (lat, lon) are required',
    };
  }

  try {
    const response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
      params: queryParams,
      timeout: 10000,
    });

    const d = response.data;
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
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('[OpenWeatherMap] Fetch error:', msg);
    return {
      success: false,
      error: msg,
      statusCode: err.response?.status,
    };
  }
}

/**
 * Extracts a city and weather intent from incoming message text
 * Supports /weather, /mausam, "weather in Delhi", "mumbai ka mausam", "delhi weather", etc.
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
    const city = cmdMatch[2].trim() || 'Delhi';
    return { isWeatherRequest: true, city };
  }

  // 2. English patterns: "weather in <city>", "<city> weather", "temperature in <city>"
  const enInMatch = trimmed.match(/(?:weather|temperature|forecast|temp)\s+(?:in|of|at|for)\s+([a-zA-Z\s]+)/i);
  if (enInMatch && enInMatch[1].trim()) {
    const city = enInMatch[1].trim().replace(/[?.!]+$/, '');
    return { isWeatherRequest: true, city };
  }

  const enCityMatch = trimmed.match(/^([a-zA-Z\s]+)\s+(?:weather|temperature|temp|forecast)[?.!]?$/i);
  if (enCityMatch && enCityMatch[1].trim()) {
    const candidate = enCityMatch[1].trim();
    // Exclude common non-cities
    if (!['today', 'tomorrow', 'current', 'live'].includes(candidate.toLowerCase())) {
      return { isWeatherRequest: true, city: candidate };
    }
  }

  // 3. Hinglish / Hindi patterns: "<city> ka mausam", "<city> me mausam kaisa hai", "aaj ka mausam"
  const hiMatch1 = trimmed.match(/([a-zA-Z\s]+)\s+(?:ka\s+mausam|me\s+mausam|mein\s+mausam|ka\s+temperature)/i);
  if (hiMatch1 && hiMatch1[1].trim()) {
    const city = hiMatch1[1].trim();
    if (!['aaj', 'kal', 'wahan'].includes(city.toLowerCase())) {
      return { isWeatherRequest: true, city };
    }
  }

  const hiMatch2 = trimmed.match(/(?:mausam\s+batao|aaj\s+ka\s+mausam|kaisa\s+hai\s+mausam)\s*(?:in\s+)?([a-zA-Z\s]*)/i);
  if (hiMatch2) {
    const city = hiMatch2[1].trim() || 'Delhi';
    return { isWeatherRequest: true, city };
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
