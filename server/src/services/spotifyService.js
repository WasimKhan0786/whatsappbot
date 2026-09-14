const axios = require('axios');

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Retrieves an active Spotify Web API Client Credentials access token
 * @returns {Promise<string|null>}
 */
async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes('your_')) {
    return null;
  }

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const authHeader = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    if (res.data?.access_token) {
      cachedToken = res.data.access_token;
      // Expire 60 seconds before official expires_in
      tokenExpiresAt = Date.now() + ((res.data.expires_in || 3600) - 60) * 1000;
      return cachedToken;
    }
  } catch (err) {
    console.warn('[Spotify] Token fetch error:', err.response?.data || err.message);
  }

  return null;
}

/**
 * Searches tracks on Spotify (with open fallback if Spotify developer restrictions apply)
 * @param {string} query - Song or artist query
 * @param {number} [limit=3]
 * @returns {Promise<{ success: boolean, tracks: Array<{ name: string, artist: string, album: string, spotifyUrl: string, previewUrl: string|null, imageUrl: string|null }> }>}
 */
async function searchSpotifyTracks(query, limit = 3) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { success: false, tracks: [] };
  }

  const cleanQuery = query.trim();
  const token = await getSpotifyAccessToken();

  if (token) {
    try {
      console.log(`[Spotify] 🎵 Searching Spotify catalog for: "${cleanQuery}"...`);
      const res = await axios.get('https://api.spotify.com/v1/search', {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: cleanQuery, type: 'track', limit },
        timeout: 10000,
      });

      const items = res.data?.tracks?.items || [];
      if (items.length > 0) {
        const tracks = items.map((item) => ({
          name: item.name,
          artist: item.artists?.map((a) => a.name).join(', ') || 'Unknown Artist',
          album: item.album?.name || '',
          spotifyUrl: item.external_urls?.spotify || `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`,
          previewUrl: item.preview_url || null,
          imageUrl: item.album?.images?.[0]?.url || null,
        }));

        return { success: true, tracks };
      }
    } catch (apiErr) {
      console.warn(`[Spotify] Direct Web API notice:`, apiErr.response?.data?.error?.message || apiErr.message);
    }
  }

  // Resilient Fallback: Query open catalog to get song details and direct Spotify search links
  try {
    console.log(`[Spotify] 🔄 Fetching track metadata for Spotify link generation: "${cleanQuery}"...`);
    const fallbackRes = await axios.get('https://itunes.apple.com/search', {
      params: { term: cleanQuery, media: 'music', entity: 'song', limit },
      timeout: 8000,
    });

    const results = fallbackRes.data?.results || [];
    if (results.length > 0) {
      const tracks = results.map((item) => ({
        name: item.trackName,
        artist: item.artistName,
        album: item.collectionName || '',
        spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(`${item.trackName} ${item.artistName}`)}`,
        previewUrl: item.previewUrl || null,
        imageUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : null,
      }));

      return { success: true, tracks };
    }
  } catch (fbErr) {
    console.warn(`[Spotify] Fallback notice:`, fbErr.message);
  }

  // Pure link generation if all searches fail
  return {
    success: true,
    tracks: [
      {
        name: cleanQuery,
        artist: 'Various Artists',
        album: 'Spotify Search',
        spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`,
        previewUrl: null,
        imageUrl: null,
      },
    ],
  };
}

/**
 * Detects if incoming message is asking for songs, music, or Spotify
 * @param {string} text
 * @returns {{ isMusicRequest: boolean, query: string }}
 */
function extractSongQuery(text) {
  if (!text || typeof text !== 'string') return { isMusicRequest: false, query: '' };

  const trimmed = text.trim();

  // Pattern: "play <song>", "spotify <song>", "song <name>", "gaana <name>"
  const match = trimmed.match(/^(?:play|spotify|song|gaana|gana|music|sunao)\s+(?:me\s+)?(.+)/i);
  if (match && match[1]) {
    return { isMusicRequest: true, query: match[1].trim() };
  }

  // Keywords indicating music search
  if (/\b(song|gaana|gana|music|track|spotify link|playlist|ke gaane|ke songs)\b/i.test(trimmed)) {
    const cleaned = trimmed
      .replace(/\b(spotify link|bhejo|sunao|play|suggest|karo|batao|kaise|mujhe|chahiye)\b/gi, '')
      .trim();
    if (cleaned.length >= 3) {
      return { isMusicRequest: true, query: cleaned };
    }
  }

  return { isMusicRequest: false, query: '' };
}

/**
 * Formats Spotify track results for WhatsApp
 * @param {Array} tracks
 * @param {string} query
 * @returns {string}
 */
function formatSpotifyCardForWhatsApp(tracks, query) {
  if (!tracks || tracks.length === 0) {
    return `🎵 *Spotify Music:* _"${query}"_\n\nMaaf kijiye, is gaane ki jaankari nahi mili.\nAap direct Spotify par search kar sakte hain:\n🔗 https://open.spotify.com/search/${encodeURIComponent(query)}`;
  }

  const lines = [`🎧 *Spotify Music Discovery* 🎶\n_Results for "${query}":_\n`];

  tracks.forEach((track, idx) => {
    lines.push(`*${idx + 1}. ${track.name}*`);
    lines.push(`   👤 *Artist:* ${track.artist}`);
    if (track.album && track.album !== 'Spotify Search') {
      lines.push(`   💿 *Album:* ${track.album}`);
    }
    lines.push(`   🟢 *Listen on Spotify:* ${track.spotifyUrl}`);
    lines.push('');
  });

  lines.push(`_Gaana sunne ke liye upar diye gaye Spotify link par tap karein!_`);
  return lines.join('\n');
}

module.exports = {
  searchSpotifyTracks,
  extractSongQuery,
  formatSpotifyCardForWhatsApp,
};
