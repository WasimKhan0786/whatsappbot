const ChatSession = require('../models/ChatSession');
const { generateGeminiReply } = require('./geminiService');

const GAME_TYPES = {
  TRIVIA: {
    key: 'TRIVIA',
    number: '1',
    title: 'Trivia Challenge (Bollywood, Cricket & GK Quiz)',
    description: 'Bollywood, Cricket, Music aur General Knowledge ka majedaar quiz!',
    promptRole: 'You are an energetic, fun, and witty quiz show host. Ask engaging trivia questions with multiple choices (A, B, C, D) or open questions about Bollywood, Indian cricket, pop culture, or interesting facts. Celebrate right answers with enthusiasm, playfully tease wrong ones, and award points.',
  },
  RIDDLES: {
    key: 'RIDDLES',
    number: '2',
    title: 'Riddles / Majedaar Paheliyan',
    description: 'Chhatpate dimagi sawal aur majedaar paheliyan!',
    promptRole: 'You are a clever and playful paheli master. Give clever, funny, and intriguing riddles in natural conversational Hinglish. Give subtle witty hints if the user struggles, and reveal answers with a cheerful exclamation when solved.',
  },
  TWO_TRUTHS: {
    key: 'TWO_TRUTHS',
    number: '3',
    title: 'Two Truths and a Lie (Do Sach, Ek Jhooth)',
    description: '3 baatein—2 sach aur 1 jhooth. Jhooth pehchan kar dikhao!',
    promptRole: 'You are hosting a game of Two Truths and a Lie. Present 3 surprising, fascinating, or hilarious statements about a theme (celebrities, weird world facts, Indian history, animals, or food). Ask the user to identify which one is the LIE. Once they guess, explain the fun story behind the lie and truths!',
  },
  ROMANTIC: {
    key: 'ROMANTIC',
    label: 'Romantic Love Quiz & Dare ❤️',
    number: '4',
    title: 'Romantic Love Quiz & Dare ❤️',
    description: 'Couples and crush special: cute compatibility questions, romantic scenarios & playful dares!',
    promptRole: 'You are hosting a deeply romantic, sweet, playful, and fun couples quiz game. Present sweet romantic questions, relationship "would you rather" scenarios, compatibility dilemmas, or cute lighthearted dares. Keep the tone warm, affectionate, flirtatious, cheerful, and emotionally engaging.',
  },
  EMOJI_MOVIE: {
    key: 'EMOJI_MOVIE',
    number: '5',
    title: 'Guess the Movie from Emojis 🎬',
    description: 'Emojis dekh kar blockbuster film ka naam guess karo!',
    promptRole: 'You are hosting Guess The Movie From Emojis. Give 3-4 creative emojis that hint at a famous Bollywood or Hollywood blockbuster movie. Encourage the user to guess, give hints if needed, and cheer loudly when they get it right!',
  },
};

/**
 * Checks if incoming text is an explicit or natural trigger to launch games
 * @param {string} text
 * @returns {boolean}
 */
