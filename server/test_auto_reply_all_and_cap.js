require('dotenv').config();
const mongoose = require('mongoose');
const BotSettings = require('./src/models/BotSettings');
const ChatSession = require('./src/models/ChatSession');
const { getSessionMessageCount, incrementSessionMessageCount } = require('./src/services/chatHistoryService');

async function runTests() {
  console.log('🧪 Starting Global Auto-Reply All & Message Cap Test Suite...\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_bot';
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to MongoDB successfully.');

  // ==========================================
  // Test 1: BotSettings Auto-Reply All Field
  // ==========================================
  console.log('\n📋 Test 1: Verifying BotSettings autoReplyAll Configuration...');
  const settings = await BotSettings.getSettings();
  console.log('  - Initial autoReplyAll status:', settings.autoReplyAll);

  // Toggle to true
  settings.autoReplyAll = true;
  await settings.save();
  const verifyTrue = await BotSettings.getSettings();
  if (verifyTrue.autoReplyAll === true) {
    console.log('  ✅ Successfully set autoReplyAll: true in database.');
  } else {
    throw new Error('Failed to set autoReplyAll to true');
  }

  // Toggle back to false
  settings.autoReplyAll = false;
  await settings.save();
  const verifyFalse = await BotSettings.getSettings();
  if (verifyFalse.autoReplyAll === false) {
    console.log('  ✅ Successfully set autoReplyAll: false in database.');
  } else {
    throw new Error('Failed to set autoReplyAll to false');
  }

  // ==========================================
  // Test 2: Message Cap (0, 3, 4, 5, 10) & Farewell Trigger
  // ==========================================
  console.log('\n📋 Test 2: Verifying Message Cap Counting & Last Count Farewell Trigger...');
  const testPhone = `+91987654${Math.floor(1000 + Math.random() * 9000)}`;
  const limit = 3; // Test with 3 messages

  // Clear any existing session for this test number
  await ChatSession.deleteOne({ sessionId: testPhone });

  // Initial count check
  const initial = await getSessionMessageCount(testPhone);
  console.log(`  - Initial count for ${testPhone}:`, initial.messagesSentCount);
  if (initial.messagesSentCount === 0 && !initial.isCapReached) {
    console.log('  ✅ New contact starts with 0 messages sent.');
  } else {
    throw new Error('Initial count was not 0');
  }

  // Turn 1
  const turn1 = await incrementSessionMessageCount(testPhone, limit);
  console.log(`  - Turn 1: Count = ${turn1.currentCount}, reachedCapNow = ${turn1.reachedCapNow}`);
  if (turn1.currentCount === 1 && !turn1.reachedCapNow) {
    console.log('  ✅ Turn 1 processed normally.');
  } else {
    throw new Error('Turn 1 check failed');
  }

  // Turn 2
  const turn2 = await incrementSessionMessageCount(testPhone, limit);
  console.log(`  - Turn 2: Count = ${turn2.currentCount}, reachedCapNow = ${turn2.reachedCapNow}`);
  if (turn2.currentCount === 2 && !turn2.reachedCapNow) {
    console.log('  ✅ Turn 2 processed normally.');
  } else {
    throw new Error('Turn 2 check failed');
  }

  // Turn 3 (Final Count)
  const turn3 = await incrementSessionMessageCount(testPhone, limit);
  console.log(`  - Turn 3: Count = ${turn3.currentCount}, reachedCapNow = ${turn3.reachedCapNow}`);
  if (turn3.currentCount === 3 && turn3.reachedCapNow) {
    console.log('  ✅ Turn 3 HIT CAP! reachedCapNow = true triggered for auto-closing farewell announcement.');
  } else {
    throw new Error('Turn 3 cap trigger failed');
  }

  // Verify subsequent check blocks further responses
  const postCap = await getSessionMessageCount(testPhone);
  console.log(`  - Post-cap status: Count = ${postCap.messagesSentCount}, isCapReached = ${postCap.isCapReached}`);
  if (postCap.messagesSentCount >= limit && postCap.isCapReached) {
    console.log('  ✅ Cap is locked! Future messages will correctly skip AI generation.');
  } else {
    throw new Error('Post-cap check failed');
  }

  // Clean up test session
  await ChatSession.deleteOne({ sessionId: testPhone });

  console.log('\n🎉 ALL AUTO-REPLY ALL & MESSAGE CAP TESTS PASSED SUCCESSFULLY!');
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
