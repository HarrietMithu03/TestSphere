import React, { useState } from 'react';
import { Bug, X, AlertTriangle, Plus } from 'lucide-react';
import { createExploratoryFinding } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ExploratoryFindingModal({ scanId, targetId, isOpen, onClose, onCreated }) {
  const { token } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('runtime_error');
  const [severity, setSeverity] = useState('Medium');
  const [affectedUrl, setAffectedUrl] = useState('');
  const [affectedComponent, setAffectedComponent] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !affectedUrl.trim()) {
      setError('Title, description, and affected URL are required.');
      return;
    }

    setLoading(true);
    const stepsArray = reproductionSteps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await createExploratoryFinding(
      {
        scanId,
        targetId,
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        affectedUrl: affectedUrl.trim(),
        affectedComponent: affectedComponent.trim() || 'Manual Exploration',
        reproductionSteps: stepsArray.length > 0 ? stepsArray : ['Navigate to affected URL', 'Execute user interaction flow'],
        notes: notes.trim()
      },
      token
    );
    setLoading(false);

    if (res.ok && res.data?.finding) {
      if (onCreated) onCreated(res.data.finding);
      onClose();
    } else {
      setError(res.error || 'Failed to submit exploratory finding.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '580px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Bug size={18} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Log Exploratory Finding</h3>
              <span className="text-xs text-muted">Attach manual tester observation to this diagnostic session</span>
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

            <div>
              <label className="ts-form-label">Finding Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Navigation dropdown collapses unexpectedly on tablet viewport"
                className="ts-form-input"
                required
              />
            </div>

            <div className="grid grid-cols-2">
              <div>
                <label className="ts-form-label">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="ts-form-input"
                  required
                >
                  <option value="runtime_error">Runtime Error</option>
                  <option value="console_error">Console Error</option>
                  <option value="network_failure">Network / API Failure</option>
                  <option value="broken_link">Broken Hyperlink</option>
                  <option value="accessibility">Accessibility (WCAG)</option>
                  <option value="performance">Performance & Responsiveness</option>
                  <option value="security_header">Security / Origin Hygiene</option>
                </select>
              </div>

              <div>
                <label className="ts-form-label">Severity *</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="ts-form-input"
                  required
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Info">Info</option>
                </select>
              </div>
            </div>

            <div>
              <label className="ts-form-label">Affected URL *</label>
              <input
                type="url"
                value={affectedUrl}
                onChange={(e) => setAffectedUrl(e.target.value)}
                placeholder="http://127.0.0.1:5050/checkout"
                className="ts-form-input font-mono text-xs"
                required
              />
            </div>

            <div>
              <label className="ts-form-label">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what occurred, expected outcome, and impact..."
                className="ts-form-input"
                style={{ minHeight: '70px', resize: 'vertical' }}
                required
              />
            </div>

            <div>
              <label className="ts-form-label">Reproduction Steps (one per line)</label>
              <textarea
                value={reproductionSteps}
                onChange={(e) => setReproductionSteps(e.target.value)}
                placeholder="Step 1: Navigate to /products&#10;Step 2: Resize browser window to 768px&#10;Step 3: Click hamburger menu icon"
                className="ts-form-input"
                style={{ minHeight: '70px', resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={loading} className="ts-btn ts-btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="ts-btn ts-btn-primary">
              {loading ? 'Submitting...' : 'Save Exploratory Finding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
