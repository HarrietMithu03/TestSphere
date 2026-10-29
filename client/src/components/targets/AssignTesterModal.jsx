import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { assignTesterToTarget } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AssignTesterModal({ target, isOpen, onClose, onTesterAssigned }) {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Tester email address is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const res = await assignTesterToTarget(target._id || target.id, email.trim(), token);
    if (res.ok && res.data?.target) {
      onTesterAssigned(res.data.target);
      setEmail('');
      onClose();
    } else {
      setError(res.error || 'Failed to assign tester.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: 'var(--space-4)'
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
        width: '100%',
        maxWidth: '460px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div className="flex items-center gap-2">
            <UserPlus size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Assign Tester</h3>
          </div>
          <button
            onClick={onClose}
            className="ts-btn ts-btn-outline"
            style={{ padding: '4px', borderRadius: '50%', width: '28px', height: '28px' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-6)' }}>
          <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
            Grant a registered QA tester access to view diagnostic reports and validate findings for{' '}
            <strong>{target.name}</strong>.
          </p>

          {error && (
            <div className="alert-banner error" style={{ marginBottom: 'var(--space-4)' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span className="text-xs">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="assign-email" className="ts-label">
                <span>Tester Email Address</span>
              </label>
              <input
                id="assign-email"
                type="email"
                placeholder="tester@testsphere.io"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                disabled={isSubmitting}
                className="ts-input"
              />
              <span className="text-xs text-muted" style={{ marginTop: '4px' }}>
                The user must have registered with role: <strong>Tester</strong>.
              </span>
            </div>

            <div className="flex justify-between items-center" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              <button
                type="button"
                onClick={onClose}
                className="ts-btn ts-btn-outline"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                id="submit-assign-tester-btn"
                type="submit"
                disabled={isSubmitting}
                className="ts-btn ts-btn-primary"
                style={{ flex: 1.5 }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Assign to Target</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
