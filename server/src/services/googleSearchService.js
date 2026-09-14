const axios = require('axios');

const DEFAULT_CX = process.env.GOOGLE_SEARCH_CX || '8002fdf14f0bb4998';
const SEARCH_API_URL = 'https://www.googleapis.com/customsearch/v1';

/**
 * Resolves the Google Search API key from environment variables or parameter
 * @param {string} [customApiKey] 
 * @returns {string}
 */
function resolveApiKey(customApiKey) {
  if (customApiKey && customApiKey.trim()) return customApiKey.trim();
  return (
    process.env.GOOGLE_SEARCH_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();
}

/**
 * Searches the web using Google Programmable Search Engine (Custom Search JSON API)
 * @param {string} query - The search query term
 * @param {object} [options]
 * @param {string} [options.cx] - Search engine ID (defaults to 8002fdf14f0bb4998)
 * @param {string} [options.apiKey] - Google API key with Custom Search API enabled
 * @param {number} [options.num=5] - Number of results to return (1-10)
 * @param {number} [options.start=1] - Offset index for pagination
 * @param {string} [options.gl] - Geolocation code (e.g. 'in', 'us')
 * @param {string} [options.hl] - User interface language
 * @returns {Promise<{ success: boolean, query: string, totalResults: string, searchTime: number, items: Array, error?: string }>}
 */
async function searchGoogle(query, options = {}) {
  if (!query || !query.trim()) {
    return {
      success: false,
      query: '',
      totalResults: '0',
      searchTime: 0,
      items: [],
      error: 'Query string is required for Google Search',
    };
  }

  const cx = options.cx || process.env.GOOGLE_SEARCH_CX || DEFAULT_CX;
  const apiKey = resolveApiKey(options.apiKey);
  const num = Math.min(Math.max(parseInt(options.num, 10) || 4, 1), 10);
  const start = parseInt(options.start, 10) || 1;

  if (!apiKey) {
    console.warn('[Google Search] No API Key provided or configured in GOOGLE_SEARCH_API_KEY');
    return {
      success: false,
      query: query.trim(),
      totalResults: '0',
      searchTime: 0,
      items: [],
      error: 'GOOGLE_SEARCH_API_KEY is not configured in .env. Please configure a valid Google Cloud API key with Custom Search API enabled.',
    };
  }

  try {
    const params = {
      key: apiKey,
      cx,
      q: query.trim(),
      num,
      start,
    };

    if (options.gl) params.gl = options.gl;
    if (options.hl) params.hl = options.hl;

    const response = await axios.get(SEARCH_API_URL, {
      params,
      timeout: 10000,
    });

    const data = response.data;
    const rawItems = data.items || [];
    const searchInfo = data.searchInformation || {};

    const items = rawItems.map((item, index) => {
      let thumbnail = null;
      if (item.pagemap && item.pagemap.cse_image && item.pagemap.cse_image[0]) {
        thumbnail = item.pagemap.cse_image[0].src;
      } else if (item.pagemap && item.pagemap.cse_thumbnail && item.pagemap.cse_thumbnail[0]) {
        thumbnail = item.pagemap.cse_thumbnail[0].src;
      }

      return {
        position: index + 1,
        title: item.title || '',
        link: item.link || '',
        displayLink: item.displayLink || '',
        snippet: (item.snippet || '').replace(/\s+/g, ' ').trim(),
        thumbnail,
      };
    });

    return {
      success: true,
      query: query.trim(),
      totalResults: searchInfo.totalResults || String(items.length),
      searchTime: searchInfo.searchTime || 0,
      items,
    };
  } catch (err) {
    const status = err.response ? err.response.status : null;
    const errorDetails = err.response && err.response.data && err.response.data.error
      ? err.response.data.error.message
      : err.message;

    console.error(`[Google Search] API error (status ${status}):`, errorDetails);

    return {
      success: false,
      query: query.trim(),
      totalResults: '0',
      searchTime: 0,
      items: [],
      error: errorDetails,
      statusCode: status,
    };
  }
}

/**
 * Extracts a search query from incoming WhatsApp message text
 * Supports /search, /google, search:, google:, search for ..., google pe search karo ...
 * @param {string} text 
 * @returns {{ isSearchRequest: boolean, query: string }}
 */
function extractSearchQuery(text) {
  if (!text || typeof text !== 'string') {
    return { isSearchRequest: false, query: '' };
  }

  const trimmed = text.trim();

  // 1. Explicit command triggers: /search <query> or /google <query>
  const commandMatch = trimmed.match(/^[\/!](search|google)\s+(.+)$/i);
  if (commandMatch && commandMatch[2].trim()) {
    return { isSearchRequest: true, query: commandMatch[2].trim() };
  }

  // 2. Prefix triggers: "search: <query>", "google: <query>"
  const prefixMatch = trimmed.match(/^(?:search|google|websearch):\s*(.+)$/i);
  if (prefixMatch && prefixMatch[1].trim()) {
    return { isSearchRequest: true, query: prefixMatch[1].trim() };
  }

  // 3. Conversational natural language search requests:
  // "search for <query>", "search google for <query>", "google search <query>"
  const nlMatch = trimmed.match(/^(?:please\s+)?(?:search\s+google\s+for|search\s+for|google\s+search\s+for|google\s+search|search\s+web\s+for|google\s+pe\s+search\s+karo|search\s+karo|dhoondo)\s+(.+)$/i);
  if (nlMatch && nlMatch[1].trim()) {
    const rawQuery = nlMatch[1].trim();
    // Exclude if it looks like image search (/image, generate image)
    if (!rawQuery.toLowerCase().startsWith('image') && !rawQuery.toLowerCase().startsWith('photo')) {
      return { isSearchRequest: true, query: rawQuery };
    }
  }

  return { isSearchRequest: false, query: '' };
}

/**
 * Formats Google search results into clean, elegant WhatsApp Markdown
 * @param {object} searchResult - Result from searchGoogle
 * @param {string} query - The original search term
 * @returns {string}
 */
function formatSearchResultsForWhatsApp(searchResult, query) {
  if (!searchResult || !searchResult.success || !searchResult.items || searchResult.items.length === 0) {
    if (searchResult && searchResult.error) {
      return `🔍 *Google Search:* "${query}"\n\n⚠️ Search complete karne me samasya aayi:\n_${searchResult.error}_`;
    }
    return `🔍 *Google Search:* "${query}"\n\nKripya koshish karein doosre shabdon ke sath, koi result nahi mila.`;
  }

  let formatted = `🔍 *Google Search Results for:* "${query}"\n`;
  formatted += `⚡ *Found:* ~${searchResult.totalResults} results (${searchResult.searchTime}s)\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  searchResult.items.forEach((item, index) => {
    formatted += `*${index + 1}. ${item.title}*\n`;
    if (item.snippet) {
      formatted += `${item.snippet}\n`;
    }
    formatted += `🔗 ${item.link}\n\n`;
  });

  formatted += `_Powered by Google Programmable Search_`;
  return formatted.trim();
}

module.exports = {
  searchGoogle,
  extractSearchQuery,
  formatSearchResultsForWhatsApp,
  DEFAULT_CX,
};
