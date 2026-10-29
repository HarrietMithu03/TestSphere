import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Globe,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getScans } from '../../services/api';
import Card from '../../components/common/Card';

export default function ScanHistoryPage() {
  const { user, token } = useAuth();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchScans = async () => {
    setLoading(true);
    setError('');
    const res = await getScans({}, token);
    if (res.ok && res.data?.scans) {
      setScans(res.data.scans);
    } else {
      setError(res.error || 'Failed to load diagnostic scan history.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchScans();
  }, [token]);

  const isDeveloper = user?.role === 'developer';

  const formatDuration = (ms) => {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const statusBadges = {
    QUEUED: <span className="ts-badge badge-slate">Queued</span>,
    RUNNING: (
      <span className="ts-badge badge-indigo flex items-center gap-1">
        <div className="animate-spin" style={{ width: '8px', height: '8px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
        <span>Running</span>
      </span>
    ),
    COMPLETED: <span className="ts-badge badge-success">Completed</span>,
    PARTIALLY_COMPLETED: <span className="ts-badge badge-warning">Partially Completed</span>,
    FAILED: <span className="ts-badge badge-danger">Failed</span>,
    CANCELLED: <span className="ts-badge badge-slate">Cancelled</span>
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span className="ts-badge badge-indigo">Automated Diagnostics</span>
              <span className="text-xs text-muted">Playwright Engine Telemetry</span>
            </div>
            <h1>Diagnostic Scan History</h1>
            <p style={{ marginTop: 'var(--space-2)', maxWidth: '640px', fontSize: '0.95rem' }}>
              Review past automated web scans, crawl execution boundaries, and inspect verified findings across your registered application targets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchScans}
              disabled={loading}
              className="ts-btn ts-btn-outline"
              title="Refresh scan history"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <Link to="/targets" className="ts-btn ts-btn-primary">
              <span>{isDeveloper ? 'Go to Applications' : 'View Assigned Applications'}</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert-banner error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto' }} />
          <p className="text-sm text-muted" style={{ marginTop: 'var(--space-3)' }}>
            Loading scan history records...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && scans.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-6)',
            backgroundColor: 'var(--color-surface)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--indigo-50)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4) auto'
            }}
          >
            <Activity size={32} />
          </div>
          <h3>No diagnostic scans recorded yet</h3>
          <p style={{ maxWidth: '440px', margin: 'var(--space-2) auto var(--space-6) auto', fontSize: '0.9rem' }}>
            {isDeveloper
              ? 'Navigate to your target applications and launch an automated scan to inspect runtime errors, broken links, and security headers.'
              : 'Your assigned target applications have not undergone automated diagnostics yet.'}
          </p>
          {isDeveloper && (
            <Link to="/targets" className="ts-btn ts-btn-primary">
              <Globe size={16} />
              <span>Select Target Application</span>
            </Link>
          )}
        </div>
      )}

      {/* Scan History Table */}
      {!loading && scans.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th>Target Application</th>
                  <th>Status</th>
                  <th>Pages Scanned</th>
                  <th>Findings</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scanItem) => {
                  const sId = scanItem._id || scanItem.id;
                  const target = scanItem.targetId || {};
                  const snapshot = scanItem.targetSnapshot || {};
                  const summary = scanItem.findingsSummary || {};

                  return (
                    <tr key={sId}>
                      <td>
                        <div className="flex flex-col">
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {target.name || snapshot.name || 'Unnamed Target'}
                          </span>
                          <span className="font-mono text-xs text-muted">
                            {target.targetUrl || snapshot.targetUrl}
                          </span>
                        </div>
                      </td>

                      <td>
                        {statusBadges[scanItem.status] || <span className="ts-badge badge-slate">{scanItem.status}</span>}
                      </td>

                      <td>
                        <span className="font-mono text-xs">
                          {scanItem.pagesScanned || 0}
                          <span className="text-muted"> / {scanItem.pagesDiscovered || 0}</span>
                        </span>
                      </td>

                      <td>
                        <div className="flex items-center gap-1.5">
                          <strong style={{ fontSize: '0.9rem', color: (summary.total || 0) > 0 ? 'var(--color-primary)' : 'var(--color-success)' }}>
                            {summary.total || 0}
                          </strong>
                          {(summary.critical || 0) > 0 && (
                            <span className="ts-badge badge-danger text-xs">
                              {summary.critical} crit
                            </span>
                          )}
                          {(summary.high || 0) > 0 && (
                            <span className="ts-badge badge-warning text-xs">
                              {summary.high} high
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="text-xs font-mono text-muted">
                          {formatDuration(scanItem.durationMs)}
                        </span>
                      </td>

                      <td>
                        <span className="text-xs text-muted">
                          {scanItem.createdAt ? new Date(scanItem.createdAt).toLocaleDateString() : '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/scans/${sId}`}
                          className="ts-btn ts-btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.8rem', height: '30px' }}
                        >
                          <span>Inspect</span>
                          <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
