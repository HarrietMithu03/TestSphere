import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Globe,
  CheckCircle2,
  Shield,
  Layers,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getReports, API_BASE_URL } from '../../services/api';
import Card from '../../components/common/Card';

export default function ReportsListPage() {
  const { user, token } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    const res = await getReports(token);
    if (res.ok && res.data?.reports) {
      setReports(res.data.reports);
    } else {
      setError(res.error || 'Failed to load diagnostic reports.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  const getScoreBadge = (score) => {
    let bg = '#ecfdf5';
    let text = '#047857';
    let border = '#a7f3d0';

    if (score < 50) {
      bg = '#fef2f2';
      text = '#b91c1c';
      border = '#fecaca';
    } else if (score < 75) {
      bg = '#fffbeb';
      text = '#b45309';
      border = '#fde68a';
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          fontWeight: 700,
          backgroundColor: bg,
          color: text,
          border: `1px solid ${border}`
        }}
      >
        {score} / 100
      </span>
    );
  };

  const handleDownloadPdf = (reportId, reportNumber) => {
    window.open(`${API_BASE_URL}/reports/${reportId}/pdf`, '_blank');
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
              <span className="ts-badge badge-indigo">Executive Intelligence</span>
              <span className="text-xs text-muted">Phase 4 Comprehensive Reports</span>
            </div>
            <h1>Diagnostic Assessment Reports</h1>
            <p style={{ marginTop: 'var(--space-2)', maxWidth: '640px', fontSize: '0.95rem' }}>
              Structured, executive-ready assessment reports generated from real automated diagnostic sessions. Includes health scores, four-tier issue classifications, and downloadable PDF artifacts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchReports}
              disabled={loading}
              className="ts-btn ts-btn-outline"
              title="Refresh reports list"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <Link to="/scans" className="ts-btn ts-btn-primary">
              <Layers size={15} />
              <span>Go to Diagnostic Scans</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Error */}
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
            Loading diagnostic reports...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && reports.length === 0 && (
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
            <FileText size={32} />
          </div>
          <h3>No diagnostic reports generated yet</h3>
          <p style={{ maxWidth: '440px', margin: 'var(--space-2) auto var(--space-6) auto', fontSize: '0.9rem' }}>
            Run an automated diagnostic scan on one of your target applications, then generate a comprehensive report with executive summary and PDF exports.
          </p>
          <Link to="/scans" className="ts-btn ts-btn-primary">
            <span>View Active Scans</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Reports Table */}
      {!loading && reports.length > 0 && (
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
                  <th>Report Number</th>
                  <th>Target Application</th>
                  <th>Health Score</th>
                  <th>Confirmed / Suspected</th>
                  <th>Passed Checks</th>
                  <th>Generated Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const rId = report._id || report.id;
                  const target = report.targetId || {};

                  return (
                    <tr key={rId}>
                      <td>
                        <div className="flex items-center gap-2">
                          <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                          <strong className="font-mono text-xs">{report.reportNumber}</strong>
                        </div>
                      </td>

                      <td>
                        <div className="flex flex-col">
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {target.name || 'Application'}
                          </span>
                          <span className="font-mono text-xs text-muted">
                            {report.scope?.targetUrl}
                          </span>
                        </div>
                      </td>

                      <td>{getScoreBadge(report.healthScore)}</td>

                      <td>
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <strong style={{ color: 'var(--color-error)' }}>
                            {report.severityCounts?.critical + report.severityCounts?.high || 0} critical/high
                          </strong>
                          <span className="text-muted">({report.severityCounts?.total || 0} total)</span>
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-success)' }}>
                          <CheckCircle2 size={13} />
                          <span>{report.passedChecks?.length || 0} verified</span>
                        </div>
                      </td>

                      <td>
                        <span className="text-xs text-muted">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownloadPdf(rId, report.reportNumber)}
                            className="ts-btn ts-btn-outline"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                            title="Download PDF Artifact"
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>
                          <Link
                            to={`/reports/${rId}`}
                            className="ts-btn ts-btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', height: '28px' }}
                          >
                            <span>Inspect</span>
                            <ArrowRight size={12} />
                          </Link>
                        </div>
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
