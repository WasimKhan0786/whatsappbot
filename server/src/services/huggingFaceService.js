const fs = require('fs');
const path = require('path');
const { HfInference } = require('@huggingface/inference');

/**
 * Hugging Face Text-to-Image Generation Service
 * 
 * Supports:
 * 1. Fast regex detection for image generation requests in English & Hinglish
 * 2. High-resolution diffusion generation using Hugging Face models (e.g. FLUX.1-schnell, SDXL)
 * 3. Local file persistence and URL generation for WhatsApp transmission
 */

const GENERATED_IMAGES_DIR = path.resolve(__dirname, '../../public/generated_images');

// Ensure storage directory exists
if (!fs.existsSync(GENERATED_IMAGES_DIR)) {
  fs.mkdirSync(GENERATED_IMAGES_DIR, { recursive: true });
}

/**
 * Checks if incoming text is asking to generate/draw an image and extracts the prompt.
 * 
 * @param {string} text - The raw incoming WhatsApp text message
 * @returns {{ isImageRequest: boolean, prompt: string|null }}
 */
function extractImagePrompt(text) {
  if (!text || typeof text !== 'string') {
    return { isImageRequest: false, prompt: null };
  }

  const clean = text.trim();

  // Pattern 1: Slash command or direct commands (/image, /imagine, /draw, /photo)
  const cmdMatch = clean.match(/^[\/!#]?(image|imagine|draw|generate_image|generateimage|photo)\s+(.+)$/i);
  if (cmdMatch && cmdMatch[2]) {
    return { isImageRequest: true, prompt: cmdMatch[2].trim() };
  }

  // Pattern 2: English natural language requests
  // e.g. "generate an image of a red cat", "create a picture of a spaceship", "draw me a sunset", "make an image of..."
  const englishMatch = clean.match(
    /^(please\s+)?(generate|create|make|draw|paint|render)\s+(an?\s+)?(image|picture|photo|illustration|art|painting|drawing)\s+(of|for|showing|depicting)?\s+(.+)$/i
  );
  if (englishMatch && englishMatch[6]) {
    return { isImageRequest: true, prompt: englishMatch[6].trim() };
  }

  // Pattern 3: Hinglish requests
  // e.g. "ek billi ki photo banao", "supercar ki image generate karo", "taj mahal ki tasveer dikhao", "photo bana kar bhejo"
  const hinglishMatch = clean.match(
    /(?:ek\s+)?(.+?)\s+ki\s+(photo|image|tasveer|pic|picture)\s+(banao|generate\s*karo|dikhao|bhejo|create\s*karo)/i
  );
  if (hinglishMatch && hinglishMatch[1]) {
    const extractedSubject = hinglishMatch[1].trim();
    // Exclude generic queries like "kisi cheez ki photo bhejo" without real prompt
    if (extractedSubject.length > 2) {
      return { isImageRequest: true, prompt: `${extractedSubject}, realistic, high quality, 4k` };
    }
  }

  const hinglishMatch2 = clean.match(
    /(photo|image|tasveer|pic)\s+(banao|generate\s*karo|create\s*karo)\s+(?:of\s+|for\s+)?(.+)/i
  );
  if (hinglishMatch2 && hinglishMatch2[3]) {
    return { isImageRequest: true, prompt: hinglishMatch2[3].trim() };
  }

  return { isImageRequest: false, prompt: null };
}

/**
 * Calls Hugging Face text-to-image inference and saves the image to disk.
 * 
 * @param {string} prompt - Clean description of the image to generate
 * @param {string} [modelName] - Optional Hugging Face model ID
 * @returns {Promise<{ success: boolean, buffer: Buffer, filename: string, localPath: string, publicUrl: string, prompt: string, model: string }>}
 */
async function generateHuggingFaceImage(prompt, modelName = 'black-forest-labs/FLUX.1-schnell') {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('HUGGINGFACE_API_KEY is not configured in server environment variables.');
  }

  const hf = new HfInference(apiKey.trim());
  const selectedModel = modelName || 'black-forest-labs/FLUX.1-schnell';

  console.log(`[HuggingFace] 🎨 Generating text-to-image with model: ${selectedModel}`);
  console.log(`[HuggingFace] 📝 Prompt: "${prompt}"`);

  const startTime = Date.now();
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const options = {
        model: selectedModel,
        inputs: prompt,
      };

      // Only pass negative_prompt to Stable Diffusion models (not FLUX)
      if (selectedModel.toLowerCase().includes('stable-diffusion')) {
        options.parameters = {
          negative_prompt: 'ugly, deformed, blurry, low quality, disfigured, bad anatomy',
        };
      }

      const blob = await hf.textToImage(options);
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`[HuggingFace] ✅ Image generated in ${duration}s! Size: ${(buffer.length / 1024).toFixed(1)} KB (attempt ${attempt})`);

      // Generate unique filename
      const filename = `hf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
      const localPath = path.join(GENERATED_IMAGES_DIR, filename);

      // Save to server storage
      fs.writeFileSync(localPath, buffer);

      const publicUrl = `/generated-images/${filename}`;

      return {
        success: true,
        buffer,
        filename,
        localPath,
        publicUrl,
        prompt,
        model: selectedModel,
        durationSeconds: Number(duration),
      };
    } catch (error) {
      lastError = error;
      console.warn(`[HuggingFace] ⚠️ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  console.error(`[HuggingFace] ❌ Text-to-image generation failed after ${maxRetries} attempts:`, lastError?.message);
  throw new Error(`Hugging Face image generation error: ${lastError?.message}`);
}

module.exports = {
  extractImagePrompt,
  generateHuggingFaceImage,
  GENERATED_IMAGES_DIR,
};
