import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Layers,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Lock,
  Mail
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthVisual from '../../components/auth/AuthVisual';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear field-specific error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) {
      setServerError('');
    }
  };

  const validate = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
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

    const res = await login({
      email: formData.email,
      password: formData.password,
      rememberMe: formData.rememberMe
    });

    if (res.success) {
      navigate(from, { replace: true });
    } else {
      setServerError(res.error || 'Failed to sign in. Please verify your credentials.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-split-wrapper">
      {/* Left Brand Pane */}
      <div className="auth-brand-side">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div className="brand-icon-wrapper" style={{ boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)' }}>
              <Layers size={22} />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>
              TestSphere
            </span>
            <span className="brand-badge" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#c7d2fe', borderColor: 'rgba(255,255,255,0.2)' }}>
              QA Platform
            </span>
          </Link>

          <div style={{ marginTop: 'var(--space-10)', maxWidth: '520px' }}>
            <h1 style={{ color: '#ffffff', fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.2 }}>
              Ship better software, together.
            </h1>
            <p style={{ marginTop: 'var(--space-3)', color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6 }}>
              A unified testing workspace for development and QA teams. Organize test campaigns, execute structured test cases, detect duplicate bugs automatically, and monitor quality progress in real time.
            </p>
          </div>
        </div>

        {/* Abstract QA Visual Component */}
        <AuthVisual />

        <div style={{ position: 'relative', zIndex: 2, marginTop: 'var(--space-6)', fontSize: '0.75rem', color: '#64748b' }}>
          <span>&copy; {new Date().getFullYear()} TestSphere Inc. &bull; Enterprise Application Testing</span>
        </div>
      </div>

      {/* Right Form Pane */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Sign in to TestSphere
            </h2>
            <p style={{ marginTop: '4px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Enter your credentials to access your testing workspace.
            </p>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="alert-banner error" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Authentication Error</strong>
                <span>{serverError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="login-email" className="ts-label">
                <span>Email address</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`ts-input ${fieldErrors.email ? 'has-error' : ''}`}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                />
              </div>
              {fieldErrors.email && (
                <span id="login-email-error" className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="login-password" className="ts-label">
                <span>Password</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`ts-input has-toggle ${fieldErrors.password ? 'has-error' : ''}`}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <span id="login-password-error" className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {/* Session / Remember Option */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: 'var(--space-4) 0 var(--space-6) 0'
            }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    accentColor: 'var(--color-primary)',
                    cursor: 'pointer'
                  }}
                />
                <span>Keep me signed in for 30 days</span>
              </label>
            </div>

            {/* Submit Action */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="ts-btn ts-btn-primary"
              style={{ width: '100%', height: 'var(--btn-height)', fontSize: '0.95rem' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Registration Link */}
          <div style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-5)',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)'
          }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{ fontWeight: 600, color: 'var(--color-primary)' }}
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
