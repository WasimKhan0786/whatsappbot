const { generateGeminiReply } = require('./geminiService');
const { generateGroqReply, isGroqAvailable } = require('./groqService');
const { generateCloudflareReply } = require('./cloudflareAiService');
const { queryRelevantHistory, formatSemanticContextForPrompt } = require('./pineconeService');
const { fetchCurrentWeather, extractWeatherQuery } = require('./weatherService');
const { searchWebLive, extractLiveSearchQuery } = require('./webSearchService');
const { extractFinanceQuery, fetchMarketRate } = require('./financeService');
const { extractRecipeQuery, fetchRecipe } = require('./recipeService');

/**
 * Classifies whether an incoming query is routine/lightweight or complex/multilingual
 * @param {string} text - Message text
 * @param {object|null} mediaPayload - Attached media
 * @returns {'ROUTINE' | 'COMPLEX'}
 */
function classifyQueryComplexity(text, mediaPayload = null) {
  // Multimodal media queries require Gemini's vision / document analysis
  if (mediaPayload) {
    return 'COMPLEX';
  }

  if (!text || typeof text !== 'string') {
    return 'ROUTINE';
  }

  const trimmed = text.trim();

  // Very short greetings / pleasantries / affirmations
  if (/^(hi|hello|hey|salam|namaste|ok|okay|haan|theek|hmm|yes|no|thanks|shukriya|bye)\b/i.test(trimmed) && trimmed.length < 35) {
    return 'ROUTINE';
  }

  // Quick single-sentence questions (weather, simple definitions, short FAQs)
  const isShortGeneralQuery = trimmed.length < 60 && !/\b(kyun|kaise|explain|compare|describe|detail|code|algorithm|history|science|math)\b/i.test(trimmed);
  if (isShortGeneralQuery) {
    return 'ROUTINE';
  }

  // Deep reasoning, technical queries, or long multi-sentence instructions
  return 'COMPLEX';
}

/**
 * Intelligent Multi-Model AI Orchestrator:
 * 1. Queries Pinecone vector memory for relevant past context.
 * 2. Injects real-time grounding (Weather, Live Search, Finance, Recipes).
 * 3. Routes routine queries to Groq for ultra-fast replies (or Cloudflare Workers AI).
 * 4. Reserves Google Gemini for complex reasoning, multilingual subtleties, and media.
 * 5. Ensures graceful fallbacks so a high-quality reply is always produced.
 *
 * @param {object} options
 * @param {string} options.userMessage - Incoming message text
 * @param {string} options.senderPhone - Sender phone number / unique ID
 * @param {string} options.dynamicPrompt - System persona prompt
 * @param {Array} [options.chatHistory=[]] - Multi-turn conversation history
 * @param {object|null} [options.mediaPayload=null] - Processed media data (image, audio, PDF)
 * @returns {Promise<{ replyText: string, provider: 'GROQ' | 'GEMINI' | 'CLOUDFLARE_AI', pineconeMatchesCount: number }>}
 */
