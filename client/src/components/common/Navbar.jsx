import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Layers, LogOut, User as UserIcon, Globe, Activity, FileText } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ isSocketConnected, isApiHealthy }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <div className="flex items-center gap-6">
            <Link to="/" className="brand-link">
              <div className="brand-icon-wrapper">
                <Layers size={22} />
              </div>
              <div className="flex items-center gap-2">
                <span className="brand-title">TestSphere</span>
                <span className="brand-badge">Diagnostics</span>
              </div>
            </Link>

            {/* Navigation Links for Authenticated Users */}
            {isAuthenticated && (
              <div className="flex items-center gap-2" style={{ marginLeft: 'var(--space-2)' }}>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `ts-btn ${isActive ? 'ts-btn-outline' : ''}`
                  }
                  style={({ isActive }) => ({
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    height: '34px',
                    backgroundColor: isActive ? 'var(--slate-100)' : 'transparent',
                    borderColor: isActive ? 'var(--slate-300)' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 500
                  })}
                >
                  <Activity size={15} />
                  <span>Overview</span>
                </NavLink>

                <NavLink
                  id="nav-targets-link"
                  to="/targets"
                  className={({ isActive }) =>
                    `ts-btn ${isActive ? 'ts-btn-outline' : ''}`
                  }
                  style={({ isActive }) => ({
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    height: '34px',
                    backgroundColor: isActive ? 'var(--slate-100)' : 'transparent',
                    borderColor: isActive ? 'var(--slate-300)' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 500
                  })}
                >
                  <Globe size={15} />
                  <span>Applications</span>
                </NavLink>

                <NavLink
                  id="nav-scans-link"
                  to="/scans"
                  className={({ isActive }) =>
                    `ts-btn ${isActive ? 'ts-btn-outline' : ''}`
                  }
                  style={({ isActive }) => ({
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    height: '34px',
                    backgroundColor: isActive ? 'var(--slate-100)' : 'transparent',
                    borderColor: isActive ? 'var(--slate-300)' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 500
                  })}
                >
                  <Layers size={15} />
                  <span>Scans</span>
                </NavLink>

                <NavLink
                  id="nav-reports-link"
                  to="/reports"
                  className={({ isActive }) =>
                    `ts-btn ${isActive ? 'ts-btn-outline' : ''}`
                  }
                  style={({ isActive }) => ({
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    height: '34px',
                    backgroundColor: isActive ? 'var(--slate-100)' : 'transparent',
                    borderColor: isActive ? 'var(--slate-300)' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 500
                  })}
                >
                  <FileText size={15} />
                  <span>Reports</span>
                </NavLink>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* System Readiness Badges */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-xs">API:</span>
                <StatusBadge
                  status={isApiHealthy ? 'healthy' : 'disconnected'}
                  label={isApiHealthy ? 'Online' : 'Offline'}
                />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-xs">Gateway:</span>
                <StatusBadge
                  status={isSocketConnected ? 'connected' : 'connecting'}
                  label={isSocketConnected ? 'Connected' : 'Connecting'}
                />
              </div>
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)', margin: '0 4px' }} />

            {/* User Session State */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 10px 4px 6px',
                  backgroundColor: 'var(--slate-100)',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--slate-200)',
                  fontSize: '0.85rem'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: user?.role === 'developer' ? 'var(--indigo-600)' : 'var(--emerald-600)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={14} />}
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {user?.name}
                  </span>
                  <span className={`ts-badge ${user?.role === 'developer' ? 'badge-indigo' : 'badge-success'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                    {user?.role === 'developer' ? 'Developer' : 'Tester'}
                  </span>
                </div>

                <button
                  id="nav-logout-btn"
                  onClick={handleLogout}
                  className="ts-btn ts-btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', height: '34px' }}
                  title="Sign out of your account"
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  id="nav-login-btn"
                  to="/login"
                  className="ts-btn ts-btn-outline"
                  style={{ padding: '6px 14px', fontSize: '0.85rem', height: '36px' }}
                >
                  Sign In
                </Link>
                <Link
                  id="nav-register-btn"
                  to="/register"
                  className="ts-btn ts-btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.85rem', height: '36px' }}
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
