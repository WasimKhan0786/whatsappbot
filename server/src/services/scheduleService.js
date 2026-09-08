const ScheduleEvent = require('../models/ScheduleEvent');
const MessageLog = require('../models/MessageLog');
const WhitelistContact = require('../models/WhitelistContact');

let activeSchedulerInterval = null;
// ⚡ In-Memory RAM Cache: Stores active schedules locally in RAM to eliminate redundant database reads
let cachedActiveSchedules = [];
let isCacheInitialized = false;

/**
 * Syncs and refreshes in-memory RAM cache from MongoDB
 */
async function refreshScheduleCache() {
  try {
    const schedules = await ScheduleEvent.find({ isActive: true }).sort({ priority: -1, createdAt: -1 });
    cachedActiveSchedules = schedules;
    isCacheInitialized = true;
    console.log(`[Schedule Cache] ⚡ In-Memory Cache Refreshed: ${cachedActiveSchedules.length} active schedules loaded in RAM.`);
    return cachedActiveSchedules;
  } catch (err) {
    console.error('[Schedule Cache] Error refreshing RAM schedule cache:', err.message);
    return cachedActiveSchedules;
  }
}

/**
 * Helper to check if a time (HH:mm) falls between start and end (handles overnight)
 * @param {string} currentHHmm - "20:15"
 * @param {string} startHHmm - "18:00"
 * @param {string} endHHmm - "20:00" or "07:00"
 * @returns {boolean}
 */
function isTimeInRange(currentHHmm, startHHmm, endHHmm) {
  if (!startHHmm || !endHHmm) return false;
  if (startHHmm <= endHHmm) {
    // Normal daytime window (e.g. 18:00 to 20:00)
    return currentHHmm >= startHHmm && currentHHmm <= endHHmm;
  } else {
    // Overnight window spanning past midnight (e.g. 23:00 to 07:00)
    return currentHHmm >= startHHmm || currentHHmm <= endHHmm;
  }
}

/**
 * Extracts localized time components based on target timezone (defaults to Asia/Kolkata)
 * @param {Date} date
 * @returns {{ currentHHmm: string, currentDayOfWeek: number, currentMonthDay: string, currentFullDate: string, currentYear: string }}
 */
function getLocalTimeComponents(date = new Date()) {
  const timeZone = process.env.TIMEZONE || 'Asia/Kolkata';

  // Format parts using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const hour = map.hour || '00';
  const minute = map.minute || '00';
  const currentHHmm = `${hour}:${minute}`;

  // Get day of week: Sunday = 0, Monday = 1, ... Saturday = 6
  const weekdayShortMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const currentDayOfWeek = weekdayShortMap[map.weekday] ?? date.getDay();

  const month = map.month || '01';
  const day = map.day || '01';
  const year = map.year || '2026';

  const currentMonthDay = `${month}-${day}`;
  const currentFullDate = `${year}-${month}-${day}`;

  return {
    currentHHmm,
    currentDayOfWeek,
    currentMonthDay,
    currentFullDate,
    currentYear: year,
  };
}

/**
 * Checks if a specific schedule event is active at a given date/time for incoming auto-reply
 * @param {object} schedule
 * @param {Date} date
 * @param {string} relationship
 * @returns {boolean}
 */
