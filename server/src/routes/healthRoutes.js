const express = require('express');
const { getDbStatus } = require('../config/db');
const config = require('../config/env');

const router = express.Router();

// Full health inspection endpoint
router.get('/', (req, res) => {
  const dbStatus = getDbStatus();
  const isFullyHealthy = dbStatus.isHealthy;

  const response = {
    success: true,
    status: isFullyHealthy ? 'healthy' : 'degraded',
    service: 'TestSphere API & Real-Time Gateway',
    version: '1.0.0 (Phase 1)',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    components: {
      database: dbStatus,
      realtime: {
        status: 'active',
        transport: ['websocket', 'polling']
      }
    }
  };

  const statusCode = isFullyHealthy ? 200 : 503;
  return res.status(statusCode).json(response);
});

// Minimal ping endpoint
router.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// Mobile Android Diagnostic Environment Status
const { getAndroidSupportStatus } = require('../scanner/android/androidDiagnostics');
router.get('/android', (req, res) => {
  const status = getAndroidSupportStatus();
  return res.status(200).json({
    success: true,
    ...status
  });
});

module.exports = router;
