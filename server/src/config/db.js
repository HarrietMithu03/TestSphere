const mongoose = require('mongoose');
const config = require('./env');

const stateMap = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    console.log(`[Database] MongoDB connected successfully: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    // Do not terminate immediately in development so health check can report the DB state clearly
    return null;
  }
};

mongoose.connection.on('connected', () => {
  console.log('[Database] MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database Error] Runtime MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[Database Warning] MongoDB connection lost / disconnected');
});

const getDbStatus = () => {
  const readyState = mongoose.connection.readyState;
  return {
    status: stateMap[readyState] || 'unknown',
    isHealthy: readyState === 1
  };
};

const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed gracefully');
  }
};

module.exports = {
  connectDB,
  getDbStatus,
  closeDB
};