function isScheduleActive(schedule, date = new Date(), relationship = null, senderPhone = null) {
  if (!schedule || !schedule.isActive) return false;

  // If schedule is configured for PROACTIVE OUTBOUND, it should not be triggered as an incoming auto-reply
  if (schedule.executionMode === 'PROACTIVE_OUTBOUND_BROADCAST') {
    return false;
  }

  const { currentHHmm, currentDayOfWeek, currentMonthDay, currentFullDate } = getLocalTimeComponents(date);

  // 1. Specific Target Phone Numbers check (if specified in schedule)
  if (Array.isArray(schedule.targetPhoneNumbers) && schedule.targetPhoneNumbers.length > 0) {
    if (!senderPhone) return false;
    const cleanSender = senderPhone.replace(/\D/g, '');
    const isNumberMatched = schedule.targetPhoneNumbers.some((num) => {
      const cleanNum = String(num).replace(/\D/g, '');
      return cleanNum.length >= 7 && (cleanSender === cleanNum || cleanSender.endsWith(cleanNum) || cleanNum.endsWith(cleanSender));
    });
    if (!isNumberMatched) return false;
  }

  // 2. Relationship check (if targetRelationship is set to a specific role, e.g. 'Brother')
  if (schedule.targetRelationship && schedule.targetRelationship !== 'ALL') {
    if (!relationship) return false;
    const target = schedule.targetRelationship.toLowerCase().trim();
    const currentRel = relationship.toLowerCase().trim();
    if (!currentRel.includes(target) && !target.includes(currentRel)) {
      return false;
    }
  }

  // 3. Specific Date Events (e.g. Birthday, Anniversary, Holiday)
  if (schedule.type === 'SPECIFIC_DATE' || schedule.specificDate) {
    const sDate = (schedule.specificDate || '').trim();
    const isExactMatch = sDate === currentFullDate || sDate === currentMonthDay;
    if (!isExactMatch) return false;

    // If specific date also has time limits, check them
    if (schedule.startTime && schedule.endTime) {
      return isTimeInRange(currentHHmm, schedule.startTime, schedule.endTime);
    }
    return true;
  }

  // 4. Recurring Daily / Weekly Schedules (e.g. Gym, Sleep)
  if (schedule.type === 'RECURRING_DAILY' || schedule.type === 'RECURRING_WEEKLY') {
    // Check day of week
    if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
      if (!schedule.daysOfWeek.includes(currentDayOfWeek)) {
        return false;
      }
    }

    // Check time window (e.g. 18:00 to 20:00)
    return isTimeInRange(currentHHmm, schedule.startTime, schedule.endTime);
  }

  return false;
}

/**
 * Queries in-memory RAM cache first (0 DB load) and returns the highest priority active schedule event
 * @param {Date} targetDate
 * @param {string} relationship - Optional relationship role of sender (e.g. 'Brother', 'Bhabhi')
 * @param {string} senderPhone - Optional phone number of sender
 * @returns {Promise<object|null>} - Returns the matched schedule event, or null if no schedule is active
 */
async function checkActiveSchedule(targetDate = new Date(), relationship = null, senderPhone = null) {
  try {
    // Ensure cache is populated
    if (!isCacheInitialized) {
      await refreshScheduleCache();
    }

    for (const schedule of cachedActiveSchedules) {
      if (isScheduleActive(schedule, targetDate, relationship, senderPhone)) {
        return schedule;
      }
    }
    return null;
  } catch (error) {
    console.error('[ScheduleService] Error checking active schedule in cache:', error.message);
    return null;
  }
}

/**
 * 📤 Proactive Outbound Scheduler (0 Database Read Queries on idle ticks):
 * Evaluates in-memory RAM cache for proactive schedules due right now.
 *
 * @param {object} socketInstance - Baileys WebSocket instance
 */
