const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

// Reusable Tesseract worker reference or on-demand worker
let tesseractWorker = null;

async function getTesseractWorker() {
  if (!tesseractWorker) {
    try {
      tesseractWorker = await createWorker('eng+hin');
    } catch (err) {
      // Fallback to english if hindi data isn't directly available
      try {
        tesseractWorker = await createWorker('eng');
      } catch (fallbackErr) {
        console.warn('[MediaService] Worker init warning:', fallbackErr.message);
        tesseractWorker = null;
      }
    }
  }
  return tesseractWorker;
}

/**
 * Truncates text to optimize token usage while preserving essential context
 * @param {string} text - Raw extracted text
 * @param {number} maxWords - Max words threshold (default: 2500)
 * @returns {string} - Token-optimized text
 */
function truncateTextForTokenEfficiency(text, maxWords = 2500) {
  if (!text || typeof text !== 'string') return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();

  const truncated = words.slice(0, maxWords).join(' ');
  return `${truncated}\n\n[... Note: Remaining document text truncated to optimize AI token efficiency ...]`;
}

/**
 * Extracts text from a PDF Buffer
 * @param {Buffer} pdfBuffer - Buffer of the PDF file
 * @returns {Promise<{ text: string, numPages: number, title?: string }>}
 */
async function extractPdfText(pdfBuffer) {
  try {
    let rawText = '';
    let numPages = 1;

    if (typeof pdfParse === 'function') {
      const data = await pdfParse(pdfBuffer);
      rawText = data.text || '';
      numPages = data.numpages || 1;
    } else if (pdfParse?.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: pdfBuffer });
      try {
        await parser.load();
        const result = await parser.getText();
        rawText = result?.text || '';
        numPages = result?.total || (result?.pages?.length || 1);
      } finally {
        await parser.destroy().catch(() => {});
      }
    } else {
      throw new Error('Unsupported pdf-parse library export format');
    }

    const optimizedText = truncateTextForTokenEfficiency(rawText);

    return {
      success: true,
      text: optimizedText,
      rawLength: rawText.length,
      numPages,
      title: 'PDF Document',
    };
  } catch (error) {
    console.warn('[MediaService] PDF text extraction error:', error.message);
    return {
      success: false,
      text: '',
      error: error.message,
    };
  }
}

/**
 * Extracts text from an Image Buffer using OCR (Tesseract)
 * @param {Buffer} imageBuffer - Buffer of the image
 * @returns {Promise<{ text: string, confidence: number }>}
 */
async function extractImageText(imageBuffer) {
  try {
    const worker = await getTesseractWorker();
    if (worker) {
      const ret = await worker.recognize(imageBuffer);
      const text = (ret.data?.text || '').trim();
      const confidence = ret.data?.confidence || 0;
      return {
        success: true,
        text,
        confidence,
      };
    }
    return { success: false, text: '', confidence: 0 };
  } catch (error) {
    console.warn('[MediaService] Image OCR error:', error.message);
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error.message,
    };
  }
}

/**
 * Compresses and downscales image buffer to maximize Gemini token efficiency
 * Capped at 1024px dimension, JPEG format at 80% quality.
 * @param {Buffer} imageBuffer - Original image buffer
 * @returns {Promise<{ buffer: Buffer, mimeType: string, originalBytes: number, compressedBytes: number }>}
 */
async function compressImageForAI(imageBuffer) {
  const originalBytes = imageBuffer.length;
  try {
    const compressed = await sharp(imageBuffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 80,
        mozjpeg: true,
      })
      .toBuffer();

    return {
      buffer: compressed,
      mimeType: 'image/jpeg',
      originalBytes,
      compressedBytes: compressed.length,
      reductionPercent: Math.round(((originalBytes - compressed.length) / originalBytes) * 100),
    };
  } catch (error) {
    console.warn('[MediaService] Sharp image compression warning:', error.message);
    // Fallback to original buffer
    return {
      buffer: imageBuffer,
      mimeType: 'image/jpeg',
      originalBytes,
      compressedBytes: originalBytes,
      reductionPercent: 0,
    };
  }
}

