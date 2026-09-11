const axios = require('axios');
const LocationState = require('../models/LocationState');

// In-memory cache for fast lookup without querying MongoDB on every message
let cachedLocation = null;
let lastCacheFetch = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Detects if incoming message is asking where the user/Wasim is located
 * @param {string} text - Message text
 * @returns {boolean}
 */
function detectLocationQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();

  // Common Hindi, Hinglish, Urdu, and English queries asking for current location
  const patterns = [
    /\b(kaha|kahan|kidhar)\s*(pe|par)?\s*(ho|hai|ho\s*bhai|ho\s*bro|hai\s*tu)\b/i,
    /\bwhere\s*(are\s*you|r\s*u|u\s*at|are\s*u)\b/i,
    /\b(apni\s*)?(current\s*)?location\s*(bhejo|bhej|share\s*karo|send\s*karo|do|de|bhejna)\b/i,
    /\b(send|share)\s*(me\s*)?(your\s*)?(live\s*|current\s*)?location\b/i,
    /\blive\s*location\b/i,
    /\bwhats\s*your\s*location\b/i,
    /\bkaha\s*ho\s*abhi\b/i,
    /\bkidhar\s*ho\s*abhi\b/i,
    /\bkaha\s*pahunch\s*gaye\b/i,
  ];

  return patterns.some((pattern) => pattern.test(clean));
}

/**
 * Reverse geocodes latitude and longitude into human-readable address
 * Uses free OpenStreetMap Nominatim with fallback
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>}
 */
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'WhatsAppAIBot-LocationTracker/1.0',
      },
      timeout: 4000,
    });

    if (response.data && response.data.display_name) {
      const parts = response.data.display_name.split(',').map((s) => s.trim());
      // Return concise readable address (first 3-4 segments)
      return parts.slice(0, 4).join(', ');
    }
  } catch (err) {
    console.warn('[LocationService] Reverse geocode lookup warning:', err.message);
  }

  return `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/**
 * Retrieves the current location state from cache or MongoDB
 * @returns {Promise<object>}
 */
async function getCurrentLocation() {
  const now = Date.now();
  if (cachedLocation && now - lastCacheFetch < CACHE_TTL_MS) {
    return cachedLocation;
  }

  try {
    const state = await LocationState.getLocation();
    cachedLocation = state;
    lastCacheFetch = now;
    return state;
  } catch (err) {
    console.warn('[LocationService] Error fetching location state:', err.message);
    return (
      cachedLocation || {
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'New Delhi, India',
        name: "Wasim Khan's Location",
        isLiveTrackingActive: true,
        shareWithAll: true,
        lastUpdated: new Date(),
      }
    );
  }
}

/**
 * Updates location coordinates and persists to MongoDB & cache
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.accuracy=10]
 * @param {string} [params.address]
 * @param {string} [params.name]
 * @param {string} [params.updatedBy='phone_gps']
 * @returns {Promise<object>}
 */
async function updateLocationCoordinates({
  latitude,
  longitude,
  accuracy = 10,
  address,
  name,
  updatedBy = 'phone_gps',
}) {
  const latNum = parseFloat(latitude);
  const lonNum = parseFloat(longitude);

  if (isNaN(latNum) || isNaN(lonNum)) {
    throw new Error('Invalid latitude or longitude numbers');
  }

  let finalAddress = address;
  if (!finalAddress || finalAddress.trim() === '') {
    finalAddress = await reverseGeocode(latNum, lonNum);
  }

  const state = await LocationState.getLocation();
  state.latitude = latNum;
  state.longitude = lonNum;
  state.accuracy = Number(accuracy) || 10;
  state.address = finalAddress;
  if (name) state.name = name;
  state.updatedBy = updatedBy;
  state.lastUpdated = new Date();

  await state.save();
  cachedLocation = state;
  lastCacheFetch = Date.now();

  console.log(
    `[LocationService] 📍 Location updated successfully (${updatedBy}): ${latNum.toFixed(4)}, ${lonNum.toFixed(4)} - "${finalAddress}"`
  );

  return state;
}

/**
 * Formats a natural conversational text message to accompany the map pin
 * @param {object} location - Location state object
 * @param {boolean} [isWhitelisted=false] - Whether the recipient is a whitelisted friend
 * @returns {string}
 */
function buildLocationTextMessage(location, isWhitelisted = false) {
  const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  const address = location.address || 'meri current location';

  if (isWhitelisted) {
    return `Bhai main abhi yahan hoon: *${address}*.\n\n📍 Upar maine live map pin bhej diya hai!\n🗺️ Google Maps link: ${mapsUrl}`;
  }

  return `Main abhi yahan hoon: *${address}*.\n\n📍 Upar location pin share kar diya hai, check kar lijiye.\n🗺️ Maps link: ${mapsUrl}`;
}

module.exports = {
  detectLocationQuery,
  reverseGeocode,
  getCurrentLocation,
  updateLocationCoordinates,
  buildLocationTextMessage,
};