async function processPendingOutboundSchedules(socketInstance) {
  if (!socketInstance) return;

  try {
    if (!isCacheInitialized) {
      await refreshScheduleCache();
    }

    const now = new Date();
    const { currentHHmm, currentDayOfWeek, currentMonthDay, currentFullDate, currentYear } = getLocalTimeComponents(now);

    // Filter proactive schedules directly from RAM (ZERO DB reads)
    const proactiveSchedules = cachedActiveSchedules.filter(
      (s) => s.executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' && s.isActive
    );

    for (const schedule of proactiveSchedules) {
      let isDue = false;

      // 1. One-Off Specific DateTime (e.g. "2026-09-09T10:00")
      if (schedule.scheduledDateTime) {
        const dtStr = String(schedule.scheduledDateTime).trim();
        const [sDate, sTime] = dtStr.includes('T') ? dtStr.split('T') : dtStr.split(' ');
        const timeShort = (sTime || '').substring(0, 5);

        if (sDate === currentFullDate && timeShort === currentHHmm) {
          if (!schedule.isExecuted) {
            isDue = true;
          }
        }
      } else if (schedule.type === 'SPECIFIC_DATE' || schedule.specificDate) {
        // 2. Specific Date + StartTime (e.g. Birthday wish on 09-08 at 00:00)
        const sDate = (schedule.specificDate || '').trim();
        const sTime = (schedule.startTime || '00:00').substring(0, 5);
        const dateMatch = sDate === currentFullDate || sDate === currentMonthDay;

        if (dateMatch && sTime === currentHHmm) {
          if (schedule.repeatInterval === 'YEARLY') {
            const lastYear = schedule.lastExecutedAt ? getLocalTimeComponents(schedule.lastExecutedAt).currentYear : null;
            if (lastYear !== currentYear) isDue = true;
          } else if (!schedule.isExecuted) {
            isDue = true;
          }
        }
      } else if (schedule.type === 'RECURRING_DAILY') {
        // 3. Daily Recurring at exact startTime
        const sTime = (schedule.startTime || '10:00').substring(0, 5);
        if (sTime === currentHHmm) {
          const lastDate = schedule.lastExecutedAt ? getLocalTimeComponents(schedule.lastExecutedAt).currentFullDate : null;
          if (lastDate !== currentFullDate) isDue = true;
        }
      } else if (schedule.type === 'RECURRING_WEEKLY') {
        // 4. Weekly Recurring on specific days at startTime
        const sTime = (schedule.startTime || '10:00').substring(0, 5);
        const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [1, 2, 3, 4, 5];
        if (days.includes(currentDayOfWeek) && sTime === currentHHmm) {
          const lastDate = schedule.lastExecutedAt ? getLocalTimeComponents(schedule.lastExecutedAt).currentFullDate : null;
          if (lastDate !== currentFullDate) isDue = true;
        }
      }

      // If scheduled time arrived, execute outbound dispatch!
      if (isDue) {
        console.log(`\n======================================================`);
        console.log(`⏰ [Outbound Scheduler] PROACTIVE BROADCAST TRIGGERED: "${schedule.title}"`);
        console.log(`💬 Message: "${schedule.autoReplyText}"`);
        console.log(`======================================================`);

        // Resolve recipient numbers
        let recipientPhones = [];

        if (Array.isArray(schedule.targetPhoneNumbers) && schedule.targetPhoneNumbers.length > 0) {
          recipientPhones = schedule.targetPhoneNumbers;
        } else if (schedule.targetRelationship && schedule.targetRelationship !== 'ALL') {
          const matchedContacts = await WhitelistContact.find({
            relationship: new RegExp(schedule.targetRelationship, 'i'),
          });
          recipientPhones = matchedContacts.map((c) => c.phoneNumber);
        } else {
          const allContacts = await WhitelistContact.find();
          recipientPhones = allContacts.map((c) => c.phoneNumber);
        }

        // Clean & Deduplicate phone numbers
        const cleanRecipients = Array.from(
          new Set(
            recipientPhones
              .map((p) => String(p).replace(/\D/g, ''))
              .filter((digits) => digits.length >= 7)
          )
        );

        if (cleanRecipients.length === 0) {
          console.warn(`[Outbound Scheduler] ⚠️ No target phone numbers found for schedule "${schedule.title}".`);
        }

        for (const rawPhone of cleanRecipients) {
          const jid = `${rawPhone}@s.whatsapp.net`;
          const formattedPhone = `+${rawPhone}`;

          try {
            // Typing simulation presence
            await socketInstance.sendPresenceUpdate('composing', jid);
            await new Promise((r) => setTimeout(r, 1500));
            await socketInstance.sendPresenceUpdate('paused', jid);

            // Proactively send message via Baileys
            await socketInstance.sendMessage(jid, { text: schedule.autoReplyText });

            console.log(`[Outbound Scheduler] 🚀 Proactive message dispatched to ${formattedPhone}!`);

            // Save to MessageLog database
            await MessageLog.create({
              sender: formattedPhone,
              messageIn: `[Proactive Scheduled Broadcast: ${schedule.title}]`,
              messageOut: schedule.autoReplyText,
              status: 'PROCESSED',
              metaMessageId: `scheduled_${schedule._id}_${Date.now()}`,
            });
          } catch (sendErr) {
            console.error(`[Outbound Scheduler] Error dispatching to ${formattedPhone}:`, sendErr.message);
          }
        }

        // Mark schedule as executed and record timestamp
        schedule.isExecuted = schedule.repeatInterval === 'ONCE';
        schedule.lastExecutedAt = new Date();
        await schedule.save();
        console.log(`[Outbound Scheduler] ✅ Schedule "${schedule.title}" execution state updated.\n`);
      }
    }
  } catch (err) {
    console.error('[Outbound Scheduler] Error processing outbound schedules:', err.message);
  }
}

