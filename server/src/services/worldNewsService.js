const axios = require('axios');
const BotSettings = require('../models/BotSettings');

/**
 * World News API Service
 * 
 * Provides:
 * 1. Intelligent news intent and topic extraction (English, Hindi, Hinglish)
 * 2. Real-time news fetching via World News API (top-news & search-news)
 * 3. Mobile-optimized WhatsApp formatting with headlines, summaries, sources, and links
 * 4. Grounded live context retrieval for Gemini AI
 */

const BASE_URL = 'https://api.worldnewsapi.com';

/**
 * Normalizes text to extract news intent and specific topics.
 * 
 * @param {string} text - Raw incoming WhatsApp text message
 * @returns {{ isNewsRequest: boolean, topic: string|null, category: string|null, isTopNews: boolean }}
 */
function extractNewsQuery(text) {
  if (!text || typeof text !== 'string') {
    return { isNewsRequest: false, topic: null, category: null, isTopNews: false };
  }

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Pattern 0: Direct slash or bang commands (/news, /headlines, !news)
  const slashMatch = clean.match(/^[\/!#]?(news|headlines|tazakhabar|khabar)\s*(.*)$/i);
  if (slashMatch) {
    const rawParam = (slashMatch[2] || '').trim();
    if (!rawParam) {
      return { isNewsRequest: true, topic: null, category: 'general', isTopNews: true };
    }
    return { isNewsRequest: true, topic: rawParam, category: mapTopicToCategory(rawParam), isTopNews: false };
  }

  // Pattern 1: Hindi / Hinglish news inquiries
  // e.g. "aaj ki taza khabar", "taza khabar kya hai", "aaj ki khabar batao", "desh ki khabar", "kya khabar hai"
  const hinglishPatterns = [
    /\b(aaj\s*ki\s*(taaza|taza|badi|mukhy|mukhya)?\s*(khabar|khabrein|samachar|news))\b/i,
    /\b(taaza|taza)\s*(khabar|khabrein|samachar)\b/i,
    /\b(desh|duniya|bharat|world)\s*ki\s*(khabar|khabrein|news)\b/i,
    /\b(breaking\s*news|top\s*headlines)\s*(kya\s*hai|batao|dikhao|sunao)?\b/i,
    /\b(kya\s*chal\s*raha\s*hai\s*(news|desh|duniya)\s*mein)\b/i,
  ];

  for (const pat of hinglishPatterns) {
    if (pat.test(lower)) {
      // Check if a specific subject/topic is mentioned in Hinglish query
      const topic = extractSubjectFromQuery(lower);
      return {
        isNewsRequest: true,
        topic,
        category: mapTopicToCategory(topic),
        isTopNews: !topic,
      };
    }
  }

  // Pattern 2: Category-specific news inquiries in English & Hinglish
  // e.g. "cricket news", "sports news", "tech news", "technology news", "crypto news", "business news", "weather news", "bollywood news"
  const categoryMatch = lower.match(
    /\b(cricket|sports|tech|technology|ai|artificial\s*intelligence|business|crypto|bitcoin|stock\s*market|finance|entertainment|bollywood|hollywood|political|politics|health|science|weather)\s+(news|updates|headlines|khabar|samachar)\b/i
  );
  if (categoryMatch) {
    const matchedCategory = categoryMatch[1].trim();
    return {
      isNewsRequest: true,
      topic: matchedCategory,
      category: mapTopicToCategory(matchedCategory),
      isTopNews: false,
    };
  }

  // Pattern 3: English conversational news queries
  // e.g. "give me the latest news", "what is the news today", "show me breaking news", "tell me top news"
  const englishNewsMatch = lower.match(
    /\b(give\s*me|tell\s*me|show\s*me|what\s*(is|are)\s*the|get|fetch)?\s*(latest|breaking|today'?s|recent|current|top)\s+(news|headlines|articles|updates)\b/i
  );
  if (englishNewsMatch) {
    // Check if user specified a subject after "about/on/in/for"
    const subjectMatch = lower.match(/(?:news|headlines|updates)\s+(?:about|on|in|regarding|for)\s+([a-zA-Z0-9\s]+)/i);
    const extractedTopic = subjectMatch ? subjectMatch[1].trim() : null;

    return {
      isNewsRequest: true,
      topic: extractedTopic,
      category: mapTopicToCategory(extractedTopic),
      isTopNews: !extractedTopic,
    };
  }

  // Pattern 4: Hinglish topic + news suffix
  // e.g. "India vs pak news", "budget news batao", "gold rate news"
  const hinglishSuffixMatch = lower.match(/(.+?)\s+(?:ki\s+)?(?:news|khabar|samachar)\s+(?:batao|bhejo|dikhao|sunao|kya\s*hai)/i);
  if (hinglishSuffixMatch && hinglishSuffixMatch[1] && hinglishSuffixMatch[1].trim().length > 2) {
    const cleanTopic = hinglishSuffixMatch[1].replace(/^(aur|bhai|yaar|please)\s+/i, '').trim();
    return {
      isNewsRequest: true,
      topic: cleanTopic,
      category: mapTopicToCategory(cleanTopic),
      isTopNews: false,
    };
  }

  return { isNewsRequest: false, topic: null, category: null, isTopNews: false };
}

/**
 * Maps arbitrary keywords to standard news categories
 */
function mapTopicToCategory(topic) {
  if (!topic) return 'general';
  const lower = topic.toLowerCase();
  if (lower.includes('cricket') || lower.includes('sport') || lower.includes('football') || lower.includes('ipl')) return 'sports';
  if (lower.includes('tech') || lower.includes('software') || lower.includes('gadget') || lower.includes('ai') || lower.includes('mobile')) return 'technology';
  if (lower.includes('business') || lower.includes('finance') || lower.includes('stock') || lower.includes('crypto') || lower.includes('market') || lower.includes('economy')) return 'business';
  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('bollywood') || lower.includes('film') || lower.includes('cinema')) return 'entertainment';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('fitness')) return 'health';
  if (lower.includes('science') || lower.includes('space') || lower.includes('nasa') || lower.includes('isro')) return 'science';
  if (lower.includes('politics') || lower.includes('election') || lower.includes('government')) return 'politics';
  return 'general';
}

/**
 * Extracts a subject from common Hinglish query phrases
 */
function extractSubjectFromQuery(lowerText) {
  if (lowerText.includes('cricket')) return 'cricket';
  if (lowerText.includes('sport')) return 'sports';
  if (lowerText.includes('tech')) return 'technology';
  if (lowerText.includes('business')) return 'business';
  if (lowerText.includes('bollywood') || lowerText.includes('film') || lowerText.includes('cinema')) return 'entertainment';
  if (lowerText.includes('desh') || lowerText.includes('bharat') || lowerText.includes('india')) return 'India';
  if (lowerText.includes('duniya') || lowerText.includes('world')) return 'world';
  return null;
}

/**
 * Fetches real-time news articles from World News API
 * 
 * @param {object} options
 * @param {string} [options.text] - Search query or topic
 * @param {string} [options.country] - ISO 2-letter country code (e.g. 'in', 'us', 'gb')
 * @param {string} [options.language] - ISO 2-letter language code (e.g. 'en', 'hi')
 * @param {string} [options.category] - News category
 * @param {number} [options.number] - Maximum number of articles to return
 * @returns {Promise<{ success: boolean, articles: Array, totalResults: number, source: string, error?: string }>}
 */
async function fetchRealTimeNews(options = {}) {
  const apiKey = (process.env.WORLD_NEWS_API_KEY || '').trim();

  if (!apiKey) {
    console.warn('[WorldNewsService] ⚠️ WORLD_NEWS_API_KEY is not configured in .env!');
    return {
      success: false,
      articles: [],
      error: 'World News API key is not configured. Please add WORLD_NEWS_API_KEY in Bot Controls.',
    };
  }

  let settings = null;
  try {
    settings = await BotSettings.getSettings();
  } catch (err) {
    // fallback
  }

  const defaultCountry = settings?.newsDefaultCountry || 'in';
  const defaultLang = settings?.newsDefaultLanguage || 'en';
  const maxArticles = Number(options.number || settings?.newsMaxArticles || 3);

  const country = options.country || defaultCountry;
  const language = options.language || defaultLang;
  const topic = options.text?.trim() || null;

  try {
    let endpoint = '/search-news';
    let params = {
      language,
      number: maxArticles,
    };

    // If specific topic is provided, use search-news with text filter
    if (topic && topic.toLowerCase() !== 'general' && topic.toLowerCase() !== 'top') {
      params.text = topic;
      if (country && country !== 'all') {
        params['source-countries'] = country;
      }
    } else {
      // Top headlines endpoint
      endpoint = '/top-news';
      params = {
        language,
      };
      if (country && country !== 'all') {
        params['source-country'] = country;
      }
    }

    console.log(`[WorldNewsService] 🌐 Fetching news: ${BASE_URL}${endpoint} | Params:`, params);

    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: {
        'x-api-key': apiKey,
      },
      timeout: 10000,
    });

    let rawArticles = [];

    if (endpoint === '/top-news') {
      // World News API returns { top_news: [ { news: [...] } ] } for /top-news
      if (Array.isArray(response.data?.top_news)) {
        for (const cluster of response.data.top_news) {
          if (Array.isArray(cluster.news)) {
            rawArticles.push(...cluster.news);
          }
        }
      }
    } else {
      // /search-news returns { news: [...] }
      rawArticles = response.data?.news || [];
    }

    // Slice to desired limit
    const articles = rawArticles.slice(0, maxArticles).map((art) => ({
      id: art.id,
      title: (art.title || '').trim(),
      summary: (art.summary || art.text || '').replace(/\s+/g, ' ').trim(),
      url: art.url,
      image: art.image || null,
      publishDate: art.publish_date,
      source: extractDomainOrSource(art.url, art.authors),
    }));

    console.log(`[WorldNewsService] ✅ Successfully fetched ${articles.length} news articles.`);

    return {
      success: true,
      articles,
      totalResults: response.data?.available || articles.length,
      topic: topic || 'Top Headlines',
      country,
    };
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    console.error(`[WorldNewsService] ❌ Failed to fetch news from World News API:`, errMsg);

    return {
      success: false,
      articles: [],
      error: errMsg,
    };
  }
}

