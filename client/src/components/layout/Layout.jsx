import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../common/Navbar';
import { getSocket } from '../../services/socket';
import { getHealthStatus } from '../../services/api';

export default function Layout() {
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isApiHealthy, setIsApiHealthy] = useState(false);

  useEffect(() => {
    // Initial health check
    const checkApi = async () => {
      const res = await getHealthStatus();
      setIsApiHealthy(res.ok && res.data?.status === 'healthy');
    };
    checkApi();
    const apiInterval = setInterval(checkApi, 10000);

    // Socket connection
    const socket = getSocket();
    setIsSocketConnected(socket.connected);

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      clearInterval(apiInterval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <div className="app-layout">
      <Navbar isSocketConnected={isSocketConnected} isApiHealthy={isApiHealthy} />
      <main className="main-content">
        <div className="container">
          <Outlet context={{ isSocketConnected, isApiHealthy }} />
        </div>
      </main>
      <footer style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        padding: 'var(--space-6) 0',
        marginTop: 'auto'
      }}>
        <div className="container flex items-center justify-between text-xs text-muted">
          <div>
            <span>TestSphere Platform &copy; {new Date().getFullYear()} &bull; Real-Time QA & Bug Intelligence</span>
          </div>
          <div>
            <span>Architecture: Node.js &bull; Express &bull; MongoDB &bull; Socket.IO &bull; React + Vite</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
