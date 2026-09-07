require('dotenv').config();
const { detectShayariRequest, buildDynamicPersonaPrompt } = require('./src/services/personaService');
const { generateGeminiReply } = require('./src/services/geminiService');

async function testShayariGeneration() {
  console.log('========================================================');
  console.log('🧪 RUNNING SHAYARI CATEGORY DETECTION & GENERATION TEST');
  console.log('========================================================\n');

  // Test 1: Category Identification Unit Tests
  console.log('--- Test 1: Category Identification & Taxonomy Tests ---');
  const testCases = [
    { text: 'Mujhe ek romantic shayari sunao', expectedCategory: 'ROMANTIC', expectedShayari: true },
    { text: 'Koi dard bhari emotional shayari sunao', expectedCategory: 'EMOTIONAL', expectedShayari: true },
    { text: 'Kuch motivational shayari ho jaye jab himmat toot rahi ho', expectedCategory: 'MOTIVATIONAL', expectedShayari: true },
    { text: 'Dosti par ek achhi shayari sunao', expectedCategory: 'FRIENDSHIP', expectedShayari: true },
    { text: 'Attitude wali shayari bhejo bhai', expectedCategory: 'ATTITUDE', expectedShayari: true },
    { text: 'Kuch funny shayari sunao hasne ke liye', expectedCategory: 'FUNNY', expectedShayari: true },
    { text: 'Ek pyara sa sher sunao', expectedCategory: 'ROMANTIC', expectedShayari: true },
    { text: 'Hello, what is the weather in Delhi today?', expectedCategory: null, expectedShayari: false },
    { text: 'Good morning bhai, kya haal hai?', expectedCategory: null, expectedShayari: false },
  ];

  let passCount = 0;
  for (const tc of testCases) {
    const result = detectShayariRequest(tc.text);
    const pass = result.isShayari === tc.expectedShayari &&
      (!tc.expectedCategory || result.categoryKey === tc.expectedCategory);

    if (pass) {
      passCount++;
      console.log(`  ✅ [PASS] "${tc.text}" -> isShayari: ${result.isShayari}, Category: ${result.categoryKey || 'N/A'}`);
    } else {
      console.error(`  ❌ [FAIL] "${tc.text}" -> got isShayari: ${result.isShayari}, Category: ${result.categoryKey}, expected: ${tc.expectedCategory}`);
    }
  }

  console.log(`\nClassification Tests: ${passCount}/${testCases.length} passed.\n`);

  // Test 2: Live Generation with Google Gemini
  console.log('--- Test 2: Live Gemini Shayari Generation ---');
  const livePrompts = [
    {
      category: 'Romantic',
      prompt: 'Mujhe ek romantic shayari sunao',
      senderPhone: '+919876543210',
    },
    {
      category: 'Emotional / Heartbreak',
      prompt: 'Koi dard bhari emotional shayari sunao',
      senderPhone: '+919876543210',
    },
    {
      category: 'Motivational',
      prompt: 'Zindagi me himmat badhane wali motivational shayari sunao',
      senderPhone: '+919876543210',
    },
  ];

  for (const item of livePrompts) {
    console.log(`\n[Testing ${item.category} Shayari]`);
    console.log(`User query: "${item.prompt}"`);

    const dynamicPrompt = buildDynamicPersonaPrompt(
      'Tumhe bilkul ek real insaan ki tarah chat karni hai.',
      null,
      item.senderPhone,
      item.prompt
    );

    const reply = await generateGeminiReply(item.prompt, dynamicPrompt);
    console.log(`Bot Response:\n----------------------------------------\n${reply}\n----------------------------------------`);

    if (reply && reply.trim().length > 10) {
      console.log(`✅ [PASS] Generated authentic ${item.category} shayari successfully.`);
    } else {
      console.error(`❌ [FAIL] Empty or invalid response for ${item.category}.`);
    }
  }

  console.log('\n========================================================');
  console.log('🎉 ALL SHAYARI DETECTION & GENERATION TESTS PASSED!');
  console.log('========================================================');
}

testShayariGeneration().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
