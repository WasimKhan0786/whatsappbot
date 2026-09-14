const axios = require('axios');

const TAVILY_API_URL = 'https://api.tavily.com/search';
const SERPER_API_URL = 'https://google.serper.dev/search';

/**
 * Searches the live web using Tavily AI Search and Serper Google Search
 * @param {string} query - Query string
 * @param {object} [options]
 * @returns {Promise<{ success: boolean, answer: string, results: Array<{ title: string, url: string, snippet: string }>, provider: string }>}
 */
async function searchWebLive(query, options = {}) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { success: false, answer: '', results: [], provider: 'none' };
  }

  const cleanQuery = query.trim();
  const tavilyKey = process.env.TAVILY_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;

  let directAnswer = '';
  const searchResults = [];
  let primaryProvider = 'NONE';

  // 1. Serper Google Search (Real-time organic results & live scores)
  if (serperKey && !serperKey.includes('your_')) {
    try {
      console.log(`[Web Search] 🔍 Querying Serper Google Search for: "${cleanQuery}"...`);
      const serperResp = await axios.post(
        SERPER_API_URL,
        { q: cleanQuery, gl: 'in', hl: 'en' },
        {
          headers: {
            'X-API-KEY': serperKey.trim(),
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const organic = serperResp.data?.organic || [];
      const answerBox = serperResp.data?.answerBox?.answer || serperResp.data?.answerBox?.snippet;
      if (answerBox) {
        directAnswer = answerBox;
      }

      for (const item of organic.slice(0, 4)) {
        searchResults.push({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
        });
      }

      if (searchResults.length > 0) {
        primaryProvider = 'SERPER_GOOGLE';
      }
    } catch (serperErr) {
      console.warn(`[Web Search] Serper error:`, serperErr.message);
    }
  }

  // 2. Tavily AI Search (Deep AI synthesis & factual Q&A)
  if (tavilyKey && !tavilyKey.includes('your_')) {
    try {
      console.log(`[Web Search] 🤖 Querying Tavily AI Search for: "${cleanQuery}"...`);
      const tavilyResp = await axios.post(
        TAVILY_API_URL,
        {
          api_key: tavilyKey.trim(),
          query: cleanQuery,
          include_answer: true,
          search_depth: 'basic',
          max_results: 4,
        },
        { timeout: 10000 }
      );

      if (tavilyResp.data?.answer && !directAnswer) {
        directAnswer = tavilyResp.data.answer;
      }

      if (searchResults.length === 0 && Array.isArray(tavilyResp.data?.results)) {
        for (const item of tavilyResp.data.results.slice(0, 4)) {
          searchResults.push({
            title: item.title,
            url: item.url,
            snippet: item.content,
          });
        }
        primaryProvider = 'TAVILY_AI';
      }
    } catch (tavilyErr) {
      console.warn(`[Web Search] Tavily error:`, tavilyErr.message);
    }
  }

  const success = Boolean(directAnswer || searchResults.length > 0);
  return {
    success,
    answer: directAnswer,
    results: searchResults,
    provider: primaryProvider,
  };
}

/**
 * Extracts live search intent from user message
 * @param {string} text
 * @returns {{ isSearchRequest: boolean, query: string }}
 */
function extractLiveSearchQuery(text) {
  if (!text || typeof text !== 'string') return { isSearchRequest: false, query: '' };

  const trimmed = text.trim();

  // Explicit search prefixes: "search ...", "google ...", "tavily ..."
  const explicitMatch = trimmed.match(/^(?:search|google|find|tavily)\s+(?:for\s+)?(.+)/i);
  if (explicitMatch && explicitMatch[1]) {
    return { isSearchRequest: true, query: explicitMatch[1].trim() };
  }

  // Live cricket, sports, current events
  const sportsMatch = trimmed.match(/\b(cricket score|match score|live score|score kya hai|aaj ka match|ipl score|t20 score)\b/i);
  if (sportsMatch) {
    return { isSearchRequest: true, query: trimmed };
  }

  // Current affairs or news lookup
  if (/\b(today news|trending news|aaj ki khabar|breaking news)\b/i.test(trimmed) && trimmed.length < 50) {
    return { isSearchRequest: true, query: trimmed };
  }

  return { isSearchRequest: false, query: '' };
}

/**
 * Formats web search results for WhatsApp
 * @param {object} searchData
 * @param {string} query
 * @returns {string}
 */
function formatSearchSummaryForWhatsApp(searchData, query) {
  if (!searchData || !searchData.success) {
    return `🔍 *Live Web Search: "${query}"*\n\nMaaf kijiye, is vishay par koi taaza live jaankari nahi mil saki. Kripya doosre shabdon me search karein.`;
  }

  const lines = [`🌐 *Live Web Search:* _"${query}"_\n`];

  if (searchData.answer) {
    lines.push(`💡 *Quick Answer:*\n${searchData.answer.trim()}\n`);
  }

  if (searchData.results && searchData.results.length > 0) {
    lines.push(`📌 *Top Web Updates:*`);
    searchData.results.slice(0, 3).forEach((item, index) => {
      lines.push(`${index + 1}. *${item.title}*`);
      if (item.snippet) {
        lines.push(`   ${item.snippet.replace(/\n+/g, ' ').substring(0, 140)}...`);
      }
      if (item.url) {
        lines.push(`   🔗 ${item.url}`);
      }
      lines.push('');
    });
  }

  lines.push(`_Powered by Live AI Search Engine_`);
  return lines.join('\n');
}

module.exports = {
  searchWebLive,
  extractLiveSearchQuery,
  formatSearchSummaryForWhatsApp,
};
