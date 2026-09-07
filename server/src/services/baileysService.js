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
const { checkActiveSchedule } = require('./scheduleService');
const { buildDynamicPersonaPrompt, resolveContactPersona } = require('./personaService');
const { getGeminiChatHistory, recordMessageExchange } = require('./chatHistoryService');
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

          // Build isolated dynamic persona & tone directive tailored for this active contact with real-time style mirroring
          const persona = resolveContactPersona(matchedContact);
          const dynamicPrompt = buildDynamicPersonaPrompt(settings.systemPrompt, matchedContact, senderPhone, messageText);
          const contactDisplayName = matchedContact?.name || matchedContact?.relationship || senderPhone;
          if (matchedContact?.styleProfile?.hasCustomStyle) {
            console.log(`[Baileys] 🧬 EXCLUSIVE CHAT STYLE ACTIVE for ${contactDisplayName} (${matchedContact.styleProfile.tone || 'Learned'})`);
          } else {
            console.log(`[Baileys] 👤 Active Contact: ${contactDisplayName} | Persona Tone: [${persona.label}]`);
          }

          // 1. Mark message as read (blue ticks)
          try {
            await sock.readMessages([msg.key]);
          } catch (readErr) {
            // non-fatal
          }

          // 2. Trigger initial typing presence immediately
          try {
            await sock.sendPresenceUpdate('composing', senderJid);
          } catch (presenceErr) {
            // non-fatal
          }

          const typingStartTime = Date.now();

          // 3. Check for predefined schedules (Gym timings, Birthday events, Sleep mode)
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

          // 4. If no active schedule matched, proceed with processing the message using Gemini AI with the isolated persona
          if (!replyText) {
            try {
              const chatHistory = await getGeminiChatHistory(senderPhone);
              replyText = await generateGeminiReply(messageText, dynamicPrompt, chatHistory);
            } catch (aiErr) {
              console.warn(`[Baileys] Gemini generation fallback triggered:`, aiErr.message);
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

          // 4. Calculate realistic human typing duration (mimics human typing speed)
          // Minimum 2000ms (2s), Maximum 4500ms (4.5s) based on message length
          const elapsedAiTime = Date.now() - typingStartTime;
          const targetTypingDuration = Math.min(4500, Math.max(2000, (replyText?.length || 50) * 30));
          const remainingDelay = Math.max(400, targetTypingDuration - elapsedAiTime);

          // Hold typing presence for the remaining human-like typing duration
          await new Promise((resolve) => setTimeout(resolve, remainingDelay));

          // 5. Pause typing presence right before sending
          try {
            await sock.sendPresenceUpdate('paused', senderJid);
          } catch (pErr) {
            // non-fatal
          }

          // 6. Send WhatsApp reply
          await sock.sendMessage(senderJid, { text: replyText });
          console.log(`[Baileys] 🤖 Replied to ${senderPhone}: "${replyText.substring(0, 80)}..."`);

          // Save to database message logs
          try {
            await MessageLog.create({
              sender: senderPhone,
              messageIn: messageText,
              messageOut: replyText,
              status: 'PROCESSED',
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
