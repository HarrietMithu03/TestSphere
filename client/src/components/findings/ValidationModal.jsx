import React, { useState } from 'react';
import { CheckCircle2, AlertOctagon, Wrench, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { validateFinding } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ValidationModal({ finding, isOpen, onClose, onValidated }) {
  const { token } = useAuth();

  const [status, setStatus] = useState('confirmed');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [reproductionConfirmed, setReproductionConfirmed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !finding) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (status === 'false_positive' && !reason.trim() && !notes.trim()) {
      setError('A technical reason or note is required when classifying an issue as a false positive.');
      return;
    }

    setLoading(true);
    const res = await validateFinding(
      finding._id || finding.id,
      {
        status,
        notes: notes.trim(),
        reason: reason.trim(),
        reproductionConfirmed
      },
      token
    );
    setLoading(false);

    if (res.ok && res.data?.finding) {
      if (onValidated) onValidated(res.data.finding);
      onClose();
    } else {
      setError(res.error || 'Failed to update finding validation.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Human Tester Validation</h3>
              <span className="text-xs text-muted">Review, confirm, or flag automated findings</span>
            </div>
          </div>
          <button onClick={onClose} className="ts-btn ts-btn-outline" style={{ padding: '6px', border: 'none' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body flex flex-col gap-4">
            {error && (
              <div className="alert-banner error">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Target Finding Title */}
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--slate-200)',
                fontSize: '0.85rem'
              }}
            >
              <span className="text-muted text-xs block font-medium">Evaluating Finding:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{finding.title}</strong>
              <div className="font-mono text-xs text-muted truncate" style={{ marginTop: '2px' }}>
                {finding.affectedUrl}
              </div>
            </div>

            {/* Classification Decision */}
            <div>
              <label className="ts-form-label">Validation Decision *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="ts-form-input"
                required
              >
                <option value="confirmed">Confirmed Bug (Reproducible Failure)</option>
                <option value="false_positive">False Positive (Heuristic / Intended Behavior)</option>
                <option value="fixed">Fixed by Developer (Ready for Retest)</option>
                <option value="retested_pass">Retest Passed (Verified Resolved)</option>
                <option value="retested_fail">Retest Failed (Still Reproducing)</option>
              </select>
            </div>

            {/* False positive reason */}
            {status === 'false_positive' && (
              <div>
                <label className="ts-form-label">False Positive Rationale *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this finding is expected or harmless (e.g. intentional 401 on unauthenticated route, test fixture artifact, etc.)..."
                  className="ts-form-input"
                  style={{ minHeight: '75px', resize: 'vertical' }}
                  required
                />
              </div>
            )}

            {/* Verification notes */}
            <div>
              <label className="ts-form-label">Tester Review Notes & Observations</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Include browser environment, user role tested, or verification details..."
                className="ts-form-input"
                style={{ minHeight: '70px', resize: 'vertical' }}
              />
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-center gap-2 text-xs" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reproductionConfirmed}
                onChange={(e) => setReproductionConfirmed(e.target.checked)}
              />
              <span>I personally inspected and verified this finding on the target application.</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={loading} className="ts-btn ts-btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="ts-btn ts-btn-primary">
              {loading ? 'Saving...' : 'Submit Validation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
