import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Printer,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Bug,
  Server,
  Zap,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getReportById, API_BASE_URL } from '../../services/api';
import Card from '../../components/common/Card';

export default function ReportDetailsPage() {
  const { id: reportId } = useParams();
  const { user, token } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('confirmed');
  const [expandedIssues, setExpandedIssues] = useState({});

  useEffect(() => {
    setLoading(true);
    setError('');
    getReportById(reportId, token)
      .then((res) => {
        if (res.ok && res.data?.report) {
          setReport(res.data.report);
        } else {
          setError(res.error || 'Failed to load report details.');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Network error loading diagnostic report.');
        setLoading(false);
      });
  }, [reportId, token]);

  const handleDownloadPdf = () => {
    window.open(`${API_BASE_URL}/reports/${reportId}/pdf`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleExpand = (id) => {
    setExpandedIssues((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 50) return '#d97706';
    return 'var(--color-error)';
  };

  const categoryIcons = {
    runtime_error: <Bug size={14} style={{ color: 'var(--color-error)' }} />,
    console_error: <AlertCircle size={14} style={{ color: '#ea580c' }} />,
    network_failure: <Server size={14} style={{ color: '#dc2626' }} />,
    broken_link: <Globe size={14} style={{ color: '#d97706' }} />,
    security_header: <ShieldAlert size={14} style={{ color: '#4f46e5' }} />,
    performance: <Zap size={14} style={{ color: '#059669' }} />,
    accessibility: <CheckCircle2 size={14} style={{ color: '#7c3aed' }} />
  };

  const severityBadges = {
    Critical: 'badge-danger',
    High: 'badge-warning',
    Medium: 'badge-amber',
    Low: 'badge-slate',
    Info: 'badge-indigo'
  };

  if (loading && !report) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
        <p className="text-sm text-muted" style={{ marginTop: 'var(--space-3)' }}>
          Loading diagnostic assessment report...
        </p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="flex flex-col gap-4">
        <div className="alert-banner error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <Link to="/reports" className="ts-btn ts-btn-outline" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} />
          <span>Return to Reports</span>
        </Link>
      </div>
    );
  }

  const target = report?.targetId || {};
  const confirmed = report?.confirmedIssues || [];
  const suspected = report?.suspectedIssues || [];
  const passed = report?.passedChecks || [];
  const notPerformed = report?.checksNotPerformed || [];

  return (
    <div className="flex flex-col gap-6 printable-report">
      {/* Top Header & Actions Bar */}
      <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="flex items-center gap-3">
          <Link to="/reports" className="ts-btn ts-btn-outline no-print" style={{ padding: '6px 10px' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Diagnostic Assessment Report</span>
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                {report.reportNumber}
              </span>
              <span className="ts-badge badge-success text-xs">Finalized</span>
            </div>
            <h1 style={{ fontSize: '1.4rem', marginTop: '2px' }}>
              {target.name || report.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button onClick={handlePrint} className="ts-btn ts-btn-outline" title="Print report">
            <Printer size={15} />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            className="ts-btn ts-btn-primary"
            title="Download PDF report artifact"
          >
            <Download size={15} />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Target & Scope Scope Metadata Card */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)'
        }}
      >
        <div className="flex items-center gap-2">
          <Globe size={16} style={{ color: 'var(--color-primary)' }} />
          <span className="font-mono text-xs" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {report.scope?.targetUrl}
          </span>
          <a
            href={report.scope?.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted no-print"
          >
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted" style={{ flexWrap: 'wrap' }}>
          <div>
            Evaluated Host: <strong className="font-mono text-dark">{report.scope?.allowedHost || '—'}</strong>
          </div>
          <div>
            Environment: <strong className="text-dark" style={{ textTransform: 'capitalize' }}>{report.scope?.environment || 'staging'}</strong>
          </div>
          <div>
            Pages Crawled: <strong className="text-dark">{report.pagesScanned}</strong>
          </div>
          <div>
            Date: <strong className="text-dark">{new Date(report.createdAt).toLocaleDateString()}</strong>
          </div>
        </div>
      </div>

      {/* Executive Summary & Metrics Cards */}
      <div className="grid grid-cols-4">
        <Card>
          <span className="text-xs text-muted font-medium">Health Score</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: getScoreColor(report.healthScore), marginTop: '2px' }}>
            {report.healthScore} <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>/ 100</span>
          </div>
        </Card>

        <Card>
          <span className="text-xs text-muted font-medium">1. Confirmed Issues</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: confirmed.length > 0 ? 'var(--color-error)' : 'var(--color-success)', marginTop: '2px' }}>
            {confirmed.length}
          </div>
        </Card>

        <Card>
          <span className="text-xs text-muted font-medium">2. Suspected Observations</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: suspected.length > 0 ? '#d97706' : 'var(--color-text-secondary)', marginTop: '2px' }}>
            {suspected.length}
          </div>
        </Card>

        <Card>
          <span className="text-xs text-muted font-medium">3. Passed Checks</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px' }}>
            {passed.length}
          </div>
        </Card>
      </div>

      {/* Executive Summary Narrative */}
      <Card title="Executive Assessment Summary" icon={ShieldCheck}>
        <p style={{ margin: 0, fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
          {report.executiveSummary}
        </p>
      </Card>

      {/* Four-Tier Classification Tabs Header */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '2px',
          overflowX: 'auto'
        }}
      >
        <button
          onClick={() => setActiveTab('confirmed')}
          className="ts-btn"
          style={{
            borderBottom: activeTab === 'confirmed' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'confirmed' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderRadius: 0,
            fontWeight: activeTab === 'confirmed' ? 600 : 500,
            padding: '8px 14px',
            backgroundColor: 'transparent'
          }}
        >
          <span>1. Confirmed Issues</span>
          <span className="ts-badge badge-danger text-xs font-mono" style={{ marginLeft: '6px' }}>{confirmed.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('suspected')}
          className="ts-btn"
          style={{
            borderBottom: activeTab === 'suspected' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'suspected' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderRadius: 0,
            fontWeight: activeTab === 'suspected' ? 600 : 500,
            padding: '8px 14px',
            backgroundColor: 'transparent'
          }}
        >
          <span>2. Suspected Observations</span>
          <span className="ts-badge badge-warning text-xs font-mono" style={{ marginLeft: '6px' }}>{suspected.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('passed')}
          className="ts-btn"
          style={{
            borderBottom: activeTab === 'passed' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'passed' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderRadius: 0,
            fontWeight: activeTab === 'passed' ? 600 : 500,
            padding: '8px 14px',
            backgroundColor: 'transparent'
          }}
        >
          <span>3. Passed Checks</span>
          <span className="ts-badge badge-success text-xs font-mono" style={{ marginLeft: '6px' }}>{passed.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('omitted')}
          className="ts-btn"
          style={{
            borderBottom: activeTab === 'omitted' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'omitted' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderRadius: 0,
            fontWeight: activeTab === 'omitted' ? 600 : 500,
            padding: '8px 14px',
            backgroundColor: 'transparent'
          }}
        >
          <span>4. Checks Not Performed</span>
          <span className="ts-badge badge-slate text-xs font-mono" style={{ marginLeft: '6px' }}>{notPerformed.length}</span>
        </button>
      </div>

      {/* Tab 1: Confirmed Issues */}
      {(activeTab === 'confirmed' || window.matchMedia('print').matches) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Category 1: Confirmed Issues</h3>
            <span className="text-xs text-muted">Issues with definite failure evidence (crashes, 500s, 404 dead links, missing security headers)</span>
          </div>

          {confirmed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', backgroundColor: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)', margin: '0 auto 8px auto' }} />
              <h4>Zero Confirmed Issues Detected</h4>
              <p className="text-xs text-muted">All evaluated functional and security rules passed on crawled pages.</p>
            </div>
          ) : (
            confirmed.map((finding) => {
              const fId = finding._id || finding.id || finding.fingerprint;
              const isExpanded = !!expandedIssues[fId];

              return (
                <div
                  key={fId}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => toggleExpand(fId)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      backgroundColor: isExpanded ? 'var(--slate-50)' : '#ffffff'
                    }}
                  >
                    <div className="flex items-start gap-3" style={{ flex: 1 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        {categoryIcons[finding.category] || <Bug size={14} />}
                      </div>
                      <div className="flex flex-col gap-1" style={{ flex: 1 }}>
                        <div className="flex items-center gap-2">
                          <span className={`ts-badge ${severityBadges[finding.severity] || 'badge-slate'}`}>{finding.severity}</span>
                          <span className="ts-badge badge-success">Confirmed</span>
                          <span className="text-xs text-muted font-semibold uppercase">{finding.category?.replace('_', ' ')}</span>
                          {finding.occurrenceCount > 1 && (
                            <span className="ts-badge badge-slate text-xs font-mono">Seen {finding.occurrenceCount}x</span>
                          )}
                        </div>
                        <h4 style={{ margin: '2px 0', fontSize: '0.95rem' }}>{finding.title}</h4>
                        <div className="font-mono text-xs text-muted truncate">{finding.affectedUrl}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted no-print">
                      <span>{isExpanded ? 'Hide' : 'Details'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <span className="text-xs font-semibold text-muted uppercase">Description:</span>
                        <p style={{ margin: '4px 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{finding.description}</p>
                      </div>

                      {finding.reproductionSteps && finding.reproductionSteps.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-muted uppercase">Reproduction Steps:</span>
                          <ol style={{ paddingLeft: '20px', margin: '4px 0', fontSize: '0.85rem' }}>
                            {finding.reproductionSteps.map((step, sIdx) => (
                              <li key={sIdx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {finding.evidence && Object.keys(finding.evidence).length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-muted uppercase">Captured Evidence:</span>
                          <pre style={{ backgroundColor: 'var(--slate-900)', color: '#f8fafc', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontFamily: 'monospace', overflowX: 'auto', margin: '4px 0' }}>
                            {JSON.stringify(finding.evidence, null, 2)}
                          </pre>
                        </div>
                      )}

                      {finding.remediation && (
                        <div style={{ padding: '8px 12px', backgroundColor: '#eff6ff', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e40af' }}>
                          <strong>Actionable Remediation:</strong> {finding.remediation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Suspected Observations */}
      {(activeTab === 'suspected' || window.matchMedia('print').matches) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Category 2: Suspected Observations</h3>
            <span className="text-xs text-muted">Heuristic, transient, or ambiguous observations (e.g. latency spikes, unauthenticated barriers)</span>
          </div>

          {suspected.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', backgroundColor: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)', margin: '0 auto 8px auto' }} />
              <h4>Zero Suspected Observations</h4>
              <p className="text-xs text-muted">No heuristic timing bottlenecks or ambiguous network states were recorded.</p>
            </div>
          ) : (
            suspected.map((finding) => (
              <div key={finding._id || finding.id} style={{ padding: '12px 16px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                  <span className={`ts-badge ${severityBadges[finding.severity] || 'badge-slate'}`}>{finding.severity}</span>
                  <span className="ts-badge badge-warning">Suspected (Heuristic)</span>
                  <span className="text-xs text-muted font-semibold uppercase">{finding.category}</span>
                </div>
                <h4 style={{ margin: '4px 0', fontSize: '0.95rem' }}>{finding.title}</h4>
                <div className="font-mono text-xs text-muted">{finding.affectedUrl}</div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{finding.description}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Passed Checks with Supporting Evidence */}
      {(activeTab === 'passed' || window.matchMedia('print').matches) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Category 3: Passed Checks with Supporting Evidence</h3>
            <span className="text-xs text-muted">Verified quality baselines executed across the target scope with zero defects</span>
          </div>

          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Verification Rule</th>
                  <th>Supporting Evidence & Methodology</th>
                </tr>
              </thead>
              <tbody>
                {passed.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{item.checkName}</strong>
                          <span className="text-xs text-muted block uppercase font-mono">{item.module}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{item.description}</p>
                      {item.evidence && (
                        <span className="text-xs font-mono text-muted block" style={{ marginTop: '4px' }}>
                          Evidence metric: {JSON.stringify(item.evidence)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Checks Not Performed & Scope Boundaries */}
      {(activeTab === 'omitted' || window.matchMedia('print').matches) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Category 4: Checks Not Performed & Scope Boundaries</h3>
            <span className="text-xs text-muted">Transparent disclosure of diagnostic boundaries, omitted modules, and legal scope constraints</span>
          </div>

          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Omitted Scope / Check</th>
                  <th>Technical & Policy Justification</th>
                </tr>
              </thead>
              <tbody>
                {notPerformed.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Info size={15} style={{ color: 'var(--slate-500)', flexShrink: 0 }} />
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{item.checkName}</strong>
                          <span className="text-xs text-muted block uppercase font-mono">{item.module}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{item.reason}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
