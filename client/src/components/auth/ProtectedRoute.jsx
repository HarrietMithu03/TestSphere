import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 'var(--space-3)'
      }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        <span className="text-sm text-muted">Authenticating session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div style={{
        maxWidth: '540px',
        margin: 'var(--space-12) auto',
        padding: 'var(--space-8)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center'
      }}>
        <h3>Access Restricted</h3>
        <p style={{ marginTop: 'var(--space-2)' }}>
          This workspace is reserved for users with role: <strong>{allowedRoles.join(' or ')}</strong>.
          Your current account role is <strong>{user?.role}</strong>.
        </p>
      </div>
    );
  }

  return children;
}