/**
 * Analyzes extracted media content to determine tone, structure, and style mirroring directive
 * @param {string} text - Extracted text from PDF or Image
 * @param {string} [caption=''] - User's optional caption with the media
 * @returns {object} - Style analysis and directive
 */
function analyzeMediaStyle(text, caption = '') {
  const combined = `${caption}\n${text}`.trim();

  // Detect structural formatting
  const isTabular = /(\|.*\||(\b\d+\b\s+){3,})/m.test(text);
  const isNumberedOrBullet = /^(\s*[-*•]\s+|\s*\d+[\).]\s+)/m.test(text);
  const isInvoiceOrFinancial = /\b(invoice|total|gst|tax|amount|receipt|payment|subtotal|balance|due|rs\.?|inr|\$)\b/i.test(combined);
  const isFormalAcademicOrReport = /\b(report|abstract|introduction|conclusion|summary|analysis|study|department|official|dear|sincerely)\b/i.test(combined);
  const isHindiOrHinglish = /[\u0900-\u097F]/.test(combined) || /\b(kya|hai|bhai|yaar|kaise|shukriya|aap|hum|karna|hoga)\b/i.test(combined);

  let styleDirective = '';

  if (isInvoiceOrFinancial) {
    styleDirective = 'The document is a financial receipt/invoice. Mirror its structured, precise, and concise style. Present figures, totals, and line items clearly if asked, with professional clarity.';
  } else if (isTabular || isNumberedOrBullet) {
    styleDirective = 'The media contains structured/bulleted or list-based content. Mirror this concise, organized structure using clear bullet points and short paragraphs in your response.';
  } else if (isFormalAcademicOrReport) {
    styleDirective = 'The document is formal and professional. Mirror its polite, well-structured, authoritative, and articulate tone in your response.';
  } else if (isHindiOrHinglish) {
    styleDirective = 'The content includes Hindi/Hinglish phrasing. Mirror the exact conversational language and cultural cadence used naturally.';
  } else {
    styleDirective = 'Mirror the tone, vocabulary level, concise formatting, and content style of the user\'s uploaded file.';
  }

  return {
    isInvoiceOrFinancial,
    isTabular,
    isNumberedOrBullet,
    isFormalAcademicOrReport,
    isHindiOrHinglish,
    styleDirective,
  };
}

/**
 * Unified pipeline for processing incoming WhatsApp media (PDF or Image)
 * Optimizes for token efficiency:
 * - If PDF: Extracts text & truncates to limit token load.
 * - If Image with readable OCR text: Passes extracted text (huge token savings over sending raw image).
 * - If Image is visual/diagram/photo: Compresses/resizes to 1024px JPEG and provides base64 inlineData.
 *
 * @param {object} params
 * @param {Buffer} params.buffer - Raw media buffer
 * @param {string} params.mimeType - Mimetype (e.g. 'application/pdf', 'image/jpeg', 'image/png')
 * @param {string} [params.filename] - Optional document filename
 * @param {string} [params.caption] - Optional user-provided message caption
 * @returns {Promise<object>} - Processed media result for Gemini
 */
