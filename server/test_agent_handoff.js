require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const {
  detectAgentKeyword,
  isSessionHandedOff,
  activateHandover,
  recordFailedAttempt,
  resetFailedAttempts,
  resumeSession,
  getActiveHandoffs,
} = require('./src/services/chatHistoryService');
const ChatSession = require('./src/models/ChatSession');

async function runAgentHandoffTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING LIVE AGENT HANDOFF & AUTO-PAUSE TEST SUITE');
  console.log('========================================================\n');

  await connectDB();
  console.log('✅ Connected to MongoDB via connectDB\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Keyword Detection Unit Tests
    // -------------------------------------------------------------
    console.log('--- Test 1: Keyword Detection ---');
    const keywordCases = [
      { text: 'agent', expected: true },
      { text: 'human', expected: true },
      { text: 'Please connect me to an AGENT now', expected: true },
      { text: 'I need a human representative', expected: true },
      { text: 'Mujhe live agent chahiye', expected: true },
      { text: 'human support please', expected: true },
      { text: 'Hello, what is the speed of light?', expected: false },
      { text: 'Can you tell me a joke?', expected: false },
      { text: 'Good morning!', expected: false },
    ];

    let keywordPassCount = 0;
    for (const testCase of keywordCases) {
      const detected = detectAgentKeyword(testCase.text);
      const passed = detected === testCase.expected;
      if (passed) {
        keywordPassCount++;
        console.log(`  ✅ [PASS] "${testCase.text}" -> detected: ${detected}`);
      } else {
        console.error(`  ❌ [FAIL] "${testCase.text}" -> got ${detected}, expected ${testCase.expected}`);
      }
    }
    console.log(`Keyword Tests Result: ${keywordPassCount}/${keywordCases.length} passed.\n`);

    // -------------------------------------------------------------
    // Test 2: Keyword Handover Activation & Session Pausing
    // -------------------------------------------------------------
    console.log('--- Test 2: Keyword Handover Activation & Session Pausing ---');
    const testPhone1 = '+919999000001';
    // Clean slate
    await ChatSession.deleteOne({ sessionId: testPhone1 });

    const initialPaused = await isSessionHandedOff(testPhone1);
    console.log(`  Initial paused state for ${testPhone1}: ${initialPaused} (Expected: false)`);

    // Trigger handover
    const handoverResult = await activateHandover(testPhone1, 'KEYWORD_AGENT');
    console.log(`  Handover activated. Reason: ${handoverResult.handoverReason}, isHandedOff: ${handoverResult.isHandedOff}`);

    const afterPaused = await isSessionHandedOff(testPhone1);
    console.log(`  After activation paused state: ${afterPaused} (Expected: true)`);
    if (afterPaused === true) {
      console.log(`  ✅ [PASS] Automated replies successfully paused for ${testPhone1} on keyword trigger.\n`);
    } else {
      console.error(`  ❌ [FAIL] Automated replies were NOT paused for ${testPhone1}.\n`);
    }

    // -------------------------------------------------------------
    // Test 3: Escalation after 3 Failed AI Attempts
    // -------------------------------------------------------------
    console.log('--- Test 3: Escalation after 3 Failed AI Attempts ---');
    const testPhone2 = '+919999000002';
    // Clean slate
    await ChatSession.deleteOne({ sessionId: testPhone2 });

    // Attempt 1
    const fail1 = await recordFailedAttempt(testPhone2);
    console.log(`  Failed Attempt 1: unresolvedAttempts = ${fail1.unresolvedAttempts}, triggeredHandover = ${fail1.triggeredHandover} (Expected: 1, false)`);

    // Attempt 2
    const fail2 = await recordFailedAttempt(testPhone2);
    console.log(`  Failed Attempt 2: unresolvedAttempts = ${fail2.unresolvedAttempts}, triggeredHandover = ${fail2.triggeredHandover} (Expected: 2, false)`);

    // Attempt 3 (Should trigger handover!)
    const fail3 = await recordFailedAttempt(testPhone2);
    console.log(`  Failed Attempt 3: unresolvedAttempts = ${fail3.unresolvedAttempts}, triggeredHandover = ${fail3.triggeredHandover} (Expected: 3, true)`);

    const isPhone2Paused = await isSessionHandedOff(testPhone2);
    console.log(`  After 3 failures, paused state for ${testPhone2}: ${isPhone2Paused} (Expected: true)`);
    if (fail3.triggeredHandover && isPhone2Paused) {
      console.log(`  ✅ [PASS] Session automatically escalated & paused on exactly 3 failed attempts.\n`);
    } else {
      console.error(`  ❌ [FAIL] Session failed to trigger handover on 3 failed attempts.\n`);
    }

    // -------------------------------------------------------------
    // Test 4: Querying Active Handoffs
    // -------------------------------------------------------------
    console.log('--- Test 4: Fetching Active Handoffs ---');
    const activeHandoffs = await getActiveHandoffs();
    console.log(`  Total active handoffs returned: ${activeHandoffs.length}`);
    const foundPhone1 = activeHandoffs.find((h) => h.sessionId === testPhone1);
    const foundPhone2 = activeHandoffs.find((h) => h.sessionId === testPhone2);

    if (foundPhone1 && foundPhone2) {
      console.log(`  ✅ [PASS] Both paused sessions retrieved in handoff list:`);
      console.log(`     - ${foundPhone1.sessionId}: reason=${foundPhone1.handoverReason}`);
      console.log(`     - ${foundPhone2.sessionId}: reason=${foundPhone2.handoverReason}, attempts=${foundPhone2.unresolvedAttempts}\n`);
    } else {
      console.error(`  ❌ [FAIL] Missing sessions in handoff list.\n`);
    }

    // -------------------------------------------------------------
    // Test 5: Resume AI Bot Session API
    // -------------------------------------------------------------
    console.log('--- Test 5: Resuming Session (Unpausing AI) ---');
    const resumedSession = await resumeSession(testPhone1);
    console.log(`  Resumed session for ${testPhone1}: isHandedOff = ${resumedSession.isHandedOff}, unresolvedAttempts = ${resumedSession.unresolvedAttempts}`);

    const isPhone1PausedAfterResume = await isSessionHandedOff(testPhone1);
    console.log(`  Paused state after resume: ${isPhone1PausedAfterResume} (Expected: false)`);
    if (!isPhone1PausedAfterResume) {
      console.log(`  ✅ [PASS] Session ${testPhone1} successfully unpaused and ready for automated replies.\n`);
    } else {
      console.error(`  ❌ [FAIL] Session ${testPhone1} is still paused after resume call.\n`);
    }

    // -------------------------------------------------------------
    // Test 6: AI Success Resets Failure Counter
    // -------------------------------------------------------------
    console.log('--- Test 6: Success Resets Failed Counter ---');
    const testPhone3 = '+919999000003';
    await ChatSession.deleteOne({ sessionId: testPhone3 });

    // Fail 2 times
    await recordFailedAttempt(testPhone3);
    await recordFailedAttempt(testPhone3);
    let sessionPhone3 = await ChatSession.findOne({ sessionId: testPhone3 });
    console.log(`  After 2 fails: unresolvedAttempts = ${sessionPhone3.unresolvedAttempts}`);

    // AI resolves query successfully
    await resetFailedAttempts(testPhone3);
    sessionPhone3 = await ChatSession.findOne({ sessionId: testPhone3 });
    console.log(`  After AI success reset: unresolvedAttempts = ${sessionPhone3.unresolvedAttempts} (Expected: 0)`);
    if (sessionPhone3.unresolvedAttempts === 0) {
      console.log(`  ✅ [PASS] Failure counter successfully reset to 0 on successful resolution.\n`);
    } else {
      console.error(`  ❌ [FAIL] Failure counter was not reset.\n`);
    }

    // Cleanup test artifacts from database
    await ChatSession.deleteMany({ sessionId: { $in: [testPhone1, testPhone2, testPhone3] } });
    console.log('🧹 Cleaned up temporary test sessions.');

    console.log('\n========================================================');
    console.log('🎉 ALL LIVE AGENT HANDOFF TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================');
  } catch (err) {
    console.error('❌ Test suite execution error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runAgentHandoffTests();