function isGameTrigger(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();
  
  // Exact command or trigger
  if (clean === '/game' || clean === '!game' || clean === 'game') return true;

  // Natural language game requests
  const gamePatterns = /\b(let'?s\s*play\s*(a\s*)?game|khelte\s*hain|game\s*khelo|game\s*khele|koi\s*game\s*khelo|koi\s*game\s*ho\s*jaye|text\s*game|play\s*game|trivia\s*khelo|paheli\s*khelo|romantic\s*game)\b/i;
  return gamePatterns.test(clean);
}

/**
 * Checks if incoming text is a command to exit the game
 * @param {string} text
 * @returns {boolean}
 */
function isExitTrigger(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();

  return (
    clean === '/exit' ||
    clean === '!exit' ||
    clean === 'exit' ||
    clean === '/quit' ||
    clean === 'quit' ||
    clean === '/stop' ||
    clean === 'stop game' ||
    clean === 'game band karo' ||
    clean === 'band karo game' ||
    clean === 'end game' ||
    clean === 'stop' ||
    clean === 'khel khatam'
  );
}

/**
 * Formats the interactive numbered game menu
 * @param {boolean} isEnglish
 * @returns {string}
 */
function getGameMenuText(isEnglish = false) {
  if (isEnglish) {
    return (
      `🎮 *WhatsApp Interactive Game Zone!* 🎮\n\n` +
      `Ready for some fun? Reply with a number to pick your game:\n\n` +
      `1️⃣ *Trivia Challenge* (Bollywood, Cricket & GK Quiz)\n` +
      `2️⃣ *Riddles / Brain Teasers* (Fun Paheliyan)\n` +
      `3️⃣ *Two Truths and a Lie* (Spot the fake one)\n` +
      `4️⃣ *Romantic Love Quiz & Dare* (Cute questions & fun dares) ❤️\n` +
      `5️⃣ *Guess the Movie from Emojis* (Emoji puzzle challenge) 🎬\n\n` +
      `💡 _To quit at any time and return to normal chat, type_ */exit*.`
    );
  }

  return (
    `🎮 *WhatsApp Interactive Game Zone!* 🎮\n\n` +
    `Maza aane wala hai! Khelne ke liye kisi ek game ka number reply karein:\n\n` +
    `1️⃣ *Trivia Challenge* (Bollywood, Cricket & GK Quiz)\n` +
    `2️⃣ *Riddles / Majedaar Paheliyan* (Dimag ki kasrat)\n` +
    `3️⃣ *Two Truths and a Lie* (Do Sach, Ek Jhooth pehchano)\n` +
    `4️⃣ *Romantic Love Quiz & Dare* (Couples special fun Q&A) ❤️\n` +
    `5️⃣ *Guess the Movie from Emojis* (Emoji se film pehchano) 🎬\n\n` +
    `💡 _Game band karne ke liye kabhi bhi_ */exit* _type karein._`
  );
}

/**
 * Resolves user game choice from input
 * @param {string} text
 * @returns {string|null} - Game key ('TRIVIA', 'RIDDLES', 'TWO_TRUTHS', 'ROMANTIC', 'EMOJI_MOVIE') or null
 */
function resolveGameSelection(text) {
  if (!text) return null;
  const clean = text.trim().toLowerCase();

  if (/^(1|one|trivia|quiz|gk|bollywood|cricket)/i.test(clean)) return 'TRIVIA';
  if (/^(2|two|riddle|riddles|paheli|paheliyan)/i.test(clean)) return 'RIDDLES';
  if (/^(3|three|two truths|lie|jhooth|sach)/i.test(clean)) return 'TWO_TRUTHS';
  if (/^(4|four|romantic|love|couple|dare|crush|pyaar)/i.test(clean)) return 'ROMANTIC';
  if (/^(5|five|movie|emoji|film|guess)/i.test(clean)) return 'EMOJI_MOVIE';

  return null;
}

/**
 * Handles incoming game state machine for a session
 * @param {string} sessionId - Phone number or session ID
 * @param {string} messageText - Inbound user text
 * @returns {Promise<{ handled: boolean, replyText?: string, isExit?: boolean }>}
 */
async function processGameTurn(sessionId, messageText) {
  if (!sessionId || !messageText) return { handled: false };

  const cleanSessionId = String(sessionId).trim();
  const text = messageText.trim();
  const lower = text.toLowerCase();

  let session = await ChatSession.findOne({ sessionId: cleanSessionId });
  if (!session) {
    session = await ChatSession.create({
      sessionId: cleanSessionId,
      gameState: { active: false, gameType: null, round: 0, score: 0 },
    });
  }

  const isEnglishQuery = /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text) && !/\b(kya|bhai|bolo|karo|nahi|sunao|khelo)\b/i.test(lower);

  // 1. Check for /exit command
  if (isExitTrigger(text)) {
    const wasActive = Boolean(session.gameState?.active);
    const score = session.gameState?.score || 0;

    session.gameState = {
      active: false,
      gameType: null,
      round: 0,
      score: 0,
      currentQuestion: '',
      startedAt: null,
    };
    session.updatedAt = new Date();
    await session.save();

    const exitMessage = isEnglishQuery
      ? `Game mode exited! 🏁${wasActive && score > 0 ? ` Final Score: ${score} points! 🎉` : ''}\nWe're back to our regular conversation. What would you like to talk about?`
      : `Game mode band kar diya gaya hai! 🏁${wasActive && score > 0 ? ` Aapka final score: ${score} points! 🎉` : ''}\nAb hum wapas normal chat par hain. Boliye, kya baat chal rahi thi?`;

    return {
      handled: true,
      replyText: exitMessage,
      isExit: true,
    };
  }

  // 2. Check for explicit /game command or new game request
  const wantsNewGame = isGameTrigger(text);

  if (wantsNewGame) {
    // If user specifically asked for a particular game in the sentence (e.g. "let's play romantic game" or "trivia khelo")
    const immediateGame = resolveGameSelection(text.replace(/\/game/i, '').trim());

    if (immediateGame && GAME_TYPES[immediateGame]) {
      // Launch chosen game directly!
      const gameConfig = GAME_TYPES[immediateGame];
      session.gameState = {
        active: true,
        gameType: immediateGame,
        round: 1,
        score: 0,
        currentQuestion: '',
        startedAt: new Date(),
      };
      await session.save();

      const launchPrompt = `
You are an enthusiastic, funny, and casual game host on WhatsApp.
The user just selected to play: "${gameConfig.title}".
Game Description: ${gameConfig.description}
Role: ${gameConfig.promptRole}

Instructions:
1. Greet enthusiastically in 1 line (e.g. "Wah! Shuru karte hain [Game Name]! 🎉").
2. Present Round 1 question or scenario.
3. Keep the tone fun, engaging, casual, and energetic.
4. End with a subtle prompt: "(Apna answer bhejo! Exit karne ke liye /exit type karein)".
`;

      const firstQuestion = await generateGeminiReply(
        `Start Round 1 of ${gameConfig.title}`,
        launchPrompt
      );

      session.gameState.currentQuestion = firstQuestion;
      session.updatedAt = new Date();
      await session.save();

      return {
        handled: true,
        replyText: firstQuestion,
      };
    }

    // Otherwise show the interactive numbered menu
    session.gameState = {
      active: true,
      gameType: 'MENU_PENDING',
      round: 0,
      score: 0,
      currentQuestion: '',
      startedAt: new Date(),
    };
    session.updatedAt = new Date();
    await session.save();

    return {
      handled: true,
      replyText: getGameMenuText(isEnglishQuery),
    };
  }

  // 3. If session has an active game
  if (session.gameState?.active) {
    // Case A: User is picking from the menu (MENU_PENDING)
    if (session.gameState.gameType === 'MENU_PENDING') {
      const selectedGameKey = resolveGameSelection(text);

      if (!selectedGameKey || !GAME_TYPES[selectedGameKey]) {
        // User replied with invalid option
        const retryMsg = isEnglishQuery
          ? `Please select a valid game option by replying with 1, 2, 3, 4, or 5.\n(Or type /exit to cancel)`
          : `Kripya 1 se 5 tak ka number chunein:\n\n1️⃣ Trivia\n2️⃣ Riddles\n3️⃣ Two Truths & Lie\n4️⃣ Romantic Quiz ❤️\n5️⃣ Movie Emojis 🎬\n\n(Ya bahar nikalne ke liye /exit type karein)`;
        return {
          handled: true,
          replyText: retryMsg,
        };
      }

      const gameConfig = GAME_TYPES[selectedGameKey];
      session.gameState.gameType = selectedGameKey;
      session.gameState.round = 1;
      session.gameState.score = 0;

      const launchPrompt = `
You are an enthusiastic, casual, and fun game host chatting with the user on WhatsApp.
The user just selected: "${gameConfig.title}".
Game Description: ${gameConfig.description}
Role: ${gameConfig.promptRole}

Instructions:
1. Acknowledge their choice with a cheerful, enthusiastic 1-line opening (e.g. "Zabardast! Shuru karte hain [Game Name]! 🚀").
2. Present Round 1 question or scenario.
3. Keep it fun, interactive, casual, and engaging.
4. Add at the end: "(Apna answer likho! Game chhodne ke liye /exit type karein)".
`;

      const firstQuestion = await generateGeminiReply(
        `Start Round 1 of ${gameConfig.title}`,
        launchPrompt
      );

      session.gameState.currentQuestion = firstQuestion;
      session.updatedAt = new Date();
      await session.save();

      return {
        handled: true,
        replyText: firstQuestion,
      };
    }

    // Case B: Active game turn (TRIVIA, RIDDLES, TWO_TRUTHS, ROMANTIC, EMOJI_MOVIE)
    const activeGameKey = session.gameState.gameType;
    const gameConfig = GAME_TYPES[activeGameKey] || GAME_TYPES.TRIVIA;
    const currentRound = session.gameState.round || 1;
    const currentScore = session.gameState.score || 0;
    const lastQuestion = session.gameState.currentQuestion || '';

    const gameplayPrompt = `
You are the host of the WhatsApp text game: "${gameConfig.title}".
Role & Tone: ${gameConfig.promptRole}
Current Round: ${currentRound}
Current User Score: ${currentScore} points.
Previous Question Asked: "${lastQuestion}"
User's Answer / Response: "${text}"

Instructions:
1. React to the user's answer with high energy and casual fun!
   - If correct / great answer: Praise them excitedly, give them +10 points!
   - If incorrect / funny guess: Playfully tease them, reveal the correct answer or give a helpful hint.
   - If romantic game: React warmly and playfully to their romance choice, complimenting their vibe!
2. Announce the updated score and immediately present Round ${currentRound + 1}.
3. Keep formatting clean, breezy, and casual (short paragraphs with fun emojis).
4. Always include at the very end on a new line: "(Type /exit to quit game)".
`;

    const gameHostReply = await generateGeminiReply(
      `Evaluate answer and give next round for ${gameConfig.title}`,
      gameplayPrompt
    );

    // Update round and award points
    session.gameState.round = currentRound + 1;
    session.gameState.score = currentScore + 10;
    session.gameState.currentQuestion = gameHostReply;
    session.updatedAt = new Date();
    await session.save();

    return {
      handled: true,
      replyText: gameHostReply,
    };
  }

  // Not in a game and not triggering a game
  return { handled: false };
}

module.exports = {
  GAME_TYPES,
  isGameTrigger,
  isExitTrigger,
  getGameMenuText,
  resolveGameSelection,
  processGameTurn,
};
