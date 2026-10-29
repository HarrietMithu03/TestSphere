import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{
      textAlign: 'center',
      padding: 'var(--space-12) var(--space-4)',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'var(--slate-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto var(--space-4) auto',
        color: 'var(--slate-600)'
      }}>
        <HelpCircle size={32} />
      </div>
      <h2>Page Not Found</h2>
      <p style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="ts-btn ts-btn-primary">
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>
    </div>
  );
}