async function routeAndGenerateAiReply({
  userMessage,
  senderPhone,
  sender,
  dynamicPrompt,
  chatHistory = [],
  mediaPayload = null,
}) {
  const targetSender = senderPhone || sender || '';

  // 1. Query Pinecone vector database for relevant past interactions
  let semanticContext = '';
  let pineconeMatches = [];
  try {
    pineconeMatches = await queryRelevantHistory(targetSender, userMessage);
    semanticContext = formatSemanticContextForPrompt(pineconeMatches);
  } catch (pinErr) {
    console.warn('[AI Router] Pinecone query note:', pinErr.message);
  }

  // 1b. Real-time Weather Context Injection (Grounding)
  try {
    const weatherReq = extractWeatherQuery(userMessage);
    if (weatherReq.isWeatherRequest && weatherReq.city) {
      const liveW = await fetchCurrentWeather({ city: weatherReq.city });
      if (liveW.success) {
        semanticContext = `${semanticContext}\n\n[VERIFIED LIVE WEATHER DATA for ${liveW.city}, ${liveW.country}]: Temperature is ${liveW.temp}°C (feels like ${liveW.feelsLike}°C), condition: ${liveW.condition} (${liveW.description}), humidity: ${liveW.humidity}%, wind: ${liveW.windSpeed}m/s. Answer accurately with this real-time data!`;
      }
    }
  } catch (wErr) {}

  // 1c. Live AI Web Search Grounding (Tavily + Serper)
  try {
    const searchExtraction = extractLiveSearchQuery(userMessage);
    if (searchExtraction.isSearchRequest && searchExtraction.query) {
      const liveSearch = await searchWebLive(searchExtraction.query);
      if (liveSearch.success) {
        const topSnippets = liveSearch.results.map((r) => `${r.title}: ${r.snippet}`).join(' | ');
        semanticContext = `${semanticContext}\n\n[VERIFIED LIVE WEB SEARCH for "${searchExtraction.query}"]: Direct Answer: "${liveSearch.answer || 'N/A'}". Web Updates: ${topSnippets}. Use this fresh verified web data to answer!`;
      }
    }
  } catch (searchErr) {}

  // 1d. Financial Market & Crypto Grounding
  try {
    const finReq = extractFinanceQuery(userMessage);
    if (finReq.isFinanceRequest) {
      const liveFin = await fetchMarketRate(finReq);
      if (liveFin.success) {
        semanticContext = `${semanticContext}\n\n[VERIFIED LIVE FINANCIAL DATA for ${liveFin.name}]: INR Price: ₹${liveFin.priceInr || 'N/A'}, USD Price: $${liveFin.priceUsd || 'N/A'}, 24h Change: ${liveFin.change24h}%. Answer with this verified data!`;
      }
    }
  } catch (finErr) {}

  // 1e. Recipe Context Grounding (Spoonacular)
  try {
    const recipeReq = extractRecipeQuery(userMessage);
    if (recipeReq.isRecipeRequest && recipeReq.dish) {
      const liveRecipe = await fetchRecipe(recipeReq.dish);
      if (liveRecipe.success) {
        semanticContext = `${semanticContext}\n\n[VERIFIED RECIPE DATA for ${liveRecipe.title}]: Cook Time: ${liveRecipe.readyInMinutes}m, Ingredients: ${liveRecipe.ingredients.slice(0, 6).join(', ')}. Steps: ${liveRecipe.instructions.slice(0, 3).join(' ')}`;
      }
    }
  } catch (recipeErr) {}

  // 2. Classify query complexity
  const queryComplexity = classifyQueryComplexity(userMessage, mediaPayload);
  console.log(`[AI Router] 🧭 Query Complexity classified as: [${queryComplexity}] for ${targetSender}`);

  let replyText = null;
  let chosenProvider = 'GEMINI';

  // 3. Route Routine Queries to Groq for lightning-fast replies
  if (queryComplexity === 'ROUTINE' && !mediaPayload) {
    if (isGroqAvailable()) {
      try {
        console.log(`[AI Router] ⚡ Routing routine query to Groq (Llama-3.3-70b)...`);
        replyText = await generateGroqReply(userMessage, dynamicPrompt, chatHistory, semanticContext);
        if (replyText) {
          chosenProvider = 'GROQ';
        }
      } catch (groqErr) {
        console.warn('[AI Router] Groq attempt note:', groqErr.message);
      }
    }

    // Secondary fast fallback: Cloudflare Workers AI
    if (!replyText) {
      try {
        console.log(`[AI Router] ☁️ Attempting routine query with Cloudflare Workers AI...`);
        replyText = await generateCloudflareReply(userMessage, dynamicPrompt, chatHistory, semanticContext);
        if (replyText) {
          chosenProvider = 'CLOUDFLARE_AI';
        }
      } catch (cfErr) {
        console.warn('[AI Router] Cloudflare Workers AI attempt note:', cfErr.message);
      }
    }
  }

  // 4. Complex Reasoning, Multilingual Depth, or Fallback -> Google Gemini
  if (!replyText) {
    console.log(`[AI Router] 🧠 Routing to Google Gemini for complex reasoning and deep context...`);
    replyText = await generateGeminiReply(
      userMessage,
      dynamicPrompt,
      chatHistory,
      mediaPayload,
      semanticContext
    );
    chosenProvider = 'GEMINI';
  }

  return {
    replyText,
    provider: chosenProvider,
    pineconeMatchesCount: pineconeMatches.length,
  };
}

module.exports = {
  routeAndGenerateAiReply,
  classifyQueryComplexity,
};
