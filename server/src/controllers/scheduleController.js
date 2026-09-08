const ScheduleEvent = require('../models/ScheduleEvent');
const { checkActiveSchedule, isScheduleActive, getLocalTimeComponents } = require('../services/scheduleService');

/**
 * GET /api/schedules
 * Fetch all stored schedules with real-time active status
 */
const getSchedules = async (req, res) => {
  try {
    const schedules = await ScheduleEvent.find().sort({ priority: -1, createdAt: -1 });
    const now = new Date();
    const timeInfo = getLocalTimeComponents(now);

    const data = schedules.map((s) => {
      const activeNow = isScheduleActive(s, now);
      return {
        ...s.toObject(),
        isCurrentlyActive: activeNow,
      };
    });

    res.json({
      success: true,
      currentTime: timeInfo.currentHHmm,
      currentDay: timeInfo.currentDayOfWeek,
      currentDate: timeInfo.currentFullDate,
      data,
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
};

/**
 * POST /api/schedules
 * Create a new predefined schedule event
 */
const createSchedule = async (req, res) => {
  try {
    const {
      title,
      type,
      startTime,
      endTime,
      daysOfWeek,
      specificDate,
      autoReplyText,
      isActive,
      targetRelationship,
      targetPhoneNumbers,
      priority,
      executionMode,
      scheduledDateTime,
      repeatInterval,
    } = req.body;

    if (!title || !autoReplyText) {
      return res.status(400).json({
        success: false,
        error: 'Title and autoReplyText are required',
      });
    }

    const parsedNumbers = Array.isArray(targetPhoneNumbers)
      ? targetPhoneNumbers
      : typeof targetPhoneNumbers === 'string'
      ? targetPhoneNumbers.split(/[,;\s]+/).map((n) => n.trim()).filter(Boolean)
      : [];

    const schedule = await ScheduleEvent.create({
      title: title.trim(),
      type: type || 'RECURRING_DAILY',
      startTime: startTime || '18:00',
      endTime: endTime || '20:00',
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
      specificDate: specificDate ? specificDate.trim() : null,
      autoReplyText: autoReplyText.trim(),
      isActive: typeof isActive === 'boolean' ? isActive : true,
      targetRelationship: targetRelationship || 'ALL',
      targetPhoneNumbers: parsedNumbers,
      priority: typeof priority === 'number' ? priority : 1,
      executionMode: executionMode || 'AUTO_REPLY_ON_INCOMING',
      scheduledDateTime: scheduledDateTime || null,
      repeatInterval: repeatInterval || 'ONCE',
      isExecuted: false,
    });

    res.status(201).json({
      success: true,
      message: 'Schedule event created successfully',
      data: schedule,
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/schedules/:id
 * Update an existing schedule event
 */
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const schedule = await ScheduleEvent.findByIdAndUpdate(id, updates, { new: true });
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule event not found' });
    }

    res.json({
      success: true,
      message: 'Schedule event updated successfully',
      data: schedule,
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE /api/schedules/:id
 * Delete a schedule event
 */
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await ScheduleEvent.findByIdAndDelete(id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule event not found' });
    }

    res.json({
      success: true,
      message: 'Schedule event deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/schedules/check
 * Test endpoint to check if an active schedule matches right now
 */
const checkActiveScheduleEndpoint = async (req, res) => {
  try {
    const { relationship } = req.query;
    const now = new Date();
    const timeInfo = getLocalTimeComponents(now);
    const matchedSchedule = await checkActiveSchedule(now, relationship);

    res.json({
      success: true,
      currentTime: timeInfo.currentHHmm,
      currentDate: timeInfo.currentFullDate,
      hasActiveSchedule: Boolean(matchedSchedule),
      matchedSchedule: matchedSchedule || null,
    });
  } catch (error) {
    console.error('Error checking active schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  checkActiveScheduleEndpoint,
};
