const axios = require('axios');

const SPOONACULAR_API_URL = 'https://api.spoonacular.com/recipes';

/**
 * Extracts recipe / cooking intent from message
 * @param {string} text
 * @returns {{ isRecipeRequest: boolean, dish: string }}
 */
function extractRecipeQuery(text) {
  if (!text || typeof text !== 'string') return { isRecipeRequest: false, dish: '' };

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Pattern: "<dish> recipe", "recipe of <dish>", "<dish> kaise banaye", "how to make <dish>"
  const match1 = lower.match(/(?:recipe of|how to make|kaise banate hain|kaise banaye|ki recipe|ki vidhi)\s+(.+)/i);
  if (match1 && match1[1]) {
    return { isRecipeRequest: true, dish: match1[1].replace(/recipe|batao|chahiye/gi, '').trim() };
  }

  const match2 = lower.match(/^(.+?)\s+(?:recipe|ki recipe|banana sikhao|kaise banaye)$/i);
  if (match2 && match2[1]) {
    return { isRecipeRequest: true, dish: match2[1].trim() };
  }

  if (/\b(recipe|khana banana|pakwan)\b/i.test(lower) && trimmed.length < 40) {
    const dish = trimmed.replace(/\b(recipe|batao|bhejo|mujhe|chahiye|ki|kaise)\b/gi, '').trim();
    if (dish.length >= 3) {
      return { isRecipeRequest: true, dish };
    }
  }

  return { isRecipeRequest: false, dish: '' };
}

/**
 * Fetches dish recipe and cooking instructions from Spoonacular
 * @param {string} dish - Dish name
 * @returns {Promise<{ success: boolean, title: string, readyInMinutes: number, servings: number, ingredients: string[], instructions: string[] }>}
 */
async function fetchRecipe(dish) {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey || !dish || apiKey.includes('your_')) {
    return { success: false, title: dish, readyInMinutes: 0, servings: 0, ingredients: [], instructions: [] };
  }

  try {
    console.log(`[Recipe AI] 🍳 Fetching Spoonacular recipe for: "${dish}"...`);
    const res = await axios.get(`${SPOONACULAR_API_URL}/complexSearch`, {
      params: {
        apiKey: apiKey.trim(),
        query: dish,
        addRecipeInformation: true,
        fillIngredients: true,
        number: 1,
      },
      timeout: 10000,
    });

    const item = res.data?.results?.[0];
    if (!item) {
      return { success: false, title: dish, readyInMinutes: 0, servings: 0, ingredients: [], instructions: [] };
    }

    // Extract ingredients
    const ingredients = (item.extendedIngredients || []).map(
      (ing) => `${ing.original || ing.name}`
    );

    // Extract step-by-step instructions
    const instructions = [];
    const analyzedSteps = item.analyzedInstructions?.[0]?.steps || [];
    if (analyzedSteps.length > 0) {
      analyzedSteps.forEach((s) => instructions.push(s.step));
    } else if (item.instructions) {
      instructions.push(item.instructions.replace(/<[^>]*>?/gm, '').trim());
    }

    return {
      success: true,
      title: item.title,
      readyInMinutes: item.readyInMinutes || 30,
      servings: item.servings || 4,
      imageUrl: item.image || null,
      ingredients,
      instructions,
    };
  } catch (err) {
    console.warn('[Recipe AI] Spoonacular error:', err.response?.data || err.message);
    return { success: false, title: dish, readyInMinutes: 0, servings: 0, ingredients: [], instructions: [] };
  }
}

/**
 * Formats recipe into WhatsApp message
 * @param {object} recipeData
 * @param {string} dishQuery
 * @returns {string}
 */
function formatRecipeForWhatsApp(recipeData, dishQuery) {
  if (!recipeData || !recipeData.success) {
    return `🍳 *Recipe Search:* _"${dishQuery}"_\n\nMaaf kijiye, is dish ki recipe database me nahi mili. Kripya kisi doosri dish ka naam likhein.`;
  }

  const lines = [`🍲 *${recipeData.title}* 👩‍🍳\n`];
  lines.push(`⏱️ *Prep & Cook Time:* ${recipeData.readyInMinutes} Minutes`);
  lines.push(`🍽️ *Servings:* ${recipeData.servings} Persons\n`);

  if (recipeData.ingredients && recipeData.ingredients.length > 0) {
    lines.push(`🛒 *Key Ingredients (Samagri):*`);
    recipeData.ingredients.slice(0, 8).forEach((ing) => {
      lines.push(`• ${ing}`);
    });
    lines.push('');
  }

  if (recipeData.instructions && recipeData.instructions.length > 0) {
    lines.push(`👨‍🍳 *Step-by-Step Cooking Instructions:*`);
    recipeData.instructions.slice(0, 6).forEach((step, idx) => {
      lines.push(`*Step ${idx + 1}:* ${step}`);
    });
    lines.push('');
  }

  lines.push(`_Bon Appétit! Delicious cooking powered by Spoonacular Culinary Engine_`);
  return lines.join('\n');
}

module.exports = {
  extractRecipeQuery,
  fetchRecipe,
  formatRecipeForWhatsApp,
};