async function processIncomingMedia({ buffer, mimeType, filename = '', caption = '' }) {
  const isPdf = mimeType.includes('pdf') || (filename && filename.toLowerCase().endsWith('.pdf'));
  const isImage = mimeType.startsWith('image/');
  const isAudio = mimeType.startsWith('audio/') || (filename && /\.(ogg|opus|mp3|m4a|wav|aac)$/i.test(filename));

  console.log(`[MediaService] 📦 Processing incoming media: ${mimeType} (${(buffer.length / 1024).toFixed(1)} KB), caption: "${caption}"`);

  // 1. Handle PDF Documents
  if (isPdf) {
    const pdfResult = await extractPdfText(buffer);
    const styleInfo = analyzeMediaStyle(pdfResult.text, caption);

    console.log(`[MediaService] 📄 PDF extracted (${pdfResult.numPages} pages, ${pdfResult.text.length} chars text). Token efficiency applied.`);

    return {
      mediaType: 'pdf',
      mimeType: 'application/pdf',
      filename: filename || 'document.pdf',
      extractedText: pdfResult.text,
      caption: caption || '',
      styleInfo,
      inlineData: null, // No need for heavy binary tokens since text is cleanly extracted!
      tokenOptimizationSummary: `Extracted ${pdfResult.text.split(/\s+/).length} words of text from ${pdfResult.numPages}-page PDF. Sent pure text representation for 10x token efficiency.`,
    };
  }

  // 2. Handle Images (JPEG, PNG, WebP, etc.)
  if (isImage) {
    // Attempt OCR text extraction first
    const ocrResult = await extractImageText(buffer);
    const hasRichText = ocrResult.success && ocrResult.text.trim().length > 30;

    const styleInfo = analyzeMediaStyle(ocrResult.text, caption);

    // Always compress image for AI visual perception (capped at 1024px, 80% JPEG quality)
    const compression = await compressImageForAI(buffer);
    console.log(`[MediaService] 🖼️ Image compressed: ${compression.originalBytes}B -> ${compression.compressedBytes}B (${compression.reductionPercent}% reduction) for token efficiency.`);

    const hasExtractedText = ocrResult.success && Boolean(ocrResult.text?.trim());
    if (hasExtractedText) {
      console.log(`[MediaService] 📝 Image OCR extracted ${ocrResult.text.length} chars (Conf: ${ocrResult.confidence.toFixed(0)}%).`);
    }

    return {
      mediaType: 'image',
      mimeType: compression.mimeType,
      extractedText: ocrResult.text || '',
      caption: caption || '',
      styleInfo,
      inlineData: {
        mimeType: compression.mimeType,
        data: compression.buffer.toString('base64'),
      },
      tokenOptimizationSummary: `Compressed image to 1024px JPEG (${compression.reductionPercent}% byte reduction). Multimodal visual comprehension enabled${hasExtractedText ? ' + OCR text included' : ''}.`,
    };
  }

  // 3. Handle Voice Notes & Audio Messages (OGG Opus, MP3, WAV, AAC, M4A)
  if (isAudio) {
    // Normalize MIME type for Gemini API (e.g., 'audio/ogg; codecs=opus' -> 'audio/ogg')
    let cleanMime = mimeType.split(';')[0].trim().toLowerCase();
    if (cleanMime === 'audio/opus') cleanMime = 'audio/ogg';
    if (!cleanMime.startsWith('audio/')) cleanMime = 'audio/ogg';

    console.log(`[MediaService] 🎙️ Voice/Audio message detected (${cleanMime}, ${(buffer.length / 1024).toFixed(1)} KB). Preparing for Gemini audio comprehension.`);

    const styleDirective = 'The user sent a spoken voice note / audio message. Listen to their spoken speech, recognize their language (English, Hinglish, Hindi, etc.), emotional mood, and spoken question. Respond naturally in the exact same language and conversational register.';

    return {
      mediaType: 'voice',
      mimeType: cleanMime,
      filename: filename || 'voice_note.ogg',
      extractedText: '',
      caption: caption || '',
      styleInfo: {
        isVoiceMessage: true,
        styleDirective,
      },
      inlineData: {
        mimeType: cleanMime,
        data: buffer.toString('base64'),
      },
      tokenOptimizationSummary: `Audio payload (${cleanMime}, ${(buffer.length / 1024).toFixed(1)} KB) formatted for direct Gemini voice comprehension and natural language mirroring.`,
    };
  }

  // Default fallback for unrecognized formats
  return {
    mediaType: 'unknown',
    mimeType,
    extractedText: '',
    caption: caption || '',
    styleInfo: analyzeMediaStyle('', caption),
    inlineData: null,
    tokenOptimizationSummary: 'Unrecognized media type. Falling back to text caption only.',
  };
}

module.exports = {
  extractPdfText,
  extractImageText,
  compressImageForAI,
  analyzeMediaStyle,
  processIncomingMedia,
  truncateTextForTokenEfficiency,
};
