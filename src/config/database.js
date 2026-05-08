const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Global cache for serverless environments (Vercel)
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    // 1. If connection exists, return it
    if (cached.conn) {
        logger.info('♻️ Using cached MongoDB connection');
        return cached.conn;
    }

    // 2. Clear old state if needed
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
        logger.error('❌ MONGO_URI is missing');
        throw new Error('MONGO_URI is missing');
    }

    // 3. Create a new connection promise if none exists
    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
            heartbeatFrequencyMS: 10000,
        };

        logger.info('🔌 Connecting to new MongoDB instance...');
        cached.promise = mongoose.connect(mongoURI, opts).then((mongoose) => {
            logger.info('✅ MongoDB connected successfully');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null; // Clear promise on failure to allow retry
        logger.error('❌ MongoDB connection failed:', e.message);
        throw e;
    }

    return cached.conn;
};

module.exports = connectDB;
