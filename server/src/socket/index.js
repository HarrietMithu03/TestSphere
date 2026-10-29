const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ScanJob = require('../models/ScanJob');
const User = require('../models/User');

let io = null;

const initSocketServer = (httpServer) => {
  const allowedOrigins = [
    config.clientOrigin,
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ].filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingInterval: 25000,
    pingTimeout: 20000
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Welcome handshake with system timestamp
    socket.emit('system:connected', {
      message: 'Connected to TestSphere Real-Time Gateway',
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Verification event for testing real-time round-trip
    socket.on('system:ping', (data, callback) => {
      const response = {
        message: 'pong',
        received: data,
        serverTimestamp: new Date().toISOString()
      };
      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('system:pong', response);
      }
    });

    /**
     * Authenticated and target-authorized subscription to a scan room.
     * Prevents cross-tenant / unauthorized users from snooping on scan events.
     */
    socket.on('scan:subscribe', async (data, callback) => {
      try {
        const { scanId, token } = data || {};
        if (!scanId || !token) {
          const errRes = { success: false, message: 'Authentication token and scanId are required.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        // Verify JWT token
        let decoded;
        try {
          decoded = jwt.verify(token, config.jwtSecret);
        } catch {
          const errRes = { success: false, message: 'Invalid or expired session token.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const user = await User.findById(decoded.id);
        if (!user) {
          const errRes = { success: false, message: 'User not found.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const scan = await ScanJob.findById(scanId).populate('targetId');
        if (!scan) {
          const errRes = { success: false, message: 'Scan job not found.' };
          if (typeof callback === 'function') callback(errRes);
          return;
        }

        const target = scan.targetId;
        if (target) {
          const isOwner = target.owner?.toString() === user._id.toString();
          const isAssignedTester = target.assignedTesters?.some(
            (tid) => tid.toString() === user._id.toString()
          );

          if (!isOwner && !isAssignedTester) {
            const errRes = { success: false, message: 'Forbidden: You are not authorized to subscribe to this scan.' };
            if (typeof callback === 'function') callback(errRes);
            return;
          }
        }

        // Join authorized scan room
        const roomName = `scan:${scanId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] User ${user.email} (${user.role}) joined room ${roomName}`);

        const okRes = { success: true, scanId, room: roomName };
        if (typeof callback === 'function') callback(okRes);
      } catch (err) {
        console.error('[Socket.IO] Error in scan:subscribe:', err);
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Internal error processing scan subscription.' });
        }
      }
    });

    /**
     * Unsubscribe from a scan room
     */
    socket.on('scan:unsubscribe', (data, callback) => {
      const { scanId } = data || {};
      if (scanId) {
        socket.leave(`scan:${scanId}`);
      }
      if (typeof callback === 'function') {
        callback({ success: true, scanId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  console.log('[Socket.IO] Real-Time Gateway initialized');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized yet.');
  }
  return io;
};

module.exports = {
  initSocketServer,
  getIO
};
