const BotSettings = require("../models/BotSettings");
const MessageLog = require("../models/MessageLog");
const { generateGeminiReply } = require("../services/geminiService");
const { checkActiveSchedule } = require("../services/scheduleService");
const { sendWhatsAppMessage } = require("../services/whatsappService");
const { getGeminiChatHistory, recordMessageExchange } = require("../services/chatHistoryService");

/**
 * Normalizes phone numbers for comparison (removes all non-digit characters)
 */
function normalizePhoneNumber(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

/**
 * Verification endpoint for Meta WhatsApp Cloud API (GET /webhook)
 */
const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || "whatsapp_bot_verify_token_secret_123";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ WhatsApp Webhook verified successfully!");
      return res.status(200).send(challenge);
    } else {
      console.warn(
        `❌ WhatsApp Webhook verification failed. Token mismatch: received "${token}", expected "${verifyToken}"`,
      );
      return res.status(403).json({ error: "Verification token mismatch" });
    }
  }

  return res
    .status(400)
    .json({ error: "Missing hub.mode or hub.verify_token query parameters" });
};

/**
 * Event handler for incoming WhatsApp messages (POST /webhook)
 */
const handleIncoming = async (req, res) => {
  // Always return 200 OK to Meta quickly to acknowledge receipt
  try {
    const body = req.body;

    if (!body || body.object !== "whatsapp_business_account") {
      return res
        .status(200)
        .json({ status: "ignored_not_whatsapp_business_account" });
    }

    const entry = Array.isArray(body.entry) ? body.entry[0] : body.entry || {};
    const changes = Array.isArray(entry.changes)
      ? entry.changes[0]
      : entry.changes || {};
    const value = changes.value || {};

    const rawMessages = value.messages || body.messages;
    const messages = Array.isArray(rawMessages)
      ? rawMessages
      : rawMessages
        ? [rawMessages]
        : [];

    // Check if this is a message event or status update (e.g., delivered/read)
    if (messages.length === 0) {
      // Ignored non-message events (e.g. read receipts, delivery confirmations)
      return res.status(200).json({ status: "ignored_no_messages" });
    }

    const message = messages[0];
    const contacts = Array.isArray(value.contacts)
      ? value.contacts[0]
      : value.contacts;
    const sender = message.from || contacts?.wa_id || "unknown";
    const messageId = message.id || null;

    // We process text messages, or provide a default notice if media/interactive
    let messageText = "";
    if (message.type === "text" && message.text?.body) {
      messageText = message.text.body;
    } else {
      messageText = `[Received ${message.type} message]`;
    }

    console.log(`📩 Incoming message from ${sender}: "${messageText}"`);

    // Fetch current bot settings from MongoDB
    const settings = await BotSettings.getSettings();

    // 1. Check if Bot is Enabled
    if (!settings.isEnabled) {
      console.log(
        `⏸️ Bot is currently DISABLED. Skipping message from ${sender}.`,
      );
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: "",
        status: "BOT_DISABLED",
        metaMessageId: messageId,
      });
      return res.status(200).json({ status: "bot_disabled" });
    }

    // 2. Phone Number Filter: Process only from selected allowed phone numbers
    if (settings.allowedPhoneNumber && settings.allowedPhoneNumber.trim() !== '') {
      const allowedList = settings.allowedPhoneNumber
        .split(/[,;\n\s]+/)
        .map((num) => num.replace(/\D/g, ''))
        .filter((num) => num.length >= 7 && num !== '1234567890');

      if (allowedList.length > 0) {
        const cleanSender = sender.replace(/\D/g, '');
        const isAllowed = allowedList.some(
          (allowed) => cleanSender === allowed || cleanSender.endsWith(allowed) || allowed.endsWith(cleanSender)
        );

        if (!isAllowed) {
          console.log(
            `🚫 Phone Filter: Sender ${sender} is not in your selected allowed numbers list. Message filtered.`
          );
          await MessageLog.create({
            sender,
            messageIn: messageText,
            messageOut: '',
            status: 'IGNORED_PHONE_MISMATCH',
            metaMessageId: messageId,
          });
          return res.status(200).json({ status: 'ignored_phone_mismatch' });
        }
      }
    }

    // 3. Check for active predefined schedule (e.g. Gym timing, Birthday event)
    let replyText = "";
    try {
      const matchedSchedule = await checkActiveSchedule(new Date());
      if (matchedSchedule) {
        console.log(`📅 Active schedule matched: "${matchedSchedule.title}" -> Using scheduled auto-reply.`);
        replyText = matchedSchedule.autoReplyText;
      }
    } catch (schedErr) {
      console.warn("Schedule check error:", schedErr.message);
    }

    // If no active schedule matched, process with Google Gemini API
    if (!replyText) {
      console.log(`🤖 Generating polite Gemini reply for ${sender}...`);
      try {
        const chatHistory = await getGeminiChatHistory(sender);
        replyText = await generateGeminiReply(messageText, settings.systemPrompt, chatHistory);
      } catch (geminiErr) {
        console.error("Gemini error:", geminiErr.message);
        await MessageLog.create({
          sender,
          messageIn: messageText,
          messageOut: "",
          status: "ERROR",
          errorMessage: `Gemini failure: ${geminiErr.message}`,
          metaMessageId: messageId,
        });
        return res
          .status(200)
          .json({ status: "gemini_error", error: geminiErr.message });
      }
    }

    // 4. Send response back via Meta WhatsApp Cloud API
    try {
      await sendWhatsAppMessage(sender, replyText);

      // 5. Log processed conversation in MongoDB
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: replyText,
        status: "PROCESSED",
        metaMessageId: messageId,
      });

      // 6. Record to capped ChatSession history
      try {
        await recordMessageExchange(sender, messageText, replyText);
      } catch (histErr) {
        console.warn('History record err:', histErr.message);
      }

      console.log(`✅ Successfully replied to ${sender}`);
      return res.status(200).json({ status: "success", replyText });
    } catch (sendErr) {
      console.error("WhatsApp send error:", sendErr.message);
      await MessageLog.create({
        sender,
        messageIn: messageText,
        messageOut: replyText,
        status: "ERROR",
        errorMessage: `WhatsApp send failure: ${sendErr.message}`,
        metaMessageId: messageId,
      });
      return res
        .status(200)
        .json({ status: "send_error", error: sendErr.message });
    }
  } catch (err) {
    console.error("Webhook processing exception:", err);
    return res.status(200).json({ status: "server_error", error: err.message });
  }
};

module.exports = {
  verifyWebhook,
  handleIncoming,
  normalizePhoneNumber,
};
