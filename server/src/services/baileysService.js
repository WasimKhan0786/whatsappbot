const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { generateGeminiReply } = require('./geminiService');
const { checkActiveSchedule, startOutboundScheduler } = require('./scheduleService');
const { buildDynamicPersonaPrompt, resolveContactPersona } = require('./personaService');
const {
  getGeminiChatHistory,
  recordMessageExchange,
  detectAgentKeyword,
  isSessionHandedOff,
  activateHandover,
  recordFailedAttempt,
  resetFailedAttempts,
} = require('./chatHistoryService');
const { processGameTurn } = require('./gameService');
const { analyzeAndTagContact } = require('./crmService');
const BotSettings = require('../models/BotSettings');
const MessageLog = require('../models/MessageLog');
const WhitelistContact = require('../models/WhitelistContact');

// State variables
let sock = null;
let currentQrCode = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'qr_ready' | 'connecting' | 'connected'
let connectedPhoneNumber = null;
let isInitializing = false;

const authPath = path.resolve(__dirname, '../../auth_info_baileys');

async function resolveSenderPhoneNumber(senderJid, msg) {
  // 1. Check if remoteJidAlt / participantAlt / participant is provided on msg.key
  const altJid = msg?.key?.remoteJidAlt || msg?.key?.participantAlt || msg?.key?.participant;
  if (altJid && typeof altJid === 'string' && altJid.includes('@s.whatsapp.net')) {
    const digits = altJid.replace(/@.*$/, '').replace(/\D/g, '');
    if (digits.length >= 7) return '+' + digits;
  }

  // 2. If senderJid is standard phone JID (@s.whatsapp.net)
  if (senderJid && typeof senderJid === 'string' && senderJid.includes('@s.whatsapp.net')) {
    const digits = senderJid.replace(/@.*$/, '').replace(/\D/g, '');
    if (digits.length >= 7) return '+' + digits;
  }

  // 3. If senderJid is LID (@lid), query Baileys signalRepository LID mapping
  if (senderJid && typeof senderJid === 'string' && senderJid.includes('@lid')) {
    if (sock?.signalRepository?.lidMapping?.getPNForLID) {
      try {
        const resolvedPn = await sock.signalRepository.lidMapping.getPNForLID(senderJid);
        if (resolvedPn && typeof resolvedPn === 'string') {
          const digits = resolvedPn.replace(/@.*$/, '').replace(/\D/g, '');
          if (digits.length >= 7) return '+' + digits;
        }
      } catch (e) {
        // ignore
      }
    }

    // 4. Check disk auth cache for lid-mapping-<phone>.json
    try {
      const lidClean = senderJid.replace(/@.*$/, '').replace(/\D/g, '');
      if (fs.existsSync(authPath)) {
        const files = fs.readdirSync(authPath);
        for (const file of files) {
          if (file.startsWith('lid-mapping-') && file.endsWith('.json')) {
            const content = fs.readFileSync(path.join(authPath, file), 'utf8');
            if (content.includes(lidClean)) {
              const pn = file.replace('lid-mapping-', '').replace('.json', '');
              if (pn.length >= 7) {
                return '+' + pn;
              }
            }
          }
        }
      }
    } catch (fsErr) {
      // ignore
    }
  }

  // Fallback to raw digits
  const rawDigits = (senderJid || '').replace(/@.*$/, '').replace(/\D/g, '');
  return rawDigits ? '+' + rawDigits : senderJid;
}

function getMessageText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  );
}

/**
 * Simulates human typing behavior by updating presence on WhatsApp
 * @param {object} socketInstance - Baileys socket
 * @param {string} targetJid - JID to show typing to
 * @param {number} durationMs - Duration in milliseconds
 */
async function simulateTypingPresence(socketInstance, targetJid, durationMs = 2000) {
  if (!socketInstance || !targetJid) return;
  try {
    // 1. Send 'composing' presence to show "typing..." on recipient's WhatsApp
    await socketInstance.sendPresenceUpdate('composing', targetJid);

    // 2. Wait for the specified duration to mimic human typing rhythm
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    // 3. Mark presence as 'paused' right before sending the message
    await socketInstance.sendPresenceUpdate('paused', targetJid);
  } catch (err) {
    // Non-fatal: presence failures should not block message sending
    console.warn(`[Baileys] Presence warning for ${targetJid}:`, err.message);
  }
}

