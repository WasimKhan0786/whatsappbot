const nodemailer = require('nodemailer');
const { sendWhatsAppMessage } = require('./whatsappService');

/**
 * Multi-Channel System Alert Notification Service
 * Dispatches error and restart alerts to the bot owner via WhatsApp and/or Email.
 */

/**
 * Formats a clean, readable alert message for WhatsApp
 */
function formatWhatsAppAlert({ errorType, errorMessage, errorStack, restartAttempted, restartStatus, restartDetails }) {
  const timeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());

  const stackSnippet = (errorStack || '')
    .split('\n')
    .slice(0, 4)
    .map((l) => l.trim())
    .join('\n');

  let restartBanner = '⏸️ *No Restart Attempted*';
  if (restartAttempted) {
    if (restartStatus === 'SUCCESS') {
      restartBanner = '✅ *Auto-Restart: Successfully Restored (Attempt 1/1)*';
    } else if (restartStatus === 'FAILED') {
      restartBanner = '❌ *Auto-Restart: Failed to Revive Bot*';
    } else if (restartStatus === 'COOLDOWN_EXCEEDED') {
      restartBanner = '🛑 *Auto-Restart: Circuit Breaker Active (Max 1 Restart Reached)*';
    }
  }

  return (
    `🚨 *[WHATSAPP BOT RUNTIME INCIDENT ALERT]* 🚨\n\n` +
    `⚠️ *Incident Type:* ${errorType || 'RUNTIME_ERROR'}\n` +
    `📝 *Error Message:* ${errorMessage || 'Unknown exception'}\n` +
    `🕒 *Timestamp:* ${timeStr} (IST)\n\n` +
    `🔄 *Recovery Status:*\n` +
    `${restartBanner}\n` +
    (restartDetails ? `ℹ️ *Details:* ${restartDetails}\n` : '') +
    (stackSnippet ? `\n📋 *Trace Snippet:*\n\`\`\`\n${stackSnippet}\n\`\`\`` : '') +
    `\n\n🛡️ _Automated Safety & Recovery System_`
  );
}

/**
 * Formats HTML email for alert delivery
 */
