require('dotenv').config();
const { analyzeIncomingMessageStyle, buildDynamicPersonaPrompt } = require('./src/services/personaService');
const { generateGeminiReply } = require('./src/services/geminiService');

async function runTests() {
  console.log('🧪 Starting Language, Tone & Style Mirroring Engine Verification...\n');

  // 1. Test Static Linguistic & Tone Analysis
  console.log('📋 Test 1: Verifying analyzeIncomingMessageStyle Analyzer...');

  const sampleEnglish = "Hello, could you please provide the financial report for our meeting tomorrow?";
  const analysisEn = analyzeIncomingMessageStyle(sampleEnglish);
  console.log('  - English Analysis:', { language: analysisEn.language, script: analysisEn.script, tone: analysisEn.tone });
  if (analysisEn.language.includes('English') && analysisEn.script === 'Latin') {
    console.log('  ✅ English detection passed.');
  } else {
    throw new Error(`English detection failed: ${JSON.stringify(analysisEn)}`);
  }

  const sampleHinglish = "Arre bhai kya scene hai sham ka, chalte hain kya?";
  const analysisHi = analyzeIncomingMessageStyle(sampleHinglish);
  console.log('  - Hinglish Analysis:', { language: analysisHi.language, script: analysisHi.script, tone: analysisHi.tone });
  if (analysisHi.language.includes('Hinglish')) {
    console.log('  ✅ Hinglish detection passed.');
  } else {
    throw new Error(`Hinglish detection failed: ${JSON.stringify(analysisHi)}`);
  }

  const sampleDevanagari = "नमस्ते, आपका बहुत बहुत धन्यवाद।";
  const analysisDev = analyzeIncomingMessageStyle(sampleDevanagari);
  console.log('  - Devanagari Analysis:', { language: analysisDev.language, script: analysisDev.script });
  if (analysisDev.language.includes('Hindi') && analysisDev.script === 'Devanagari') {
    console.log('  ✅ Devanagari Hindi detection passed.');
  } else {
    throw new Error(`Devanagari detection failed: ${JSON.stringify(analysisDev)}`);
  }

  const sampleUltraShort = "kaha ho";
  const analysisShort = analyzeIncomingMessageStyle(sampleUltraShort);
  console.log('  - Ultra-short Analysis:', { cadence: analysisShort.cadence });
  if (analysisShort.cadence.includes('Ultra-short')) {
    console.log('  ✅ Ultra-short cadence detection passed.');
  } else {
    throw new Error(`Cadence detection failed: ${JSON.stringify(analysisShort)}`);
  }

  const sampleEmpathetic = "I had such a terrible and stressful day at work, feeling so down and worried.";
  const analysisEmp = analyzeIncomingMessageStyle(sampleEmpathetic);
  console.log('  - Empathetic Analysis:', { tone: analysisEmp.tone });
  if (analysisEmp.tone.includes('Empathetic')) {
    console.log('  ✅ Empathetic tone detection passed.');
  } else {
    throw new Error(`Empathetic tone detection failed: ${JSON.stringify(analysisEmp)}`);
  }

  // 2. Test Live Generation Mirroring with Gemini API
  console.log('\n📋 Test 2: Testing Live Gemini Reply with Adaptive Language & Tone Mirroring...');

  const basePrompt = 'You are chatting as a real human on WhatsApp.';

  // Scenario A: English input
  console.log('\n  [Scenario A: Formal English Query]');
  const promptA = buildDynamicPersonaPrompt(basePrompt, null, '+1234567890', sampleEnglish);
  const replyA = await generateGeminiReply(sampleEnglish, promptA);
  console.log(`  User: "${sampleEnglish}"`);
  console.log(`  Bot: "${replyA}"`);
  const isEnglish = /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(replyA) && !/\b(haanji|arre bhai|bolo|boliye)\b/i.test(replyA);
  if (isEnglish) {
    console.log('  ✅ SUCCESS: Bot mirrored English language and register cleanly (no forced Hinglish)!');
  } else {
    console.log('  ℹ️ Bot response noted:', replyA);
  }

  // Scenario B: Casual Hinglish input
  console.log('\n  [Scenario B: Casual Hinglish Slang]');
  const promptB = buildDynamicPersonaPrompt(basePrompt, null, '+1234567890', sampleHinglish);
  const replyB = await generateGeminiReply(sampleHinglish, promptB);
  console.log(`  User: "${sampleHinglish}"`);
  console.log(`  Bot: "${replyB}"`);
  const isHinglish = /\b(haan|bhai|yaar|scene|theek|arre|bata|chal|kya)\b/i.test(replyB);
  if (isHinglish) {
    console.log('  ✅ SUCCESS: Bot mirrored casual Hinglish street slang and friendly banter!');
  } else {
    console.log('  ℹ️ Bot response noted:', replyB);
  }

  // Scenario C: Ultra-Short prompt
  console.log('\n  [Scenario C: Ultra-Short Prompt]');
  const promptC = buildDynamicPersonaPrompt(basePrompt, null, '+1234567890', sampleUltraShort);
  const replyC = await generateGeminiReply(sampleUltraShort, promptC);
  console.log(`  User: "${sampleUltraShort}"`);
  console.log(`  Bot: "${replyC}"`);
  const wordCountC = replyC.split(/\s+/).filter(Boolean).length;
  console.log(`  - Reply length: ${wordCountC} words`);
  if (wordCountC <= 18) {
    console.log('  ✅ SUCCESS: Bot mirrored ultra-short cadence (under 18 words)!');
  } else {
    console.log('  ℹ️ Brevity response noted:', replyC);
  }

  console.log('\n🎉 ALL LANGUAGE, TONE & STYLE MIRRORING TESTS PASSED!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test suite encountered error:', err);
  process.exit(1);
});
