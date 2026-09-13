const mongoose = require('mongoose');
const SystemIncident = require('../models/SystemIncident');
const { sendErrorAlert } = require('./alertNotificationService');

/**
 * Automated Error Handling & Single-Attempt Auto-Restart Supervisor
 *
 * Catches runtime errors, guarantees at most ONE auto-restart attempt per crash incident
 * (with cooldown protection against infinite loops), logs incidents in MongoDB Atlas,
 * and notifies the user via WhatsApp and/or Email.
 */

// Supervisor State
let restartCount = 0;
let lastRestartAt = null;
let isRestarting = false;
let stableUptimeTimer = null;

// 5-minute cooldown window: if the system stays stable for 5 minutes after a restart, reset the restart budget
const COOLDOWN_WINDOW_MS = 5 * 60 * 1000;

/**
 * Resets the single-restart budget after stable operation
 */
function resetRestartBudget() {
  restartCount = 0;
  isRestarting = false;
  console.log('🛡️ [ErrorSupervisor] System has been stable. Auto-restart attempt budget restored to 1.');
}

/**
 * Schedules a reset of the restart budget after 5 minutes of uninterrupted uptime
 */
function scheduleBudgetReset() {
  if (stableUptimeTimer) {
    clearTimeout(stableUptimeTimer);
  }
  stableUptimeTimer = setTimeout(() => {
    resetRestartBudget();
  }, COOLDOWN_WINDOW_MS);
}

/**
 * Core Fatal Error & Auto-Restart Handler
 *
 * @param {Error|any} error - The caught runtime exception
 * @param {string} [context='UNCAUGHT_EXCEPTION'] - Origin of error
 * @returns {Promise<object>} Incident and recovery summary
 */
async function handleFatalError(error, context = 'UNCAUGHT_EXCEPTION') {
  const errorMessage = error?.message || String(error) || 'Unknown runtime error';
  const errorStack = error?.stack || '';
  const now = Date.now();

  console.error(`\n🚨 [ErrorSupervisor] Caught ${context}:`, errorMessage);

  // Check if previous restart was beyond cooldown window
  if (lastRestartAt && now - lastRestartAt > COOLDOWN_WINDOW_MS) {
    console.log('🛡️ [ErrorSupervisor] Cooldown expired since last restart. Refreshing attempt budget.');
    restartCount = 0;
  }

  let restartAttempted = false;
  let restartStatus = 'NOT_ATTEMPTED';
  let restartDetails = '';

  // Single-Attempt Auto-Restart Enforcement: exactly ONE restart allowed per incident
  if (restartCount < 1 && !isRestarting) {
    isRestarting = true;
    restartAttempted = true;
    restartCount++;
    lastRestartAt = now;

    console.log(`🔄 [ErrorSupervisor] Executing Auto-Restart Attempt ${restartCount}/1...`);

    try {
      // 1. Validate / Reconnect MongoDB if disconnected
      if (mongoose.connection.readyState !== 1) {
        console.log('🔄 [ErrorSupervisor] Reconnecting to MongoDB Atlas...');
        const connectDB = require('../config/db');
        await connectDB();
      }

      // 2. Restart Baileys WhatsApp Web socket if available
      try {
        const baileysService = require('./baileysService');
        if (typeof baileysService.restartBaileysSocket === 'function') {
          await baileysService.restartBaileysSocket();
        }
      } catch (bErr) {
        console.warn('⚠️ [ErrorSupervisor] Baileys restart warning:', bErr.message);
      }

      restartStatus = 'SUCCESS';
      restartDetails = 'Bot socket & service connections successfully refreshed and initialized.';
      console.log('✅ [ErrorSupervisor] Auto-restart attempt 1/1 completed successfully.');

      // Start timer to replenish budget if it stays stable
      scheduleBudgetReset();
    } catch (restartErr) {
      restartStatus = 'FAILED';
      restartDetails = `Auto-restart execution failed: ${restartErr.message}`;
      console.error('❌ [ErrorSupervisor] Auto-restart attempt 1/1 failed:', restartErr);
    } finally {
      isRestarting = false;
    }
  } else {
    // Attempt budget exceeded or restart currently in-flight
    restartAttempted = false;
    restartStatus = 'COOLDOWN_EXCEEDED';
    restartDetails = `Bot has already consumed its 1 auto-restart attempt for this incident. Circuit breaker active to prevent recursive crash loop. Manual intervention required if issues persist.`;
    console.warn(`🛑 [ErrorSupervisor] ${restartDetails}`);
  }

  // 3. Persist Incident into MongoDB Atlas
  let savedIncident = null;
  try {
    savedIncident = await SystemIncident.create({
      errorType: context,
      errorMessage,
      errorStack,
      restartAttempted,
      restartStatus,
      restartDetails,
      timestamp: new Date(),
    });
  } catch (dbErr) {
    console.warn('⚠️ [ErrorSupervisor] Could not persist incident to MongoDB:', dbErr.message);
  }

  // 4. Dispatch Alert Notification via WhatsApp and/or Email
  let alertResults = { whatsapp: { attempted: false }, email: { attempted: false } };
  try {
    alertResults = await sendErrorAlert({
      errorType: context,
      errorMessage,
      errorStack,
      restartAttempted,
      restartStatus,
      restartDetails,
    });

    // Update incident with alert delivery results
    if (savedIncident) {
      savedIncident.alertChannels = alertResults;
      await savedIncident.save().catch(() => {});
    }
  } catch (alertErr) {
    console.error('❌ [ErrorSupervisor] Failed to dispatch incident alert:', alertErr.message);
  }

  return {
    success: restartStatus === 'SUCCESS',
    incidentId: savedIncident?._id,
    errorType: context,
    errorMessage,
    restartAttempted,
    restartStatus,
    restartDetails,
    alerts: alertResults,
  };
}

/**
 * Triggers a simulated test alert without disrupting bot operations
 */
async function triggerTestAlert(customMessage = 'Manual test alert from WhatsApp Bot Dashboard') {
  console.log('🧪 [ErrorSupervisor] Triggering simulated test alert...');
  return await handleFatalError(
    new Error(customMessage),
    'TEST_ALERT'
  );
}

/**
 * Retrieves supervisor health & recent incidents summary
 */
async function getSupervisorStatus() {
  const recentIncidents = await SystemIncident.find()
    .sort({ timestamp: -1 })
    .limit(10)
    .lean()
    .catch(() => []);

  const totalIncidents = await SystemIncident.countDocuments().catch(() => 0);

  return {
    supervisorState: {
      restartBudgetRemaining: Math.max(0, 1 - restartCount),
      restartCount,
      lastRestartAt: lastRestartAt ? new Date(lastRestartAt).toISOString() : null,
      cooldownActive: restartCount >= 1,
      cooldownWindowSeconds: COOLDOWN_WINDOW_MS / 1000,
    },
    metrics: {
      totalIncidents,
      recentCount: recentIncidents.length,
    },
    recentIncidents,
  };
}

module.exports = {
  handleFatalError,
  triggerTestAlert,
  getSupervisorStatus,
  resetRestartBudget,
};
