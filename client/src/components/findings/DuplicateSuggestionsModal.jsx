import React, { useState, useEffect } from 'react';
import { Copy, X, RefreshCw, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { getDuplicateSuggestions } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DuplicateSuggestionsModal({ finding, isOpen, onClose }) {
  const { token } = useAuth();

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && finding) {
      setLoading(true);
      setError('');
      getDuplicateSuggestions(finding._id || finding.id, token)
        .then((res) => {
          if (res.ok && res.data?.suggestions) {
            setSuggestions(res.data.suggestions);
          } else {
            setError(res.error || 'Failed to check duplicate suggestions.');
          }
          setLoading(false);
        })
        .catch(() => {
          setError('Network error querying duplicate suggestions.');
          setLoading(false);
        });
    }
  }, [isOpen, finding, token]);

  if (!isOpen || !finding) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Copy size={18} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Duplicate Detection Intelligence</h3>
              <span className="text-xs text-muted">Deterministic fingerprint & token similarity analysis</span>
            </div>
          </div>
          <button onClick={onClose} className="ts-btn ts-btn-outline" style={{ padding: '6px', border: 'none' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body flex flex-col gap-4">
          {/* Active Finding Reference */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              fontSize: '0.85rem'
            }}
          >
            <span className="text-muted text-xs block font-medium">Inspecting Finding:</span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{finding.title}</strong>
            <div className="font-mono text-xs text-muted truncate">{finding.affectedUrl}</div>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto' }} />
              <p className="text-xs text-muted" style={{ marginTop: 'var(--space-2)' }}>
                Comparing fingerprints and finding titles across target scans...
              </p>
            </div>
          )}

          {error && (
            <div className="alert-banner error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!loading && suggestions.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--space-8) var(--space-4)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-2) auto' }} />
              <h4 style={{ margin: 0 }}>No Duplicate Issues Found</h4>
              <p className="text-xs text-muted" style={{ maxWidth: '380px', margin: '4px auto 0 auto' }}>
                This finding has a unique fingerprint signature and does not conflict with other active issues in this target.
              </p>
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-muted">
                Potential Duplicate Matches ({suggestions.length})
              </span>
              {suggestions.map((item, idx) => {
                const sFinding = item.finding;
                const isExact = item.similarityScore === 100;

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isExact ? '#fef2f2' : '#f8fafc'
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                      <span
                        className="ts-badge"
                        style={{
                          backgroundColor: isExact ? '#fee2e2' : '#fef3c7',
                          color: isExact ? '#991b1b' : '#92400e',
                          fontWeight: 700
                        }}
                      >
                        {item.similarityScore}% Match {isExact ? '(Exact Fingerprint)' : ''}
                      </span>
                      <span className="text-xs text-muted">{sFinding.category}</span>
                    </div>

                    <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', display: 'block' }}>
                      {sFinding.title}
                    </strong>

                    <div className="font-mono text-xs text-muted truncate" style={{ margin: '2px 0 6px 0' }}>
                      {sFinding.affectedUrl}
                    </div>

                    <p className="text-xs text-secondary" style={{ margin: 0, fontStyle: 'italic' }}>
                      {item.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="ts-btn ts-btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