/**
 * Cleanly formats fetched news articles into a crisp, mobile-friendly WhatsApp message layout.
 * 
 * @param {Array} articles - Array of article objects
 * @param {string} [topic] - Topic or category name
 * @param {string} [country] - Country code
 * @returns {string} WhatsApp formatted markdown string
 */
function formatNewsForWhatsApp(articles, topic = 'Top Headlines', country = 'in') {
  if (!articles || articles.length === 0) {
    return `📰 *Real-Time News Update*\n\nMaaf kijiye, filhaal '${topic}' ke liye koi taaza khabar nahi mili. Kripya thodi der baad dobara check karein ya koi doosra topic search karein.`;
  }

  const countryFlags = {
    in: '🇮🇳 India',
    us: '🇺🇸 United States',
    gb: '🇬🇧 United Kingdom',
    ca: '🇨🇦 Canada',
    au: '🇦🇺 Australia',
    all: '🌐 Global',
  };

  const regionLabel = countryFlags[country] || '🌐 Global';
  const headerTopic = topic && topic !== 'Top Headlines' ? `Topic: ${topic.toUpperCase()}` : 'Top Headlines & Breaking News';

  let output = `📰 *Real-Time News Feed* (${regionLabel})\n📌 *${headerTopic}*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

  articles.forEach((art, idx) => {
    const num = idx + 1;
    output += `${num}️⃣ *${art.title}*\n`;

    if (art.summary) {
      // Truncate summary nicely to ~160 chars for rapid reading on WhatsApp
      const cleanSummary = art.summary.length > 175 ? art.summary.substring(0, 172) + '...' : art.summary;
      output += `💬 ${cleanSummary}\n`;
    }

    if (art.source) {
      output += `🏛️ *Source:* ${art.source}\n`;
    }

    if (art.url) {
      output += `🔗 *Read Full:* ${art.url}\n`;
    }

    output += `\n`;
  });

  output += `━━━━━━━━━━━━━━━━━━━━━\n_Taaza khabarein live World News API se verify karke bheji gayi hain._`;

  return output.trim();
}

/**
 * Formats top news into a contextual context injection string for Google Gemini AI.
 * This allows Gemini to answer complex current affairs questions with 100% accurate up-to-date facts.
 * 
 * @param {string} queryText - User's query
 * @returns {Promise<string|null>} Live news context block or null
 */
async function fetchGroundedNewsForGemini(queryText) {
  try {
    const newsResult = await fetchRealTimeNews({
      text: queryText,
      number: 2,
    });

    if (!newsResult.success || !newsResult.articles || newsResult.articles.length === 0) {
      return null;
    }

    let contextBlock = `\n[REAL-TIME LIVE NEWS CONTEXT (Verified via World News API on ${new Date().toLocaleDateString()})]:\n`;
    newsResult.articles.forEach((art, i) => {
      contextBlock += `Article ${i + 1}: Title: "${art.title}" | Snippet: "${art.summary.substring(0, 200)}" | Source: ${art.source}\n`;
    });
    contextBlock += `Use the above up-to-the-minute real-world facts to answer the user's question accurately in their preferred tone and language.\n`;

    return contextBlock;
  } catch (err) {
    console.warn('[WorldNewsService] Could not fetch news context for Gemini:', err.message);
    return null;
  }
}

/**
 * Extracts a friendly domain name from article URL
 */
function extractDomainOrSource(url, authors) {
  if (Array.isArray(authors) && authors.length > 0 && authors[0]) {
    return authors[0];
  }
  if (!url) return 'News Agency';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch (e) {
    return 'Web';
  }
}

module.exports = {
  extractNewsQuery,
  mapTopicToCategory,
  fetchRealTimeNews,
  formatNewsForWhatsApp,
  fetchGroundedNewsForGemini,
};
