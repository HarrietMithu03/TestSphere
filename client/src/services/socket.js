import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Send a verification ping over Socket.IO and measure round-trip time
 */
export function pingSocket() {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    if (!s.connected) {
      return reject(new Error('Socket is not connected yet'));
    }

    const start = performance.now();
    s.emit('system:ping', { clientTimestamp: Date.now() }, (response) => {
      const latency = Math.round(performance.now() - start);
      resolve({
        latency,
        response
      });
    });

    // Fallback timeout
    setTimeout(() => {
      reject(new Error('Socket ping timed out'));
    }, 4000);
  });
}

/**
 * Authenticated subscription to real-time events for a specific scan
 */
export function subscribeToScan(scanId, token, callback) {
  const s = getSocket();
  if (s.connected) {
    s.emit('scan:subscribe', { scanId, token }, (res) => {
      if (typeof callback === 'function') callback(res);
    });
  } else {
    s.once('connect', () => {
      s.emit('scan:subscribe', { scanId, token }, (res) => {
        if (typeof callback === 'function') callback(res);
      });
    });
  }
}

/**
 * Unsubscribe from real-time events for a scan
 */
export function unsubscribeFromScan(scanId) {
  const s = getSocket();
  if (s) {
    s.emit('scan:unsubscribe', { scanId });
  }
}

export { SOCKET_URL };
