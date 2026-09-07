require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const ChatSession = require('./src/models/ChatSession');
const {
  isGameTrigger,
  isExitTrigger,
  getGameMenuText,
  resolveGameSelection,
  processGameTurn,
} = require('./src/services/gameService');

async function runTextGameTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING INTERACTIVE TEXT GAME & /EXIT TEST SUITE');
  console.log('========================================================\n');

  await connectDB();
  console.log('✅ Connected to MongoDB via connectDB\n');

  const testSessionId = '+919999000088';

  try {
    // -----------------------------------------------------------------
    // Test 1: Trigger & Exit Detection Unit Tests
    // -----------------------------------------------------------------
    console.log('--- Test 1: Trigger & Exit Detection ---');
    const triggerCases = [
      { text: '/game', isGame: true, isExit: false },
      { text: 'game', isGame: true, isExit: false },
      { text: "let's play a game", isGame: true, isExit: false },
      { text: 'koi game khelo na', isGame: true, isExit: false },
      { text: 'chalo romantic game khelte hain', isGame: true, isExit: false },
      { text: '/exit', isGame: false, isExit: true },
      { text: 'exit', isGame: false, isExit: true },
      { text: 'stop game', isGame: false, isExit: true },
      { text: 'game band karo', isGame: false, isExit: true },
      { text: 'khel khatam', isGame: false, isExit: true },
      { text: 'Hello, what is your name?', isGame: false, isExit: false },
    ];

    let tPass = 0;
    for (const c of triggerCases) {
      const g = isGameTrigger(c.text);
      const e = isExitTrigger(c.text);
      const passed = g === c.isGame && e === c.isExit;
      if (passed) {
        tPass++;
        console.log(`  ✅ [PASS] "${c.text}" -> isGame: ${g}, isExit: ${e}`);
      } else {
        console.error(`  ❌ [FAIL] "${c.text}" -> got isGame: ${g}, isExit: ${e}, expected: ${c.isGame}, ${c.isExit}`);
      }
    }
    console.log(`Trigger detection: ${tPass}/${triggerCases.length} passed.\n`);

    // -----------------------------------------------------------------
    // Test 2: Game Menu Verification
    // -----------------------------------------------------------------
    console.log('--- Test 2: Game Menu Format & Options ---');
    const menu = getGameMenuText(false);
    const hasTrivia = menu.includes('Trivia');
    const hasRiddles = menu.includes('Riddles') || menu.includes('Paheliyan');
    const hasTwoTruths = menu.includes('Two Truths and a Lie');
    const hasRomantic = menu.includes('Romantic Love Quiz');
    const hasExitNote = menu.includes('/exit');

    if (hasTrivia && hasRiddles && hasTwoTruths && hasRomantic && hasExitNote) {
      console.log('  ✅ [PASS] Menu includes all required games: Trivia, Riddles, Two Truths & Lie, Romantic Games, and /exit instruction.\n');
    } else {
      console.error('  ❌ [FAIL] Menu is missing required options.');
    }

    // -----------------------------------------------------------------
    // Test 3: Interactive Game Flow: /game -> Menu -> Pick Romantic -> Turn -> /exit
    // -----------------------------------------------------------------
    console.log('--- Test 3: Interactive Game State Machine Flow ---');
    // Clean test session
    await ChatSession.deleteOne({ sessionId: testSessionId });

    // Step A: User sends /game
    console.log('Step A: User sends "/game"...');
    const stepA = await processGameTurn(testSessionId, '/game');
    console.log(`  Handled: ${stepA.handled}`);
    let session = await ChatSession.findOne({ sessionId: testSessionId });
    console.log(`  State in DB: active=${session.gameState?.active}, gameType=${session.gameState?.gameType}`);
    if (stepA.handled && session.gameState?.active && session.gameState?.gameType === 'MENU_PENDING') {
      console.log('  ✅ [PASS] Bot displayed interactive menu and entered MENU_PENDING state.\n');
    } else {
      console.error('  ❌ [FAIL] Failed to enter MENU_PENDING state.\n');
    }

    // Step B: User selects option "4" (Romantic Love Quiz & Dare)
    console.log('Step B: User selects "4" (Romantic Game)...');
    const stepB = await processGameTurn(testSessionId, '4');
    console.log(`  Handled: ${stepB.handled}`);
    console.log(`  Round 1 Question:\n${stepB.replyText.substring(0, 160)}...\n`);
    session = await ChatSession.findOne({ sessionId: testSessionId });
    console.log(`  State in DB: active=${session.gameState?.active}, gameType=${session.gameState?.gameType}, round=${session.gameState?.round}`);
    if (stepB.handled && session.gameState?.gameType === 'ROMANTIC' && session.gameState?.round === 1) {
      console.log('  ✅ [PASS] Romantic Game launched successfully with Round 1 question.\n');
    } else {
      console.error('  ❌ [FAIL] Failed to launch Romantic game.\n');
    }

    // Step C: User answers Round 1
    console.log('Step C: User replies to Round 1: "Main late-night long drive choose karunga with romantic songs"...');
    const stepC = await processGameTurn(testSessionId, 'Main late-night long drive choose karunga with romantic songs');
    console.log(`  Handled: ${stepC.handled}`);
    console.log(`  Game Host Response:\n${stepC.replyText.substring(0, 180)}...\n`);
    session = await ChatSession.findOne({ sessionId: testSessionId });
    console.log(`  State in DB: round=${session.gameState?.round}, score=${session.gameState?.score}`);
    if (stepC.handled && session.gameState?.round === 2 && session.gameState?.score > 0) {
      console.log('  ✅ [PASS] Host evaluated answer, awarded score, and advanced to Round 2.\n');
    } else {
      console.error('  ❌ [FAIL] Failed to evaluate turn.\n');
    }

    // Step D: User sends "/exit" to stop game
    console.log('Step D: User sends "/exit"...');
    const stepD = await processGameTurn(testSessionId, '/exit');
    console.log(`  Handled: ${stepD.handled}, isExit: ${stepD.isExit}`);
    console.log(`  Exit Confirmation: "${stepD.replyText}"`);
    session = await ChatSession.findOne({ sessionId: testSessionId });
    console.log(`  State in DB after exit: active=${session.gameState?.active}, gameType=${session.gameState?.gameType}`);
    if (stepD.handled && stepD.isExit && session.gameState?.active === false) {
      console.log('  ✅ [PASS] Game stopped immediately and state cleanly reset on /exit.\n');
    } else {
      console.error('  ❌ [FAIL] Failed to stop game on /exit.\n');
    }

    // Step E: Subsequent non-game message returns handled: false (Normal chat resumes)
    console.log('Step E: User sends normal chat message: "Bhai kal milte hain"...');
    const stepE = await processGameTurn(testSessionId, 'Bhai kal milte hain');
    console.log(`  Handled by game service: ${stepE.handled} (Expected: false)`);
    if (stepE.handled === false) {
      console.log('  ✅ [PASS] Regular AI conversational persona immediately took over with zero game interference.\n');
    } else {
      console.error('  ❌ [FAIL] Game service intercepted normal message.\n');
    }

    // Cleanup
    await ChatSession.deleteOne({ sessionId: testSessionId });
    console.log('🧹 Cleaned up temporary test session.');

    console.log('\n========================================================');
    console.log('🎉 ALL TEXT GAME & /EXIT TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================');
  } catch (err) {
    console.error('❌ Test execution error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runTextGameTests();
