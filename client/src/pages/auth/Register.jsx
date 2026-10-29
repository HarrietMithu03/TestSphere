import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Code2,
  Bug,
  Shield,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthVisual from '../../components/auth/AuthVisual';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'tester' // default role
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Dynamic password criteria validation
  const hasMinLength = formData.password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(formData.password);
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) {
      setServerError('');
    }
  };

  const handleRoleSelect = (selectedRole) => {
    setFormData((prev) => ({ ...prev, role: selectedRole }));
    if (fieldErrors.role) {
      setFieldErrors((prev) => ({ ...prev, role: '' }));
    }
  };

  const validate = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.name.trim()) {
      errors.name = 'Full name is required.';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (!['developer', 'tester'].includes(formData.role)) {
      errors.role = 'Please choose a valid role.';
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

    const res = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role
    });

    if (res.success) {
      navigate('/', { replace: true });
    } else {
      setServerError(res.error || 'Registration failed. Please check your details.');
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
              Built for engineering and testing teams.
            </h1>
            <p style={{ marginTop: 'var(--space-3)', color: '#94a3b8', fontSize: '1.05rem', lineHeight: 1.6 }}>
              Whether you are authoring testing campaigns as a Developer or logging structured bug reports as a Tester, TestSphere provides the precision tools you need to deliver defect-free releases.
            </p>
          </div>
        </div>

        {/* Abstract QA Visual Component */}
        <AuthVisual />

        <div style={{ position: 'relative', zIndex: 2, marginTop: 'var(--space-6)', fontSize: '0.75rem', color: '#64748b' }}>
          <span>&copy; {new Date().getFullYear()} TestSphere Inc. &bull; Role-Based Quality Assurance</span>
        </div>
      </div>

      {/* Right Form Pane */}
      <div className="auth-form-side">
        <div className="auth-card auth-card-wide">
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Create your account
            </h2>
            <p style={{ marginTop: '4px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Select your role and enter your details to get started.
            </p>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="alert-banner error" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Registration Error</strong>
                <span>{serverError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Role Selection */}
            <div className="form-group">
              <label className="ts-label">
                <span>Account Role</span>
                <span className="text-xs text-muted">Defines your default workspace permissions</span>
              </label>

              <div className="role-selector-grid">
                {/* Developer Role Card */}
                <div
                  id="role-developer"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRoleSelect('developer')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRoleSelect('developer'); }}
                  className={`role-card ${formData.role === 'developer' ? 'selected' : ''}`}
                >
                  <div className="role-card-header">
                    <div className="role-card-icon">
                      <Code2 size={18} />
                    </div>
                    <div className="role-radio-dot" />
                  </div>
                  <div className="role-card-title">Developer</div>
                  <div className="role-card-desc">
                    Create campaigns, author test suites, and triage bug reports.
                  </div>
                </div>

                {/* Tester Role Card */}
                <div
                  id="role-tester"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRoleSelect('tester')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRoleSelect('tester'); }}
                  className={`role-card ${formData.role === 'tester' ? 'selected' : ''}`}
                >
                  <div className="role-card-header">
                    <div className="role-card-icon">
                      <Bug size={18} />
                    </div>
                    <div className="role-radio-dot" />
                  </div>
                  <div className="role-card-title">Tester</div>
                  <div className="role-card-desc">
                    Join campaigns via invite codes, execute test cases, and log bugs.
                  </div>
                </div>
              </div>
              {fieldErrors.role && (
                <span className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.role}
                </span>
              )}
            </div>

            {/* Name Field */}
            <div className="form-group">
              <label htmlFor="reg-name" className="ts-label">
                <span>Full name</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Alex Morgan"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`ts-input ${fieldErrors.name ? 'has-error' : ''}`}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'reg-name-error' : undefined}
                />
              </div>
              {fieldErrors.name && (
                <span id="reg-name-error" className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.name}
                </span>
              )}
            </div>

            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="reg-email" className="ts-label">
                <span>Email address</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`ts-input ${fieldErrors.email ? 'has-error' : ''}`}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
                />
              </div>
              {fieldErrors.email && (
                <span id="reg-email-error" className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label htmlFor="reg-password" className="ts-label">
                <span>Password</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`ts-input has-toggle ${fieldErrors.password ? 'has-error' : ''}`}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby="password-rules"
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

              {/* Password Requirements Checklist */}
              <div id="password-rules" className="password-requirements">
                <div className={`req-item ${hasMinLength ? 'met' : ''}`}>
                  {hasMinLength ? <Check size={13} /> : <span style={{ width: '13px', display: 'inline-block' }}>&bull;</span>}
                  <span>Minimum 8 characters</span>
                </div>
                <div className={`req-item ${hasLetter && hasNumberOrSymbol ? 'met' : ''}`}>
                  {hasLetter && hasNumberOrSymbol ? <Check size={13} /> : <span style={{ width: '13px', display: 'inline-block' }}>&bull;</span>}
                  <span>Contains both letters and numbers/symbols</span>
                </div>
              </div>

              {fieldErrors.password && (
                <span className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="form-group">
              <label htmlFor="reg-confirm-password" className="ts-label">
                <span>Confirm password</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="reg-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`ts-input has-toggle ${fieldErrors.confirmPassword ? 'has-error' : ''}`}
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={fieldErrors.confirmPassword ? 'reg-confirm-error' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <span id="reg-confirm-error" className="field-error-text">
                  <AlertCircle size={13} />
                  {fieldErrors.confirmPassword}
                </span>
              )}
            </div>

            {/* Security Notice */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'var(--slate-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              margin: 'var(--space-4) 0 var(--space-6) 0',
              fontSize: '0.725rem',
              color: 'var(--color-text-secondary)'
            }}>
              <Shield size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
              <span>
                Role selection is validated against server-side authorization policies to ensure strict boundary isolation.
              </span>
            </div>

            {/* Submit Action */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="ts-btn ts-btn-primary"
              style={{ width: '100%', height: 'var(--btn-height)', fontSize: '0.95rem' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creating your account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div style={{
            marginTop: 'var(--space-5)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)'
          }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ fontWeight: 600, color: 'var(--color-primary)' }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
