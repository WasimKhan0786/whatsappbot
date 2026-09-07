const ScheduleEvent = require('../models/ScheduleEvent');

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
 * @returns {{ currentHHmm: string, currentDayOfWeek: number, currentMonthDay: string, currentFullDate: string }}
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
  };
}

/**
 * Checks if a specific schedule event is active at a given date/time
 * @param {object} schedule
 * @param {Date} date
 * @param {string} relationship
 * @returns {boolean}
 */
function isScheduleActive(schedule, date = new Date(), relationship = null, senderPhone = null) {
  if (!schedule || !schedule.isActive) return false;

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
 * Queries the database and returns the highest priority active schedule event matching the current time
 * @param {Date} targetDate
 * @param {string} relationship - Optional relationship role of sender (e.g. 'Brother', 'Bhabhi')
 * @param {string} senderPhone - Optional phone number of sender
 * @returns {Promise<object|null>} - Returns the matched schedule event, or null if no schedule is active
 */
async function checkActiveSchedule(targetDate = new Date(), relationship = null, senderPhone = null) {
  try {
    const schedules = await ScheduleEvent.find({ isActive: true }).sort({ priority: -1, createdAt: -1 });

    for (const schedule of schedules) {
      if (isScheduleActive(schedule, targetDate, relationship, senderPhone)) {
        return schedule;
      }
    }
    return null;
  } catch (error) {
    console.error('[ScheduleService] Error checking active schedule:', error.message);
    return null;
  }
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
      },
      {
        title: 'Birthday Event',
        type: 'SPECIFIC_DATE',
        specificDate: '09-07', // MM-DD format (today's date default example)
        autoReplyText: 'Thank you so much birthday wishes ke liye! Boht khushi hui aapka message dekh kar ❤️ Thodi der me call karta hoon.',
        isActive: false, // Inactive by default so user can activate when needed
        targetRelationship: 'ALL',
        priority: 10,
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
};
