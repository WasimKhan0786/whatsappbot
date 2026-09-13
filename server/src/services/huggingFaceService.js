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
 * Supports all common English, Hindi, Hinglish, and Urdu phrasings (commands, natural questions, statements).
 * 
 * @param {string} text - The raw incoming WhatsApp text message
 * @returns {{ isImageRequest: boolean, prompt: string|null }}
 */
function extractImagePrompt(text) {
  if (!text || typeof text !== 'string') {
    return { isImageRequest: false, prompt: null };
  }

  const clean = text.trim();

  // Pattern 1: Slash command or direct commands (/image, /imagine, /draw, /photo, !photo, etc.)
  const cmdMatch = clean.match(/^[\/!#]?(?:image|imagine|draw|generate_image|generateimage|genimage|photo|pic)\s+(.+)$/i);
  if (cmdMatch && cmdMatch[1]) {
    return { isImageRequest: true, prompt: sanitizePrompt(cmdMatch[1]) };
  }

  // Common keywords & regex components
  const IMAGE_WORDS = '(?:image|images|img|imgs|picture|pictures|photo|photos|photu|photua|pic|pics|tasveer|tasveerein|taswiren|dp|wallpaper|art|artwork|drawing|painting|illustration|sketch)';
  const CREATE_VERBS_HI = '(?:banao|banado|bana\\s*do|bana\\s*de|bana\\s*dena|banaoge|bana\\s*doge|bana\\s*sakoge|bana\\s*sakte\\s*ho|generate\\s*(?:karo|kardo|krdo|kar\\s*do|karoge)|create\\s*(?:karo|kardo|krdo|kar\\s*do)|bhejo|bhej\\s*do|bhejna|bhejoge|send\\s*(?:karo|kardo|krdo|kar\\s*do)|dikhao|dikhado|dikha\\s*do|dikhaoge|chahiye|mangta|honi\\s*chahiye)';
  const CREATE_VERBS_EN = '(?:generate|create|make|draw|paint|render|send|show|give|produce)';

  // Pattern 2: Hinglish: (ek)? (subject) (ki/ka/ke/wali/wala) (image_words) (verb)?
  // e.g. "Ek cat ki image banado", "Generate a cat images", "Ek cat ki images banaoge", "sher ka photo banao", "dog ki pic bhejo"
  const hiPattern1 = new RegExp(
    '(?:(?:mujhe|humko|kripya|please)\\s+)?(?:ek\\s+)?(.+?)\\s+(?:ki|ka|ke|wali|wala)\\s+' +
      IMAGE_WORDS +
      '(?:\\s+' +
      CREATE_VERBS_HI +
      ')?(?:\\s+(?:please|bhai|yaar|na|fast|jaldi))?$',
    'i'
  );
  const hiMatch1 = clean.match(hiPattern1);
  if (hiMatch1 && hiMatch1[1]) {
    const rawSubject = hiMatch1[1].replace(/^(?:mujhe|humko|kripya|please|can\s+you)\s+/i, '').trim();
    if (rawSubject.length > 1 && !/^(?:kya|kyu|kaise|kab|kaha|who|why|what|how)$/i.test(rawSubject)) {
      return { isImageRequest: true, prompt: sanitizePrompt(rawSubject) };
    }
  }

  // Pattern 3: Hinglish: (image_word) (create_verb) (of/ki/ka)? (subject)
  // e.g. "photo banao cat ki", "image banado taj mahal ki", "pic bhejo ek car ki"
  const hiPattern2 = new RegExp(
    '^' + IMAGE_WORDS + '\\s+' + CREATE_VERBS_HI + '(?:\\s+(?:of|for|ki|ka|ke))?\\s+(.+)$',
    'i'
  );
  const hiMatch2 = clean.match(hiPattern2);
  if (hiMatch2 && hiMatch2[1]) {
    return { isImageRequest: true, prompt: sanitizePrompt(hiMatch2[1]) };
  }

  // Pattern 4: English Natural: (can you)? (verb) (me/us)? (an)? (image_word) of/for (subject)
  // e.g. "generate an image of a red cat", "create a picture of a spaceship", "draw me a sunset", "make an image of..."
  const enPattern1 = new RegExp(
    '^(?:can\\s+you\\s+|could\\s+you\\s+|please\\s+|i\\s+want\\s+)?' +
      CREATE_VERBS_EN +
      '(?:\\s+(?:me|us))?(?:\\s+(?:an?|the|some))?\\s+' +
      IMAGE_WORDS +
      '(?:\\s+(?:of|for|showing|depicting))?\\s+(.+)$',
    'i'
  );
  const enMatch1 = clean.match(enPattern1);
  if (enMatch1 && enMatch1[1]) {
    return { isImageRequest: true, prompt: sanitizePrompt(enMatch1[1]) };
  }

  // Pattern 5: English Natural: (can you)? (verb) (me/us)? (an)? (subject) (image_word)
  // e.g. "Generate a cat images", "create batman photo", "send cat pictures", "draw sunset art"
  const enPattern2 = new RegExp(
    '^(?:can\\s+you\\s+|could\\s+you\\s+|please\\s+|i\\s+want\\s+)?' +
      CREATE_VERBS_EN +
      '(?:\\s+(?:me|us))?(?:\\s+(?:an?|the|some))?\\s+(.+?)\\s+' +
      IMAGE_WORDS +
      '(?:\\s+(?:please|fast|now))?$',
    'i'
  );
  const enMatch2 = clean.match(enPattern2);
  if (enMatch2 && enMatch2[1]) {
    return { isImageRequest: true, prompt: sanitizePrompt(enMatch2[1]) };
  }

  // Pattern 6: Concise (subject) (image_word)
  // e.g. "cat images", "supercar wallpaper", "cute puppy photo"
  const enPattern3 = new RegExp('^(?:a|an|the|some)?\\s*(.+?)\\s+' + IMAGE_WORDS + '$', 'i');
  const enMatch3 = clean.match(enPattern3);
  if (enMatch3 && enMatch3[1] && clean.split(/\s+/).length <= 5) {
    const s = enMatch3[1].trim();
    if (s.length > 2 && !/^(?:what|where|how|who|why|profile|dp)$/i.test(s)) {
      return { isImageRequest: true, prompt: sanitizePrompt(s) };
    }
  }

  return { isImageRequest: false, prompt: null };
}

/**
 * Normalizes and formats the raw user subject into a rich prompt suitable for diffusion models
 */
function sanitizePrompt(raw) {
  if (!raw) return 'a beautiful scene, photorealistic, 4k';
  let cleaned = raw
    .replace(/^(?:ek\s+|a\s+|an\s+|the\s+|some\s+|please\s+|bhai\s+|yaar\s+)+/gi, '')
    .replace(/(?:\s+(?:ki|ka|ke|banao|banado|bana\s*do|bhejo|dikhao|send\s*karo|please|chahiye))+$/gi, '')
    .trim();

  // Basic dictionary map for common Hindi/Hinglish nouns
  const hindiToEng = {
    billi: 'cat',
    kutta: 'dog',
    sher: 'lion',
    haathi: 'elephant',
    hathi: 'elephant',
    ghoda: 'horse',
    gaadi: 'car',
    gadi: 'car',
    phool: 'flower',
    gulab: 'red rose',
    ladka: 'young boy',
    ladki: 'young girl',
    pahad: 'mountains',
    samundar: 'ocean',
  };

  const lower = cleaned.toLowerCase();
  if (hindiToEng[lower]) {
    cleaned = hindiToEng[lower];
  }

  // If prompt is short (1-3 words), enhance with photorealistic qualities
  if (cleaned.split(/\s+/).length <= 3) {
    return `${cleaned}, photorealistic, high quality, 4k, detailed, professional lighting`;
  }

  return cleaned;
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
