import mongoose from 'mongoose';
import { publishToCentrifugo } from './centrifugo';

const MONGODB_URI = process.env.DATABASE_URL;

if (!MONGODB_URI) {
  throw new Error('Please define the DATABASE_URL environment variable inside .env');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then(async (mongoose) => {
      console.log('✅ MongoDB is connected successfully');

      const { syncDeliveryOrderIndexes } = await import('./syncDeliveryOrderIndexes');
      syncDeliveryOrderIndexes().catch((err) => {
        console.warn('[DeliveryOrder] Index sync failed:', err.message);
      });

      const { syncChatThreadIndexes } = await import('./syncChatThreadIndexes');
      syncChatThreadIndexes().catch((err) => {
        console.warn('[CompanyChatThread] Index sync failed:', err.message);
      });

      const { seedChatQaIfEmpty } = await import('./seedChatQa');
      seedChatQaIfEmpty().catch((err) => {
        console.warn('[ChatQa] Seed failed:', err.message);
      });
      
      // Register global plugin to publish to Centrifugo on any mutation
      mongoose.plugin((schema) => {
        const publishUpdate = function() {
          console.log('[Mongoose Plugin] Detected DB Mutation. Publishing to Centrifugo...');
          // Fire and forget global refresh trigger — use target:'all' so frontend filter accepts it
          publishToCentrifugo('global_updates', { type: 'db_change', target: 'all' }).catch(console.error);
        };
        
        schema.post('save', publishUpdate);
        schema.post('findOneAndUpdate', publishUpdate);
        schema.post('updateOne', publishUpdate);
        schema.post('deleteOne', publishUpdate);
        schema.post('deleteMany', publishUpdate);
      });

      return mongoose;
    }).catch(err => {
      console.error('❌ Failed to connect to MongoDB:', err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export { connectToDatabase as db };

// Initiate connection immediately when this file is imported (e.g., when the server starts or first route is hit)
connectToDatabase().catch((err) => {
  // Error is already logged inside connectToDatabase
});
