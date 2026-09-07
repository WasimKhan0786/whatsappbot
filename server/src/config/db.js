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
    const collections = await db.listCollections({ name: 'messagelogs' }).toArray();
    if (collections.length > 0) {
      const indexes = await db.collection('messagelogs').indexes();
      const createdAtIndex = indexes.find((idx) => idx.name === 'createdAt_1');
      const logTtlDays = parseInt(process.env.MESSAGE_LOG_TTL_DAYS, 10);
      const shouldHaveTtl = logTtlDays !== 0;

      if (createdAtIndex) {
        const hasTtl = typeof createdAtIndex.expireAfterSeconds === 'number';
        if (shouldHaveTtl && !hasTtl) {
          console.log('🔄 Reconciling messagelogs index: migrating createdAt_1 to TTL index...');
          await db.collection('messagelogs').dropIndex('createdAt_1');
        } else if (!shouldHaveTtl && hasTtl) {
          console.log('🔄 Reconciling messagelogs index: removing TTL from createdAt_1...');
          await db.collection('messagelogs').dropIndex('createdAt_1');
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Index reconciliation note:', err.message);
  }
};

module.exports = connectDB;
