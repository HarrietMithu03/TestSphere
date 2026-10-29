import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  X,
  Shield,
  Globe,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  Clock,
  Gauge
} from 'lucide-react';
import { createScan } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function LaunchScanModal({ target, isOpen, onClose }) {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !target) return null;

  const targetId = target._id || target.id;
  const scope = target.authorizedScope || {};
  const policy = target.scanPolicy || {};

  const handleStartScan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await createScan(targetId, token);
    setLoading(false);

    if (res.ok && res.data?.scan) {
      const scanId = res.data.scan._id || res.data.scan.id;
      onClose();
      navigate(`/scans/${scanId}`);
    } else {
      setError(res.error || 'Failed to initiate diagnostic scan.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--indigo-50)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Play size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Launch Automated Diagnostic Scan</h3>
              <span className="text-xs text-muted">Phase 3 Playwright Automation Engine</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ts-btn ts-btn-outline"
            style={{ padding: '6px', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body flex flex-col gap-4">
          {error && (
            <div className="alert-banner error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Target Card Preview */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)'
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {target.name}
              </span>
              <span className="ts-badge badge-indigo" style={{ textTransform: 'capitalize' }}>
                {target.environment}
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-xs" style={{ color: 'var(--color-primary)' }}>
              <Globe size={13} />
              <span>{target.targetUrl}</span>
            </div>
          </div>

          {/* Scope Boundaries Table */}
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-muted" style={{ marginBottom: '8px' }}>
              <Sliders size={13} />
              <span>Configured Crawl Scope & Execution Limits</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 'var(--space-2)',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ padding: '8px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-muted block text-xs">Allowed Host</span>
                <strong className="font-mono">{scope.allowedHost || '—'}</strong>
              </div>
              <div style={{ padding: '8px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-muted block text-xs">Subdomains</span>
                <strong>{scope.allowSubdomains ? 'Included' : 'Origin Only (Isolated)'}</strong>
              </div>
              <div style={{ padding: '8px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-muted block text-xs">Crawl Depth & Page Limit</span>
                <strong>{scope.maxDepth || 3} levels / {scope.maxPages || 25} pages max</strong>
              </div>
              <div style={{ padding: '8px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <span className="text-muted block text-xs">Rate Limit & Timeout</span>
                <strong>{policy.rateLimitRps || 2} req/sec • {policy.maxScanDurationSeconds || 300}s limit</strong>
              </div>
            </div>
          </div>

          {/* Diagnostic Modules Run */}
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-muted" style={{ marginBottom: '8px' }}>
              <Layers size={13} />
              <span>Active Diagnostic Analyzers</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                fontSize: '0.75rem'
              }}
            >
              <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                <span>JavaScript Runtime Exceptions</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                <span>Browser Console Errors</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                <span>Network 4xx/5xx Failures</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                <span>Broken Internal Hyperlinks</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                <span>Security Response Headers</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                <span>Navigation & Timing Metrics</span>
              </div>
            </div>
          </div>

          {/* Safety Guarantees Notice */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--emerald-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--emerald-100)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '0.78rem',
              color: '#065f46'
            }}
          >
            <Shield size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-success)' }} />
            <div>
              <strong>Safety & Non-Destructive Assurance:</strong>
              <div style={{ marginTop: '2px' }}>
                The scan engine executes in read-only mode using headless Chromium. It will not submit forms, click purchase buttons, delete data, or mutate target state.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="ts-btn ts-btn-outline"
          >
            Cancel
          </button>
          <button
            id="confirm-launch-scan-btn"
            type="button"
            onClick={handleStartScan}
            disabled={loading}
            className="ts-btn ts-btn-primary"
          >
            {loading ? (
              <>
                <div className="animate-spin" style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                <span>Initiating Engine...</span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>Start Automated Scan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
