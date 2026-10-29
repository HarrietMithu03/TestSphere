const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { connectDB, closeDB } = require('./config/db');
const { initSocketServer } = require('./socket');

const server = http.createServer(app);

// Initialize Socket.IO with HTTP server
initSocketServer(server);

// Start Server after connecting to MongoDB
const startServer = async () => {
  console.log(`[TestSphere] Starting server in ${config.nodeEnv} mode...`);

  // Connect to MongoDB
  await connectDB();

  // Reset any orphaned active scans from previous server process
  try {
    const ScanJob = require('./models/ScanJob');
    const orphaned = await ScanJob.updateMany(
      { status: { $in: ['QUEUED', 'RUNNING'] } },
      {
        status: 'CANCELLED',
        currentStage: 'CANCELLED',
        errorSummary: 'Scan terminated due to server restart.',
        endTime: new Date()
      }
    );
    if (orphaned.modifiedCount > 0) {
      console.log(`[TestSphere] Cleaned up ${orphaned.modifiedCount} orphaned scan(s) from prior session.`);
    }
  } catch (cleanErr) {
    console.warn('[TestSphere] Warning cleaning up orphaned scans:', cleanErr.message);
  }

  server.listen(config.port, () => {
    console.log(`[TestSphere Server] Running on http://localhost:${config.port}`);
    console.log(`[TestSphere Server] Health Check: http://localhost:${config.port}/api/health`);
    console.log(`[TestSphere Server] Accepting requests from: ${config.clientOrigin}`);
  });
};

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n[TestSphere] Received ${signal}. Commencing graceful shutdown...`);
  server.close(async () => {
    console.log('[TestSphere Server] HTTP & WebSocket server closed.');
    await closeDB();
    console.log('[TestSphere] Shutdown complete.');
    process.exit(0);
  });

  // Force shutdown after timeout if hanging
  setTimeout(() => {
    console.error('[TestSphere] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
