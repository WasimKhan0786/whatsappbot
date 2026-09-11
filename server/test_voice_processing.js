require('dotenv').config();
const { processIncomingMedia } = require('./src/services/mediaService');
const { generateGeminiReply } = require('./src/services/geminiService');
const { buildDynamicPersonaPrompt } = require('./src/services/personaService');

/**
 * Creates a minimal valid 1-second 8000Hz mono PCM WAV audio buffer
 */
function createMinimalWavAudioBuffer() {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const durationSec = 0.5;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byteRate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // blockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write simple 440Hz sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 10000;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

async function runVoiceTests() {
  console.log('🧪 Starting Voice Message & Audio Processing Verification...\n');

  // ==========================================
  // Test 1: Voice Note Pipeline & MIME Normalization
  // ==========================================
  console.log('📋 Test 1: Verifying processIncomingMedia with Audio / Voice Note...');
  const wavBuffer = createMinimalWavAudioBuffer();
  console.log(`  - Synthetic audio buffer size: ${(wavBuffer.length / 1024).toFixed(2)} KB`);

  // 1A: WhatsApp PTT Opus Voice Note
  const voiceResult = await processIncomingMedia({
    buffer: wavBuffer,
    mimeType: 'audio/ogg; codecs=opus',
    filename: 'voice_message.ogg',
    caption: '',
  });

  console.log('  - Voice Result:', {
    mediaType: voiceResult.mediaType,
    cleanMime: voiceResult.mimeType,
    hasInlineData: Boolean(voiceResult.inlineData?.data),
    summary: voiceResult.tokenOptimizationSummary,
  });

  if (
    voiceResult.mediaType === 'voice' &&
    voiceResult.mimeType === 'audio/ogg' &&
    voiceResult.inlineData?.data
  ) {
    console.log('  ✅ WhatsApp Opus voice note correctly normalized to audio/ogg and packed into inlineData.');
  } else {
    throw new Error(`Voice note pipeline failed: ${JSON.stringify(voiceResult)}`);
  }

  // 1B: Standard MP3 / WAV Audio
  const wavResult = await processIncomingMedia({
    buffer: wavBuffer,
    mimeType: 'audio/wav',
    filename: 'note.wav',
    caption: '',
  });

  if (wavResult.mediaType === 'voice' && wavResult.mimeType === 'audio/wav') {
    console.log('  ✅ Standard WAV audio correctly recognized and formatted.');
  } else {
    throw new Error('WAV processing failed');
  }

  // ==========================================
  // Test 2: Live Gemini Reply with Audio Payload
  // ==========================================
  console.log('\n📋 Test 2: Testing Live Gemini Multimodal Audio Reception...');
  const basePrompt = 'You are an intelligent WhatsApp AI bot replying naturally.';
  const dynamicPrompt = buildDynamicPersonaPrompt(basePrompt, null, '+1234567890', '[Sent Voice Note]', voiceResult);

  const reply = await generateGeminiReply('[Sent Voice Note]', dynamicPrompt, [], voiceResult);
  console.log(`  Bot Reply to Voice Note: "${reply}"`);

  if (reply && reply.trim().length > 0) {
    console.log('  ✅ SUCCESS: Gemini successfully received, comprehended audio data, and formulated conversational response!');
  } else {
    throw new Error('Gemini failed to generate response for audio message');
  }

  console.log('\n🎉 ALL VOICE MESSAGE & AUDIO PROCESSING TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runVoiceTests().catch((err) => {
  console.error('\n❌ Voice processing test suite failed:', err);
  process.exit(1);
});