/**
 * Starts 30-second interval background ticker to monitor and dispatch outbound schedules
 * @param {Function} socketProvider - Callback returning active Baileys socket instance
 */
function startOutboundScheduler(socketProvider) {
  if (activeSchedulerInterval) {
    clearInterval(activeSchedulerInterval);
  }

  console.log('[Outbound Scheduler] ⏱️ Proactive Scheduled Messages engine started (polling every 30s).');

  activeSchedulerInterval = setInterval(async () => {
    try {
      const sock = typeof socketProvider === 'function' ? socketProvider() : socketProvider;
      if (sock) {
        await processPendingOutboundSchedules(sock);
      }
    } catch (e) {
      console.warn('[Outbound Scheduler] Ticker tick note:', e.message);
    }
  }, 30000); // 30 seconds
}

/**
 * Seed initial predefined schedules if none exist in the database
 */
async function seedDefaultSchedules() {
  try {
    const count = await ScheduleEvent.countDocuments();
    if (count > 0) return;

    console.log('[ScheduleService] 🌱 Seeding default predefined schedules (Gym Timings, Night Sleep, Birthday)...');

    const defaultEvents = [
      {
        title: 'Gym Workout Time',
        type: 'RECURRING_DAILY',
        startTime: '18:00',
        endTime: '20:00',
        daysOfWeek: [1, 2, 3, 4, 5, 6], // Monday to Saturday
        autoReplyText: 'Bhai abhi main Gym me workout kar raha hoon (6:00 PM - 8:00 PM). Free hoke aapse baat karta hoon!',
        isActive: true,
        targetRelationship: 'ALL',
        priority: 5,
        executionMode: 'AUTO_REPLY_ON_INCOMING',
      },
      {
        title: 'Night Sleep Mode',
        type: 'RECURRING_DAILY',
        startTime: '23:30',
        endTime: '07:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Every night
        autoReplyText: 'Abhi so raha hoon bhai! Subah uth kar reply karta hoon. Urgent ho toh call kar lena.',
        isActive: true,
        targetRelationship: 'ALL',
        priority: 1,
        executionMode: 'AUTO_REPLY_ON_INCOMING',
      },
      {
        title: 'Birthday Event',
        type: 'SPECIFIC_DATE',
        specificDate: '09-08',
        autoReplyText: 'Thank you so much birthday wishes ke liye! Boht khushi hui aapka message dekh kar ❤️ Thodi der me call karta hoon.',
        isActive: false,
        targetRelationship: 'ALL',
        priority: 10,
        executionMode: 'AUTO_REPLY_ON_INCOMING',
      },
    ];

    await ScheduleEvent.insertMany(defaultEvents);
    console.log('[ScheduleService] ✅ Default schedules seeded successfully.');
  } catch (err) {
    console.error('[ScheduleService] Error seeding default schedules:', err.message);
  }
}

module.exports = {
  checkActiveSchedule,
  isScheduleActive,
  getLocalTimeComponents,
  seedDefaultSchedules,
  processPendingOutboundSchedules,
  startOutboundScheduler,
  refreshScheduleCache,
};