function formatEmailAlert({ errorType, errorMessage, errorStack, restartAttempted, restartStatus, restartDetails }) {
  const timeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(new Date());

  const isSuccess = restartStatus === 'SUCCESS';
  const headerBg = isSuccess ? '#166534' : '#991b1b';

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
    <div style="background: ${headerBg}; padding: 20px 24px; text-align: center;">
      <h2 style="margin: 0; color: #ffffff; font-size: 20px;">🚨 WhatsApp Bot Runtime Alert</h2>
      <p style="margin: 6px 0 0; color: #e2e8f0; font-size: 14px;">Automated Crash Recovery & Supervisor Notification</p>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; font-weight: 600; width: 140px;">Incident Type:</td>
          <td style="padding: 8px 0; color: #f87171; font-weight: bold;">${errorType || 'RUNTIME_ERROR'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">Error Message:</td>
          <td style="padding: 8px 0; color: #ffffff;">${errorMessage || 'Unknown exception'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">Timestamp:</td>
          <td style="padding: 8px 0; color: #cbd5e1;">${timeStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">Restart Attempt:</td>
          <td style="padding: 8px 0; color: ${restartAttempted ? '#38bdf8' : '#94a3b8'};">
            ${restartAttempted ? 'Attempted (1/1 Attempt Budget)' : 'No'}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">Restart Outcome:</td>
          <td style="padding: 8px 0; color: ${isSuccess ? '#4ade80' : '#f87171'}; font-weight: bold;">
            ${restartStatus || 'NOT_ATTEMPTED'}
          </td>
        </tr>
        ${
          restartDetails
            ? `<tr><td style="padding: 8px 0; color: #94a3b8; font-weight: 600;">Notes:</td><td style="padding: 8px 0; color: #cbd5e1;">${restartDetails}</td></tr>`
            : ''
        }
      </table>

      ${
        errorStack
          ? `
      <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 8px; color: #94a3b8; font-size: 13px; text-transform: uppercase;">Stack Trace</h4>
        <pre style="background: #1e293b; padding: 12px; border-radius: 8px; font-size: 12px; color: #fca5a5; overflow-x: auto; white-space: pre-wrap;">${errorStack}</pre>
      </div>`
          : ''
      }
    </div>
    <div style="background: #1e293b; padding: 12px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155;">
      WhatsApp Bot Resilience Supervisor • Automated Alert Dispatch
    </div>
  </div>
  `;
}

/**
 * Sends WhatsApp notification to owner/admin
 */
async function sendWhatsAppAlert(messageText) {
  // Resolve primary admin phone number
  const configuredNumber =
    process.env.ALERT_WHATSAPP_NUMBER ||
    (process.env.ALLOWED_PHONE_NUMBER ? process.env.ALLOWED_PHONE_NUMBER.split(/[,;\s]+/)[0] : '') ||
    '+917004636112';

  const cleanRecipient = configuredNumber.replace(/\D/g, '');

  if (!cleanRecipient) {
    return {
      attempted: false,
      sent: false,
      recipient: '',
      error: 'No valid recipient phone number configured for alerts',
    };
  }

  // 1. Try Baileys WhatsApp Web socket first if available
  try {
    const baileysService = require('./baileysService');
    if (typeof baileysService.sendBaileysMessage === 'function') {
      await baileysService.sendBaileysMessage(cleanRecipient, messageText);
      console.log(`[AlertService] 📱 WhatsApp alert successfully delivered via Baileys to +${cleanRecipient}`);
      return {
        attempted: true,
        sent: true,
        recipient: `+${cleanRecipient}`,
        channel: 'BAILEYS',
      };
    }
  } catch (baileysErr) {
    console.warn(`[AlertService] Baileys socket alert delivery skipped/failed: ${baileysErr.message}. Trying Meta/Twilio fallback...`);
  }

  // 2. Try Meta WhatsApp Cloud API
  try {
    const cloudRes = await sendWhatsAppMessage(cleanRecipient, messageText);
    console.log(`[AlertService] 📱 WhatsApp alert dispatched via Cloud API to +${cleanRecipient} (Mock: ${Boolean(cloudRes?.isMock)})`);
    return {
      attempted: true,
      sent: true,
      recipient: `+${cleanRecipient}`,
      channel: cloudRes?.isMock ? 'MOCK_LOG' : 'META_CLOUD_API',
    };
  } catch (cloudErr) {
    console.error(`[AlertService] Meta Cloud API alert dispatch failed:`, cloudErr.message);
    return {
      attempted: true,
      sent: false,
      recipient: `+${cleanRecipient}`,
      error: cloudErr.message,
    };
  }
}

/**
 * Sends Email notification via Nodemailer (SMTP)
 */
async function sendEmailAlert(subject, textBody, htmlBody) {
  const recipient = process.env.ALERT_EMAIL_TO || process.env.SMTP_TO || '';

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!recipient || !host || !user || !pass) {
    const missing = [];
    if (!recipient) missing.push('ALERT_EMAIL_TO');
    if (!host) missing.push('SMTP_HOST');
    if (!user) missing.push('SMTP_USER');
    if (!pass) missing.push('SMTP_PASS');

    console.log(`[AlertService] 📧 Email alert skipped: SMTP credentials not fully configured (${missing.join(', ')}).`);
    return {
      attempted: false,
      sent: false,
      recipient: recipient || 'Not specified',
      error: `Missing config: ${missing.join(', ')}`,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      timeout: 10000,
    });

    const fromAddress = process.env.SMTP_FROM || `"WhatsApp Bot Supervisor" <${user}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`[AlertService] 📧 Email alert successfully dispatched to ${recipient} (Message ID: ${info.messageId})`);
    return {
      attempted: true,
      sent: true,
      recipient,
      messageId: info.messageId,
    };
  } catch (emailErr) {
    console.error('[AlertService] Error sending email alert:', emailErr.message);
    return {
      attempted: true,
      sent: false,
      recipient,
      error: emailErr.message,
    };
  }
}

/**
 * Dispatches an automated incident alert across WhatsApp and Email
 *
 * @param {object} params
 * @param {string} params.errorType - Incident category
 * @param {string} params.errorMessage - Error description
 * @param {string} [params.errorStack] - Traceback
 * @param {boolean} [params.restartAttempted=false] - Whether auto-restart was executed
 * @param {string} [params.restartStatus='NOT_ATTEMPTED'] - SUCCESS | FAILED | COOLDOWN_EXCEEDED
 * @param {string} [params.restartDetails=''] - Context or explanation
 * @returns {Promise<{ whatsapp: object, email: object }>}
 */
async function sendErrorAlert({ errorType, errorMessage, errorStack, restartAttempted = false, restartStatus = 'NOT_ATTEMPTED', restartDetails = '' }) {
  console.log(`🚨 [AlertService] Preparing incident alert dispatch for [${errorType}]: ${errorMessage}`);

  const whatsappText = formatWhatsAppAlert({
    errorType,
    errorMessage,
    errorStack,
    restartAttempted,
    restartStatus,
    restartDetails,
  });

  const emailSubject = `[ALERT] WhatsApp Bot ${restartStatus === 'SUCCESS' ? 'Restored' : 'Error'}: ${errorType} - ${errorMessage.substring(0, 40)}`;
  const emailHtml = formatEmailAlert({
    errorType,
    errorMessage,
    errorStack,
    restartAttempted,
    restartStatus,
    restartDetails,
  });

  // Dispatch concurrently
  const [whatsappResult, emailResult] = await Promise.allSettled([
    sendWhatsAppAlert(whatsappText),
    sendEmailAlert(emailSubject, whatsappText, emailHtml),
  ]);

  return {
    whatsapp: whatsappResult.status === 'fulfilled' ? whatsappResult.value : { attempted: true, sent: false, error: whatsappResult.reason?.message },
    email: emailResult.status === 'fulfilled' ? emailResult.value : { attempted: true, sent: false, error: emailResult.reason?.message },
  };
}

module.exports = {
  formatWhatsAppAlert,
  formatEmailAlert,
  sendWhatsAppAlert,
  sendEmailAlert,
  sendErrorAlert,
};
