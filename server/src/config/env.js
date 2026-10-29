const dotenv = require('dotenv');
const path = require('path');

// Explicitly load .env from the server folder
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/testsphere',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev_testsphere_secret_placeholder_only_phase1',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  allowLocalFixtures: process.env.ALLOW_LOCAL_FIXTURES === 'true'
};

module.exports = config;
