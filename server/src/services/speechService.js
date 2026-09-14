const axios = require('axios');

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';
const MURF_API_URL = 'https://api.murf.ai/v1/speech/generate';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/**
 * Transcribes an incoming WhatsApp voice note or audio buffer using Deepgram Nova-2
 * @param {Buffer} audioBuffer - Binary audio buffer from Baileys
 * @param {string} [mimeType='audio/ogg'] - Audio mimetype
 * @returns {Promise<{ success: boolean, transcript: string, detectedLanguage: string, confidence: number }>}
 */
async function transcribeAudioWithDeepgram(audioBuffer, mimeType = 'audio/ogg') {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || !audioBuffer || audioBuffer.length === 0) {
    return { success: false, transcript: '', detectedLanguage: '', confidence: 0 };
  }

  try {
    console.log(`[Speech AI] 🎙️ Transcribing incoming audio via Deepgram Nova-2 (${audioBuffer.length} bytes, ${mimeType})...`);

    // Clean mimetype for Deepgram header
    const cleanMime = (mimeType || 'audio/ogg').split(';')[0].trim();

    const response = await axios.post(
      `${DEEPGRAM_API_URL}?model=nova-2&smart_format=true&detect_language=true&punctuate=true`,
      audioBuffer,
      {
        headers: {
          Authorization: `Token ${apiKey.trim()}`,
          'Content-Type': cleanMime || 'audio/ogg',
        },
        timeout: 15000,
      }
    );

    const result = response.data?.results?.channels?.[0]?.alternatives?.[0];
    const transcript = result?.transcript?.trim() || '';
    const detectedLanguage = response.data?.results?.channels?.[0]?.detected_language || 'en';
    const confidence = result?.confidence || 0;

    if (transcript) {
      console.log(`[Speech AI] ✅ Transcribed Audio successfully [Lang: ${detectedLanguage}, Conf: ${(confidence * 100).toFixed(1)}%]: "${transcript}"`);
      return { success: true, transcript, detectedLanguage, confidence };
    }

    return { success: false, transcript: '', detectedLanguage, confidence: 0 };
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.response?.data || err.message;
    console.warn(`[Speech AI] Deepgram transcription error:`, errorMsg);
    return { success: false, transcript: '', detectedLanguage: '', confidence: 0, error: String(errorMsg) };
  }
}

/**
 * Generates an ultra-realistic voice note from text using Murf AI (primary) or ElevenLabs (fallback)
 * @param {string} text - Text to speak
 * @param {object} [options]
 * @param {string} [options.voiceId] - Voice identifier
 * @param {string} [options.style] - Tone / persona
 * @returns {Promise<{ success: boolean, audioBuffer: Buffer|null, audioUrl: string|null, provider: string }>}
 */
async function synthesizeVoiceNote(text, options = {}) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return { success: false, audioBuffer: null, audioUrl: null, provider: 'none' };
  }

  // Sanitize text: remove markdown asterisks, emojis, and bracketed tags for natural speech
  const cleanText = text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[\u{1F600}-\u{1F6FF}|[\u{2600}-\u{26FF}]/gu, '')
    .trim()
    .substring(0, 800);

  if (!cleanText) {
    return { success: false, audioBuffer: null, audioUrl: null, provider: 'none' };
  }

  const murfKey = process.env.MURF_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;

  // 1. Primary Engine: Murf AI (163 natural voices, Indian/Hindi support)
  if (murfKey && !murfKey.includes('your_')) {
    try {
      console.log(`[Speech AI] 🗣️ Synthesizing Voice Note via Murf AI...`);
      const selectedVoice = options.voiceId || 'hi-IN-kabir'; // Natural Hindi/Indian voice

      const response = await axios.post(
        MURF_API_URL,
        {
          voiceId: selectedVoice,
          text: cleanText,
          format: 'MP3',
          channelType: 'MONO',
        },
        {
          headers: {
            'api-key': murfKey.trim(),
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const audioUrl = response.data?.audioFile;
      if (audioUrl) {
        // Download audio file to buffer for WhatsApp PTT delivery
        const audioDownload = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const audioBuffer = Buffer.from(audioDownload.data);

        console.log(`[Speech AI] ✅ Voice Note synthesized via Murf AI (${audioBuffer.length} bytes)`);
        return {
          success: true,
          audioBuffer,
          audioUrl,
          provider: 'MURF_AI',
        };
      }
    } catch (murfErr) {
      console.warn(`[Speech AI] Murf AI synthesis note:`, murfErr.response?.data || murfErr.message);
    }
  }

  // 2. Secondary Engine: ElevenLabs (if valid key is provided)
  if (elevenKey && !elevenKey.includes('your_')) {
    try {
      console.log(`[Speech AI] 🗣️ Attempting ElevenLabs Voice Note fallback...`);
      const voiceId = options.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel voice
      const response = await axios.post(
        `${ELEVENLABS_API_URL}/${voiceId}`,
        {
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        {
          headers: {
            'xi-api-key': elevenKey.trim(),
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
          timeout: 20000,
        }
      );

      const audioBuffer = Buffer.from(response.data);
      console.log(`[Speech AI] ✅ Voice Note synthesized via ElevenLabs (${audioBuffer.length} bytes)`);
      return {
        success: true,
        audioBuffer,
        audioUrl: null,
        provider: 'ELEVENLABS',
      };
    } catch (elevenErr) {
      console.warn(`[Speech AI] ElevenLabs synthesis note:`, elevenErr.response?.data || elevenErr.message);
    }
  }

  return { success: false, audioBuffer: null, audioUrl: null, provider: 'none' };
}

/**
 * Detects whether user explicitly requested a voice reply
 * @param {string} text
 * @param {boolean} isIncomingVoiceNote
 * @returns {boolean}
 */
function shouldReplyWithVoice(text = '', isIncomingVoiceNote = false) {
  if (isIncomingVoiceNote) return true;
  if (!text || typeof text !== 'string') return false;

  const lower = text.toLowerCase();
  return (
    /\b(voice note|audio me|bol ke|bolkar|voice recording|sunao|audio reply|voice message)\b/i.test(lower) ||
    lower.includes('/voice') ||
    lower.includes('/audio')
  );
}

module.exports = {
  transcribeAudioWithDeepgram,
  synthesizeVoiceNote,
  shouldReplyWithVoice,
};
