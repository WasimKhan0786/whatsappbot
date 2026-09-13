const ChatSession = require('../models/ChatSession');
const BotSettings = require('../models/BotSettings');

/**
 * Normalizes phone numbers (stripping non-digits and leading +)
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * Records an owner message activity, pausing automated replies and resetting the inactivity timer.
 * 
 * @param {string} contactPhone - Phone number of the contact the owner conversed with
 * @param {number} [customDurationMinutes] - Optional override duration in minutes
 * @returns {Promise<object>} Status of the inactivity pause
 */
async function recordOwnerActivity(contactPhone, customDurationMinutes = null) {
  const cleanPhone = cleanPhoneNumber(contactPhone);
  const settings = await BotSettings.getSettings();

  if (settings.ownerInactivityTimerEnabled === false) {
    return {
      success: false,
      enabled: false,
      message: 'Owner inactivity timer is currently disabled in Bot Controls.',
    };
  }

  const durationMinutes = Number(
    customDurationMinutes || settings.ownerInactivityDurationMinutes || 15
  );
  const now = new Date();
  const pausedUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const scope = settings.ownerInactivityScope || 'PER_CHAT';

  console.log(`[InactivityTimer] 🕒 Owner sent a message! Resetting inactivity timer.`);
  console.log(`[InactivityTimer] ⏸️ Automated replies paused for ${durationMinutes} min (until ${pausedUntil.toLocaleTimeString()}) | Scope: ${scope}`);

  if (scope === 'GLOBAL') {
    settings.ownerGlobalLastActivityAt = now;
    settings.ownerGlobalPausedUntil = pausedUntil;
    await settings.save();
  }

  let session = null;
  if (cleanPhone) {
    session = await ChatSession.findOneAndUpdate(
      { sessionId: cleanPhone },
      {
        $set: {
          isOwnerActivePaused: true,
          ownerLastActivityAt: now,
          ownerPausedUntil: pausedUntil,
          updatedAt: now,
        },
      },
      { upsert: true, new: true }
    );
  }

  return {
    success: true,
    isPaused: true,
    contactPhone: cleanPhone,
    durationMinutes,
    pausedUntil,
    scope,
    session,
  };
}

/**
 * Checks whether automated replies are currently paused due to recent owner activity.
 * If the inactivity duration has elapsed, it automatically resumes automated replies.
 * 
 * @param {string} contactPhone - Phone number of the incoming contact
 * @returns {Promise<{ isPaused: boolean, remainingMinutes?: number, remainingSeconds?: number, pausedUntil?: Date, lastActivityAt?: Date, scope?: string, autoResumed?: boolean }>}
 */
async function checkOwnerInactivityStatus(contactPhone) {
  const cleanPhone = cleanPhoneNumber(contactPhone);
  const settings = await BotSettings.getSettings();

  if (settings.ownerInactivityTimerEnabled === false) {
    return { isPaused: false, enabled: false };
  }

  const nowMs = Date.now();
  const scope = settings.ownerInactivityScope || 'PER_CHAT';

  // 1. Check Global Scope pause
  if (scope === 'GLOBAL' && settings.ownerGlobalPausedUntil) {
    const pauseEndMs = new Date(settings.ownerGlobalPausedUntil).getTime();
    if (nowMs < pauseEndMs) {
      const remainingMs = pauseEndMs - nowMs;
      return {
        isPaused: true,
        scope: 'GLOBAL',
        remainingMinutes: Math.ceil(remainingMs / 60000),
        remainingSeconds: Math.ceil(remainingMs / 1000),
        pausedUntil: settings.ownerGlobalPausedUntil,
        lastActivityAt: settings.ownerGlobalLastActivityAt,
      };
    } else {
      // Global pause expired
      settings.ownerGlobalPausedUntil = null;
      await settings.save();
      console.log(`[InactivityTimer] ⏰ Global owner inactivity expired. Automated replies resumed globally.`);
    }
  }

  // 2. Check Per-Chat Scope pause
  if (cleanPhone) {
    const session = await ChatSession.findOne({ sessionId: cleanPhone });
    if (session && session.isOwnerActivePaused && session.ownerPausedUntil) {
      const pauseEndMs = new Date(session.ownerPausedUntil).getTime();
      if (nowMs < pauseEndMs) {
        const remainingMs = pauseEndMs - nowMs;
        return {
          isPaused: true,
          scope: 'PER_CHAT',
          remainingMinutes: Math.ceil(remainingMs / 60000),
          remainingSeconds: Math.ceil(remainingMs / 1000),
          pausedUntil: session.ownerPausedUntil,
          lastActivityAt: session.ownerLastActivityAt,
        };
      } else {
        // Inactivity period elapsed without owner messages: Auto-resume!
        session.isOwnerActivePaused = false;
        session.ownerPausedUntil = null;
        await session.save();
        console.log(`[InactivityTimer] ⏰ Inactivity duration expired for ${cleanPhone}. Automated bot replies resumed!`);
        return {
          isPaused: false,
          autoResumed: true,
        };
      }
    }
  }

  return { isPaused: false };
}