async function initBaileys(forceRestart = false) {
  if (isInitializing && !forceRestart) {
    return;
  }
  isInitializing = true;
  connectionStatus = 'connecting';

  try {
    // Ensure auth folder exists
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    // Clean up previous socket if existing
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end(undefined);
      } catch (err) {
        // ignore
      }
      sock = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[Baileys] Initializing WhatsApp Web (v${version.join('.')}, isLatest: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true, // Also print to terminal for convenience
      logger: pino({ level: 'silent' }), // Suppress internal verbose pino logs
      browser: ['WhatsApp AI Bot', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQrCode = await QRCode.toDataURL(qr);
          connectionStatus = 'qr_ready';
          console.log('\n[Baileys] 📱 New WhatsApp Web QR code generated! Scan in browser or terminal.');
        } catch (qrErr) {
          console.error('[Baileys] Failed to generate QR data URL:', qrErr);
        }
      }

      if (connection === 'connecting') {
        connectionStatus = 'connecting';
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        currentQrCode = null; // Clear QR once connected
        const rawId = sock.user?.id || '';
        connectedPhoneNumber = '+' + rawId.replace(/:\d+@.*$/, '').replace(/@.*$/, '');
        console.log(`\n======================================================`);
        console.log(`✅ [Baileys] WhatsApp Web Connected Successfully!`);
        console.log(`📱 Connected as: ${connectedPhoneNumber}`);
        console.log(`======================================================\n`);

        // Start proactive scheduled broadcast runner
        startOutboundScheduler(() => sock);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;

        console.log(`[Baileys] Connection closed (status: ${statusCode}).`);

        if (isLoggedOut) {
          console.log('[Baileys] Device logged out. Clearing auth credentials.');
          connectionStatus = 'disconnected';
          connectedPhoneNumber = null;
          currentQrCode = null;
          try {
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          } catch (cleanErr) {
            console.error('[Baileys] Error removing auth directory:', cleanErr.message);
          }
          setTimeout(() => initBaileys(true), 2000);
        } else if (isReplaced) {
          console.log('[Baileys] ⚠️ Connection replaced or duplicate socket detected. Cooling down before reconnecting...');
          connectionStatus = 'connecting';
          setTimeout(() => initBaileys(true), 6000);
        } else {
          // Standard network retry
          connectionStatus = 'connecting';
          setTimeout(() => initBaileys(true), 3000);
        }
      }
    });

    // Handle Incoming Messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Skip self-messages, status broadcasts, newsletters/channels, and group chats
        const senderJid = msg.key?.remoteJid;
        if (
          !msg.message ||
          msg.key?.fromMe ||
          !senderJid ||
          senderJid === 'status@broadcast' ||
          senderJid.endsWith('@broadcast') ||
          senderJid.endsWith('@newsletter') ||
          senderJid.endsWith('@g.us')
        ) {
          continue;
        }

        // Resolve real phone number (even if WhatsApp uses LID addressing like @lid)
        const senderPhone = await resolveSenderPhoneNumber(senderJid, msg);
        const messageText = getMessageText(msg.message);

        if (!messageText || messageText.trim() === '') {
          continue;
        }

        console.log(`\n[Baileys] 📩 Incoming message from ${senderPhone} (JID: ${senderJid}): "${messageText}"`);

        // Check global bot settings from database
        try {
          const settings = await BotSettings.getSettings();

          if (!settings.isEnabled) {
            console.log(`[Baileys] Bot is currently disabled in settings. Skipping reply.`);
            continue;
          }

          const cleanSender = senderPhone.replace(/\D/g, '');

          // Look up contact in WhitelistContact model
          let matchedContact = null;
          try {
            const allContacts = await WhitelistContact.find();
            matchedContact = allContacts.find((c) => {
              const cClean = c.phoneNumber.replace(/\D/g, '');
              return cleanSender === cClean || cleanSender.endsWith(cClean) || cClean.endsWith(cleanSender);
            });
          } catch (cErr) {
            console.warn('[Baileys] Contact lookup warning:', cErr.message);
          }

          // Whitelist check: strictly only reply to selected numbers (either in WhitelistContact or allowedPhoneNumber string)
          const rawAllowed = settings.allowedPhoneNumber || '';
          const allowedList = rawAllowed
            .split(/[,;\n\s]+/)
            .map((num) => num.replace(/\D/g, ''))
            .filter((num) => num.length >= 7 && num !== '1234567890');

          const isAllowedByString = allowedList.some(
            (allowed) => cleanSender === allowed || cleanSender.endsWith(allowed) || allowed.endsWith(cleanSender)
          );

          if (!matchedContact && !isAllowedByString && (allowedList.length > 0 || rawAllowed.trim() !== '')) {
            console.log(`[Baileys] 🔒 Message from ${senderPhone} ignored (not in selected numbers list).`);
            try {
              await MessageLog.create({
                sender: senderPhone,
                messageIn: messageText,
                messageOut: '[Silently Ignored - Sender not in whitelist]',
                status: 'IGNORED_PHONE_MISMATCH',
                metaMessageId: msg.key.id || `baileys_${Date.now()}`,
              });
            } catch (ignoreDbErr) {}
            continue;
          }

          // Check if session is paused for Live Agent
          const isPausedForAgent = await isSessionHandedOff(senderPhone);
          if (isPausedForAgent) {
            console.log(`[Baileys] 🛑 Automated replies PAUSED for ${senderPhone} (Live Agent Mode Active).`);
            try {
              await MessageLog.create({
                sender: senderPhone,
                messageIn: messageText,
                messageOut: '[Automated responses paused - Live agent active]',
                status: 'PAUSED_FOR_AGENT',
                metaMessageId: msg.key.id || `baileys_${Date.now()}`,
              });
            } catch (pErr) {}
            continue;
          }

          // Check if user explicitly typed 'agent' or 'human' keyword
          const requestedAgent = detectAgentKeyword(messageText);
          if (requestedAgent) {
            console.log(`[Baileys] 🚨 Live Agent requested by ${senderPhone} via keyword ("${messageText}"). Pausing automated responses.`);
            await activateHandover(senderPhone, 'KEYWORD_AGENT');

            const isEnglishQuery = /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(messageText) && !/\b(kya|bhai|bolo|karo|nahi)\b/i.test(messageText);
            const handoverReply = isEnglishQuery
              ? "I am connecting you with our live agent team immediately. Automated responses have been paused. A team member will assist you shortly."
              : "Main aapko hamari live team se connect kar raha hoon. AI replies pause kar diye gaye hain, hamari team aapse jald hi rabta karegi.";

            try {
              await sock.sendMessage(senderJid, { text: handoverReply });
              await MessageLog.create({
                sender: senderPhone,
                messageIn: messageText,
                messageOut: handoverReply,
                status: 'AGENT_HANDOFF_TRIGGERED',
                metaMessageId: msg.key.id || `baileys_${Date.now()}`,
              });
              await recordMessageExchange(senderPhone, messageText, handoverReply);
            } catch (hErr) {}
            continue;
          }

          // Check if user is in game mode or triggering game mode (/game, /exit, number pick, game turns)
          const gameTurnResult = await processGameTurn(senderPhone, messageText);
          if (gameTurnResult.handled && gameTurnResult.replyText) {
            console.log(`[Baileys] 🎮 Game turn processed for ${senderPhone}. Sending response.`);
            try {
              await sock.readMessages([msg.key]);
              await sock.sendPresenceUpdate('composing', senderJid);
              await new Promise((resolve) => setTimeout(resolve, 800));
              await sock.sendPresenceUpdate('paused', senderJid);
              await sock.sendMessage(senderJid, { text: gameTurnResult.replyText });

              await MessageLog.create({
                sender: senderPhone,
                messageIn: messageText,
                messageOut: gameTurnResult.replyText,
                status: 'PROCESSED',
                metaMessageId: msg.key.id || `baileys_${Date.now()}`,
              });
              await recordMessageExchange(senderPhone, messageText, gameTurnResult.replyText);
            } catch (gErr) {
              console.error('[Baileys] Error sending game response:', gErr.message);
            }
            continue;
          }

          // Build isolated dynamic persona & tone directive tailored for this active contact with real-time style mirroring
          const persona = resolveContactPersona(matchedContact);
          const dynamicPrompt = buildDynamicPersonaPrompt(settings.systemPrompt, matchedContact, senderPhone, messageText);
          const contactDisplayName = matchedContact?.name || matchedContact?.relationship || senderPhone;
          if (matchedContact?.styleProfile?.hasCustomStyle) {
            console.log(`[Baileys] 🧬 EXCLUSIVE CHAT STYLE ACTIVE for ${contactDisplayName} (${matchedContact.styleProfile.tone || 'Learned'})`);
          } else {
            console.log(`[Baileys] 👤 Active Contact: ${contactDisplayName} | Persona Tone: [${persona.label}]`);
          }

          // 🛡️ ANTI-BAN HUMAN SIMULATION PIPELINE (4 STEPS)
          const isAntiBanActive = settings.humanSimulationEnabled ?? true;
          const minDelay = settings.minReadingDelayMs ?? 2000;
          const maxDelay = settings.maxReadingDelayMs ?? 6000;
          const typingCPM = settings.typingSpeedCPM ?? 250;

          // STEP 1: Message Arrival & Blue Tick (Read Receipt)
          try {
            await sock.readMessages([msg.key]);
          } catch (readErr) {
            // non-fatal
          }

          // STEP 2: Calculated Human Reading Delay
          if (isAntiBanActive) {
            // Random reading pause proportional to incoming text length (2s - 4s)
            const incomingLen = messageText.length;
            const rawReadTime = Math.min(3500, Math.max(1500, incomingLen * 40));
            const readJitter = Math.floor(Math.random() * 600) - 300; // ±300ms natural human variance
            const finalReadDelay = Math.max(minDelay, Math.min(maxDelay, rawReadTime + readJitter));

            console.log(`[Anti-Ban Shield] 👁️ Simulating human reading pause for ${senderPhone} (${finalReadDelay}ms)...`);
            await new Promise((resolve) => setTimeout(resolve, finalReadDelay));
          }

          // STEP 3: Typing Presence Simulation ("typing..." status)
          try {
            await sock.sendPresenceUpdate('composing', senderJid);
          } catch (presenceErr) {
            // non-fatal
          }

          const typingStartTime = Date.now();

          // Fetch active schedule auto-reply if present
          let replyText = null;
          let matchedSchedule = null;

          try {
            matchedSchedule = await checkActiveSchedule(new Date(), matchedContact?.relationship, senderPhone);
            if (matchedSchedule) {
              console.log(`[Baileys] 📅 Active schedule matched: "${matchedSchedule.title}" -> Using scheduled auto-reply.`);
              replyText = matchedSchedule.autoReplyText;
            }
          } catch (scheduleErr) {
            console.warn('[Baileys] Error checking schedule:', scheduleErr.message);
          }

          // Generate Gemini AI response with isolated dynamic persona
          let failResult = null;
          if (!replyText) {
            try {
              const chatHistory = await getGeminiChatHistory(senderPhone);
              replyText = await generateGeminiReply(messageText, dynamicPrompt, chatHistory);
              await resetFailedAttempts(senderPhone);
            } catch (aiErr) {
              console.warn(`[Baileys] Gemini generation error:`, aiErr.message);
              failResult = await recordFailedAttempt(senderPhone);
              if (failResult.triggeredHandover) {
                console.log(`[Baileys] 🚨 AI failed after 3 attempts for ${senderPhone}. Pausing automated responses.`);
                replyText = "I apologize, but I am unable to properly resolve your query. I have notified our live agent team immediately and paused automated replies so a human can step in to assist you.";
              } else {
                if (persona.key === 'ROMANTIC') {
                  replyText = "Haan meri jaan! Bas abhi free hua. Khana khaya aapne? Sab theek?";
                } else if (persona.key === 'RESPECTFUL') {
                  replyText = "Pranam Bhabhi ji! Boliye, sab theek thaak? Main thoda sa busy tha, bataiye kya baat thi?";
                } else if (persona.key === 'CASUAL_SLANG') {
                  replyText = "Haan bhai bol na, kya scene hai? Sab sort hai?";
                } else if (persona.key === 'EMOTIONAL') {
                  replyText = "Haanji, main hamesha yahan hoon. Dil chhota mat karna, bataiye kya baat hai?";
                } else {
                  replyText = "Haanji, boliye kya haal chaal? Sab theek? Bataiye kya baat thi.";
                }
              }
            }
          }

          // Dynamic Typing Speed & Rhythm Delay Calculation
          if (isAntiBanActive) {
            const elapsedAiTime = Date.now() - typingStartTime;
            const replyLength = replyText?.length || 40;

            // CPM formula: characters / (CPM / 60,000 ms)
            const msPerChar = 60000 / typingCPM;
            const rawTypingDuration = replyLength * msPerChar;
            const typingJitter = Math.floor(Math.random() * 800) - 400; // ±400ms human typing variance
            const targetTypingDuration = Math.max(minDelay, Math.min(maxDelay, Math.round(rawTypingDuration + typingJitter)));
            const remainingTypingDelay = Math.max(500, targetTypingDuration - elapsedAiTime);

            console.log(`[Anti-Ban Shield] ⌨️ Simulating human typing rhythm for ${senderPhone} (${remainingTypingDelay}ms remaining)...`);
            await new Promise((resolve) => setTimeout(resolve, remainingTypingDelay));
          }

          // Pause typing presence right before sending
          try {
            await sock.sendPresenceUpdate('paused', senderJid);
          } catch (pErr) {
            // non-fatal
          }

          // STEP 4: Natural Delivery (Dispatch WhatsApp Message)
          await sock.sendMessage(senderJid, { text: replyText });
          console.log(`[Anti-Ban Shield] ✅ Message naturally delivered to ${senderPhone}: "${replyText.substring(0, 75)}..."`);

          // Save to database message logs
          try {
            await MessageLog.create({
              sender: senderPhone,
              messageIn: messageText,
              messageOut: replyText,
              status: failResult?.triggeredHandover ? 'AGENT_HANDOFF_TRIGGERED' : 'PROCESSED',
              metaMessageId: msg.key.id || `baileys_${Date.now()}`,
            });
          } catch (dbErr) {
            console.error('[Baileys] Error logging message to DB:', dbErr.message);
          }

          // Atomically record to capped ChatSession history
          try {
            await recordMessageExchange(senderPhone, messageText, replyText);
          } catch (histErr) {
            console.warn('[Baileys] Error recording chat history:', histErr.message);
          }

          // Trigger CRM Lead Tagging & Sentiment Classification asynchronously
          try {
            analyzeAndTagContact(senderPhone, messageText).catch((crmErr) => {
              console.warn('[CRM Lead Board] Async classification note:', crmErr.message);
            });
          } catch (crmCallErr) {}
        } catch (msgErr) {
          console.error(`[Baileys] Error processing message from ${senderPhone}:`, msgErr.message);
        }
      }
    });

  } catch (error) {
    console.error('[Baileys] Initialization error:', error);
    connectionStatus = 'disconnected';
  } finally {
    isInitializing = false;
  }
}

function getStatus() {
  return {
    status: connectionStatus,
    qrCode: currentQrCode,
    connectedPhoneNumber: connectedPhoneNumber,
  };
}

async function logout() {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (err) {
    console.warn('[Baileys] Sock logout warning:', err.message);
  }
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[Baileys] File cleanup warning:', err.message);
  }
  connectionStatus = 'disconnected';
  connectedPhoneNumber = null;
  currentQrCode = null;
  setTimeout(() => initBaileys(true), 1500);
  return { success: true, message: 'Logged out successfully.' };
}

module.exports = {
  initBaileys,
  getStatus,
  logout,
};
