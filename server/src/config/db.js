const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_bot';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('MongoDB connected successfully.');
    
    // Reconcile indexes (e.g. migrate non-TTL createdAt_1 on messagelogs to TTL index cleanly)
    await reconcileIndexes();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.warn('Note: Ensure MongoDB service is running (e.g. localhost:27017). Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

const reconcileIndexes = async () => {
  try {
    const db = mongoose.connection.db;

    // =========================================================================
    // 1. Reconcile ChatSession TTL Index (MongoDB Atlas Free-Tier Storage Guard)
    // =========================================================================
    const chatSessionCols = await db.listCollections({ name: 'chatsessions' }).toArray();
    if (chatSessionCols.length > 0) {
      const sessionTtlDays = parseInt(process.env.CHAT_SESSION_TTL_DAYS, 10);
      const effectiveDays = (!isNaN(sessionTtlDays) && sessionTtlDays > 0 ? sessionTtlDays : 7);
      const expectedSessionTtlSeconds = effectiveDays * 24 * 60 * 60;

      const chatIndexes = await db.collection('chatsessions').indexes();
      const updatedAtIndex = chatIndexes.find((idx) => idx.name === 'updatedAt_1');

      if (updatedAtIndex) {
        const currentSeconds = updatedAtIndex.expireAfterSeconds;
        if (currentSeconds !== expectedSessionTtlSeconds) {
          console.log(`🔄 Reconciling chatsessions TTL index on MongoDB Atlas: updating from ${currentSeconds}s to ${expectedSessionTtlSeconds}s (${effectiveDays} days)...`);
          await db.collection('chatsessions').dropIndex('updatedAt_1');
          await db.collection('chatsessions').createIndex(
            { updatedAt: 1 },
            { expireAfterSeconds: expectedSessionTtlSeconds, background: true }
          );
          console.log(`✅ chatsessions TTL index active on MongoDB Atlas: expiring after ${effectiveDays} days.`);
        } else {
          console.log(`✅ chatsessions TTL index verified on MongoDB Atlas (${effectiveDays} days / ${expectedSessionTtlSeconds}s).`);
        }
      } else {
        console.log(`🔄 Creating chatsessions TTL index on MongoDB Atlas: expiring after ${effectiveDays} days (${expectedSessionTtlSeconds}s)...`);
        await db.collection('chatsessions').createIndex(
          { updatedAt: 1 },
          { expireAfterSeconds: expectedSessionTtlSeconds, background: true }
        );
        console.log(`✅ chatsessions TTL index created on MongoDB Atlas.`);
      }
    }

    // =========================================================================
    // 2. Reconcile MessageLog TTL Index
    // =========================================================================
    const logCols = await db.listCollections({ name: 'messagelogs' }).toArray();
    if (logCols.length > 0) {
      const logIndexes = await db.collection('messagelogs').indexes();
      const createdAtIndex = logIndexes.find((idx) => idx.name === 'createdAt_1');
      const logTtlDays = parseInt(process.env.MESSAGE_LOG_TTL_DAYS, 10);
      const shouldHaveTtl = logTtlDays !== 0;
      const effectiveLogDays = (!isNaN(logTtlDays) && logTtlDays > 0 ? logTtlDays : 30);
      const expectedLogTtlSeconds = effectiveLogDays * 24 * 60 * 60;

      if (createdAtIndex) {
        const hasTtl = typeof createdAtIndex.expireAfterSeconds === 'number';
        const currentSeconds = createdAtIndex.expireAfterSeconds;

        if (shouldHaveTtl && (!hasTtl || currentSeconds !== expectedLogTtlSeconds)) {
          console.log(`🔄 Reconciling messagelogs TTL index on MongoDB Atlas: setting to ${expectedLogTtlSeconds}s (${effectiveLogDays} days)...`);
          await db.collection('messagelogs').dropIndex('createdAt_1');
          await db.collection('messagelogs').createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: expectedLogTtlSeconds, background: true }
          );
          console.log(`✅ messagelogs TTL index active on MongoDB Atlas.`);
        } else if (!shouldHaveTtl && hasTtl) {
          console.log('🔄 Reconciling messagelogs index: removing TTL from createdAt_1...');
          await db.collection('messagelogs').dropIndex('createdAt_1');
          await db.collection('messagelogs').createIndex({ createdAt: 1 }, { background: true });
        }
      } else if (shouldHaveTtl) {
        await db.collection('messagelogs').createIndex(
          { createdAt: 1 },
          { expireAfterSeconds: expectedLogTtlSeconds, background: true }
        );
      }
    }
  } catch (err) {
    console.warn('⚠️ Index reconciliation note:', err.message);
  }
};

module.exports = connectDB;
module.exports.reconcileIndexes = reconcileIndexes;