/**
 * Manually unpauses and resumes automated replies for a contact or globally.
 * 
 * @param {string} [contactPhone] - Optional phone number to unpause. If not provided, clears global pause.
 * @returns {Promise<object>}
 */
async function resumeOwnerInactivity(contactPhone = null) {
  const cleanPhone = cleanPhoneNumber(contactPhone);
  const now = new Date();

  if (cleanPhone) {
    await ChatSession.findOneAndUpdate(
      { sessionId: cleanPhone },
      {
        $set: {
          isOwnerActivePaused: false,
          ownerPausedUntil: null,
          updatedAt: now,
        },
      }
    );
  }

  const settings = await BotSettings.getSettings();
  if (settings.ownerGlobalPausedUntil) {
    settings.ownerGlobalPausedUntil = null;
    await settings.save();
  }

  console.log(`[InactivityTimer] ▶️ Automated replies manually resumed for: ${cleanPhone || 'ALL (Global)'}`);
  return {
    success: true,
    resumedContact: cleanPhone || 'GLOBAL',
    message: 'Automated replies resumed successfully.',
  };
}

/**
 * Retrieves all currently active inactivity-paused sessions with countdown info.
 * 
 * @returns {Promise<Array>}
 */
async function getActiveInactivitySessions() {
  const settings = await BotSettings.getSettings();
  const now = new Date();

  const sessions = await ChatSession.find({
    isOwnerActivePaused: true,
    ownerPausedUntil: { $gt: now },
  }).lean();

  const results = sessions.map((s) => {
    const remainingMs = new Date(s.ownerPausedUntil).getTime() - now.getTime();
    return {
      contactPhone: s.sessionId,
      lastActivityAt: s.ownerLastActivityAt,
      pausedUntil: s.ownerPausedUntil,
      remainingMinutes: Math.ceil(remainingMs / 60000),
      remainingSeconds: Math.ceil(remainingMs / 1000),
      scope: 'PER_CHAT',
    };
  });

  if (settings.ownerInactivityScope === 'GLOBAL' && settings.ownerGlobalPausedUntil && new Date(settings.ownerGlobalPausedUntil) > now) {
    const remainingMs = new Date(settings.ownerGlobalPausedUntil).getTime() - now.getTime();
    results.unshift({
      contactPhone: 'GLOBAL (All Chats)',
      lastActivityAt: settings.ownerGlobalLastActivityAt,
      pausedUntil: settings.ownerGlobalPausedUntil,
      remainingMinutes: Math.ceil(remainingMs / 60000),
      remainingSeconds: Math.ceil(remainingMs / 1000),
      scope: 'GLOBAL',
    });
  }

  return results;
}

module.exports = {
  cleanPhoneNumber,
  recordOwnerActivity,
  checkOwnerInactivityStatus,
  resumeOwnerInactivity,
  getActiveInactivitySessions,
};
