import React, { useState } from 'react';
import { X, Globe, Shield, AlertCircle, Loader2, Check } from 'lucide-react';
import { createTarget } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function RegisterTargetModal({ isOpen, onClose, onTargetCreated }) {
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    targetUrl: '',
    environment: 'staging',
    allowSubdomains: false,
    maxDepth: 3,
    maxPages: 25,
    declarationConfirmed: false
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) {
      setServerError('');
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Application name is required.';
    }

    if (!formData.targetUrl.trim()) {
      errors.targetUrl = 'Target URL is required.';
    } else {
      try {
        const parsed = new URL(formData.targetUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.targetUrl = 'URL must start with http:// or https://';
        } else if (
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname.startsWith('192.168.') ||
          parsed.hostname.startsWith('10.')
        ) {
          errors.targetUrl = 'Localhost and private internal networks are not allowed.';
        }
      } catch {
        errors.targetUrl = 'Please provide a valid URL (e.g. https://example.com).';
      }
    }

    if (!formData.declarationConfirmed) {
      errors.declarationConfirmed = 'You must confirm ownership or explicit authorization.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);
    setServerError('');

    const res = await createTarget(formData, token);
    if (res.ok && res.data?.target) {
      onTargetCreated(res.data.target);
      onClose();
    } else {
      setServerError(res.error || 'Failed to register target application.');
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
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-5) var(--space-6)',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--indigo-50)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Globe size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Register Target Application</h3>
              <p className="text-xs text-muted" style={{ marginTop: '2px' }}>
                Define target URL and safe crawling boundaries for automated diagnostics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ts-btn ts-btn-outline"
            style={{ padding: '6px', borderRadius: '50%', width: '32px', height: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 'var(--space-6)' }}>
          {serverError && (
            <div className="alert-banner error">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* App Name */}
            <div className="form-group">
              <label htmlFor="target-name" className="ts-label">
                <span>Application Name</span>
              </label>
              <input
                id="target-name"
                name="name"
                type="text"
                placeholder="e.g. ShopSphere Storefront"
                value={formData.name}
                onChange={handleChange}
                disabled={isSubmitting}
                className={`ts-input ${fieldErrors.name ? 'has-error' : ''}`}
              />
              {fieldErrors.name && (
                <span className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.name}
                </span>
              )}
            </div>

            {/* Target URL */}
            <div className="form-group">
              <label htmlFor="target-url" className="ts-label">
                <span>Target Web URL</span>
                <span className="text-xs text-muted">Must be publicly accessible</span>
              </label>
              <input
                id="target-url"
                name="targetUrl"
                type="url"
                placeholder="https://example.com"
                value={formData.targetUrl}
                onChange={handleChange}
                disabled={isSubmitting}
                className={`ts-input ${fieldErrors.targetUrl ? 'has-error' : ''}`}
              />
              {fieldErrors.targetUrl && (
                <span className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.targetUrl}
                </span>
              )}
            </div>

            {/* Environment */}
            <div className="form-group">
              <label htmlFor="target-env" className="ts-label">
                <span>Environment</span>
              </label>
              <select
                id="target-env"
                name="environment"
                value={formData.environment}
                onChange={handleChange}
                disabled={isSubmitting}
                className="ts-input"
                style={{ cursor: 'pointer' }}
              >
                <option value="staging">Staging (Recommended for diagnostics)</option>
                <option value="development">Development / Preview</option>
                <option value="preview">PR Preview</option>
                <option value="production">Production</option>
              </select>
            </div>

            {/* Scope Limits */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-4)',
              backgroundColor: 'var(--slate-50)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              margin: 'var(--space-4) 0'
            }}>
              <div>
                <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '4px' }}>
                  Max Crawl Depth
                </label>
                <input
                  type="number"
                  name="maxDepth"
                  min="1"
                  max="10"
                  value={formData.maxDepth}
                  onChange={handleChange}
                  className="ts-input"
                  style={{ height: '36px' }}
                />
                <span className="text-xs text-muted">Links deep (default: 3)</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '4px' }}>
                  Max Crawl Pages
                </label>
                <input
                  type="number"
                  name="maxPages"
                  min="1"
                  max="100"
                  value={formData.maxPages}
                  onChange={handleChange}
                  className="ts-input"
                  style={{ height: '36px' }}
                />
                <span className="text-xs text-muted">Page cap (default: 25)</span>
              </div>
            </div>

            {/* Authorization Declaration */}
            <div style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${fieldErrors.declarationConfirmed ? 'var(--color-error)' : 'var(--indigo-200)'}`,
              backgroundColor: 'var(--indigo-50)',
              marginBottom: 'var(--space-6)'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '0.825rem',
                color: 'var(--slate-800)',
                lineHeight: 1.45
              }}>
                <input
                  id="target-declaration-checkbox"
                  type="checkbox"
                  name="declarationConfirmed"
                  checked={formData.declarationConfirmed}
                  onChange={handleChange}
                  style={{
                    width: '18px',
                    height: '18px',
                    marginTop: '2px',
                    accentColor: 'var(--color-primary)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
                <div>
                  <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '2px' }}>
                    Authorization & Ownership Declaration
                  </strong>
                  <span>
                    I confirm that I own or am legally authorized by the system owner to perform automated diagnostic scanning and human testing on this target application.
                  </span>
                </div>
              </label>
              {fieldErrors.declarationConfirmed && (
                <span className="field-error-text" style={{ marginTop: '6px' }}>
                  <AlertCircle size={13} />
                  {fieldErrors.declarationConfirmed}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center" style={{ gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={onClose}
                className="ts-btn ts-btn-outline"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                id="submit-create-target-btn"
                type="submit"
                disabled={isSubmitting}
                className="ts-btn ts-btn-primary"
                style={{ flex: 1.5 }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Register Application</span>
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
