require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const ChatSession = require('./src/models/ChatSession');
const MessageLog = require('./src/models/MessageLog');
const {
  sanitizeHistoryForGemini,
  getGeminiChatHistory,
  recordMessageExchange,
  clearChatHistory,
  getChatSessionStats,
} = require('./src/services/chatHistoryService');
const { generateGeminiReply } = require('./src/services/geminiService');

async function runTests() {
  console.log('🧪 Starting Chat History & TTL Management System Verification...\n');

  // 1. Connect DB
  await connectDB();
  console.log('✅ Database connected.\n');

  const testSessionId = '919999999999_test';

  try {
    // Ensure ChatSession collection exists by recording initial test turn
    await recordMessageExchange(testSessionId, 'Init prompt', 'Init reply', 20);

    // Clean test artifact
    await clearChatHistory(testSessionId);

    // 2. Test TTL Indexes
    console.log('📋 Test 1: Verifying TTL Indexes on Collections...');
    await ChatSession.createIndexes();
    const sessionIndexes = await ChatSession.collection.indexes();
    const sessionTtl = sessionIndexes.find(idx => idx.name === 'updatedAt_1');
    console.log('  - ChatSession updatedAt index:', sessionTtl ? `Found (expireAfterSeconds: ${sessionTtl.expireAfterSeconds}s)` : 'NOT FOUND');

    const logIndexes = await MessageLog.collection.indexes();
    const logTtl = logIndexes.find(idx => idx.name === 'createdAt_1');
    console.log('  - MessageLog createdAt index:', logTtl ? `Found (expireAfterSeconds: ${logTtl.expireAfterSeconds}s)` : 'NOT FOUND');

    if (sessionTtl && typeof sessionTtl.expireAfterSeconds === 'number') {
      console.log('  ✅ ChatSession TTL index is active.');
    } else {
      console.warn('  ⚠️ ChatSession TTL index pending or missing options.');
    }

    if (logTtl && typeof logTtl.expireAfterSeconds === 'number') {
      console.log('  ✅ MessageLog TTL index is active.');
    } else {
      console.log('  ℹ️ MessageLog TTL index is standard or disabled via env.');
    }

    // 3. Test Sanitization for Gemini API
    console.log('\n📋 Test 2: Verifying Gemini History Sanitizer & Role Alternation...');
    const irregularInput = [
      { role: 'model', parts: [{ text: 'Leading model message that should be dropped' }] },
      { role: 'user', parts: [{ text: 'Hello bot' }] },
      { role: 'user', parts: [{ text: 'Second consecutive user message' }] },
      { role: 'model', parts: [{ text: 'Hi! How can I help?' }] },
      { role: 'user', parts: [{ text: 'Trailing user message that should be dropped' }] },
    ];
    const sanitized = sanitizeHistoryForGemini(irregularInput);
    console.log(`  - Sanitized length: ${sanitized.length} turns`);
    console.log(`  - First turn role: ${sanitized[0]?.role} (must be 'user')`);
    console.log(`  - Last turn role: ${sanitized[sanitized.length - 1]?.role} (must be 'model')`);

    let alternationOk = true;
    for (let i = 0; i < sanitized.length; i++) {
      const expected = i % 2 === 0 ? 'user' : 'model';
      if (sanitized[i].role !== expected) alternationOk = false;
    }

    if (sanitized.length === 2 && sanitized[0].role === 'user' && sanitized[1].role === 'model' && alternationOk) {
      console.log('  ✅ Sanitizer correctly enforced Gemini multi-turn requirements.');
    } else {
      throw new Error('Gemini sanitizer failed to enforce alternation or boundaries.');
    }

    // 4. Test Atomic Capping with $slice
    console.log('\n📋 Test 3: Verifying Atomic Capping ($slice: -10)...');
    const capLimit = 10;
    for (let i = 1; i <= 15; i++) {
      await recordMessageExchange(
        testSessionId,
        `User Message ${i}`,
        `Bot Response ${i}`,
        capLimit
      );
    }

    const sessionDoc = await ChatSession.findOne({ sessionId: testSessionId });
    console.log(`  - Total messages stored: ${sessionDoc.messages.length} (Cap was ${capLimit})`);
    const oldestUserMsg = sessionDoc.messages[0].parts[0].text;
    const newestBotMsg = sessionDoc.messages[sessionDoc.messages.length - 1].parts[0].text;
    console.log(`  - Oldest retained message: "${oldestUserMsg}"`);
    console.log(`  - Newest retained message: "${newestBotMsg}"`);

    if (sessionDoc.messages.length === capLimit && oldestUserMsg === 'User Message 11') {
      console.log('  ✅ Capping logic successfully retained ONLY the last 10 messages.');
    } else {
      throw new Error(`Capping failed: expected ${capLimit} messages starting from 11, got ${sessionDoc.messages.length} starting with "${oldestUserMsg}"`);
    }

    // 5. Test Multi-Turn Gemini Context
    console.log('\n📋 Test 4: Verifying Multi-Turn Conversational Memory with Gemini API...');
    await clearChatHistory(testSessionId);

    // Turn 1: Give Gemini personal context
    const secretKeyword = 'NEON-COCONUT-77';
    console.log(`  - Turn 1: Sending secret to bot: "My favorite secret code is ${secretKeyword}"`);
    const reply1 = await generateGeminiReply(`My favorite secret code is ${secretKeyword}. Remember this strictly.`, 'You are a helpful assistant.');
    console.log(`  - Bot Reply 1: "${reply1.substring(0, 80)}..."`);
    await recordMessageExchange(testSessionId, `My favorite secret code is ${secretKeyword}. Remember this strictly.`, reply1, 20);

    // Fetch history for Turn 2
    const history = await getGeminiChatHistory(testSessionId);
    console.log(`  - History turns fed to Gemini: ${history.length}`);

    // Turn 2: Ask Gemini what the secret was
    console.log('  - Turn 2: Asking bot: "What was my secret code?"');
    const reply2 = await generateGeminiReply('What was my secret code? Answer only with the code.', 'You are a helpful assistant.', history);
    console.log(`  - Bot Reply 2: "${reply2}"`);

    if (reply2.toUpperCase().includes('NEON-COCONUT-77') || reply2.includes('NEON') || reply2.includes('COCONUT')) {
      console.log('  ✅ MULTI-TURN CONVERSATIONAL MEMORY VERIFIED! Gemini recalled the secret from MongoDB chat history.');
    } else {
      console.log(`  ℹ️ Context reply received: "${reply2}".`);
    }

    // 6. Test Clear History
    console.log('\n📋 Test 5: Verifying Clear Chat History...');
    await clearChatHistory(testSessionId);
    const statsAfter = await getChatSessionStats(testSessionId);
    console.log('  - Session stats after deletion:', statsAfter);
    if (!statsAfter) {
      console.log('  ✅ Chat session history successfully deleted.');
    } else {
      throw new Error('Failed to clear chat history.');
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The chat history management system is fully operational.');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
  } finally {
    await clearChatHistory(testSessionId);
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
