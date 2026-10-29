import React from 'react';
import {
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitBranch,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';

export default function AuthVisual() {
  return (
    <div className="qa-visual-container">
      {/* Primary Mockup: Live Campaign Run Card */}
      <div className="qa-mock-card">
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(79, 70, 229, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c7d2fe'
            }}>
              <Layers size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
                Release Candidate 3.2.0
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Payment & Checkout Suite &bull; 48 Test Cases
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            color: '#6ee7b7',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#34d399' }} />
            Active Run
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{
            display: 'flex',
            height: '6px',
            borderRadius: '9999px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            gap: '2px'
          }}>
            <div style={{ width: '80%', backgroundColor: '#10b981' }} title="Passed: 80%" />
            <div style={{ width: '12%', backgroundColor: '#f43f5e' }} title="Failed: 12%" />
            <div style={{ width: '8%', backgroundColor: '#f59e0b' }} title="Blocked: 8%" />
          </div>
          <div className="flex justify-between" style={{ marginTop: '6px', fontSize: '0.7rem', color: '#cbd5e1' }}>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} color="#34d399" /> 38 Passed
            </span>
            <span className="flex items-center gap-1">
              <XCircle size={12} color="#fb7185" /> 6 Failed
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle size={12} color="#fcd34d" /> 4 Blocked
            </span>
          </div>
        </div>

        {/* Sample Test Case Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.775rem'
          }}>
            <span style={{ color: '#e2e8f0' }}>TC-104: 3D-Secure OTP verification under latency</span>
            <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.7rem' }}>PASS</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.775rem'
          }}>
            <span style={{ color: '#e2e8f0' }}>TC-109: Idempotency token retry on payment timeout</span>
            <span style={{ color: '#fb7185', fontWeight: 600, fontSize: '0.7rem' }}>FAIL</span>
          </div>
        </div>
      </div>

      {/* Secondary Mockup: Intelligent Duplicate Bug & Priority Scoring */}
      <div className="qa-mock-card" style={{ marginLeft: 'var(--space-6)', marginTop: '-8px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          <div className="flex items-center gap-2">
            <Zap size={14} color="#a5b4fc" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>
              Intelligent Bug Intelligence
            </span>
          </div>
          <span style={{
            fontSize: '0.675rem',
            color: '#a5b4fc',
            backgroundColor: 'rgba(99, 102, 241, 0.25)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            Live Score: 92/100
          </span>
        </div>
        <p style={{ fontSize: '0.725rem', color: '#cbd5e1', lineHeight: '1.3' }}>
          Similarity Match: <strong>94% match</strong> detected with existing Bug #42.
          Suggested action: Merge report or verify regression.
        </p>
      </div>

      {/* Live sync pill */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        alignSelf: 'flex-start',
        padding: '4px 10px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '0.7rem',
        color: '#94a3b8'
      }}>
        <Activity size={12} color="#818cf8" />
        <span>Real-time test sync over Socket.IO</span>
      </div>
    </div>
  );
}
