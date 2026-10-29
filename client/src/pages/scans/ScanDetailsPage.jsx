import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Layers,
  StopCircle,
  Bug,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCode,
  ShieldAlert,
  Zap,
  Server,
  HelpCircle,
  Filter,
  FileText,
  CheckSquare,
  Copy,
  PlusCircle,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getScanById,
  cancelScan,
  getScanFindings,
  createOrGetReport
} from '../../services/api';
import { getSocket, subscribeToScan, unsubscribeFromScan } from '../../services/socket';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import ValidationModal from '../../components/findings/ValidationModal';
import DuplicateSuggestionsModal from '../../components/findings/DuplicateSuggestionsModal';
import ExploratoryFindingModal from '../../components/findings/ExploratoryFindingModal';

export default function ScanDetailsPage() {
  const { id: scanId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [scan, setScan] = useState(null);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Tester collaboration modals
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedFindingForValidation, setSelectedFindingForValidation] = useState(null);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [selectedFindingForDuplicates, setSelectedFindingForDuplicates] = useState(null);
  const [showExploratoryModal, setShowExploratoryModal] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState('ALL');
  const [validationFilter, setValidationFilter] = useState('ALL');

  // Expanded finding cards
  const [expandedFindings, setExpandedFindings] = useState({});

  // Fetch initial scan state and existing findings
  const loadScanData = async () => {
    setLoading(true);
    setError('');

    const scanRes = await getScanById(scanId, token);
    if (!scanRes.ok || !scanRes.data?.scan) {
      setError(scanRes.error || 'Failed to load diagnostic scan details.');
      setLoading(false);
      return;
    }

    setScan(scanRes.data.scan);

    const findingsRes = await getScanFindings(scanId, {}, token);
    if (findingsRes.ok && findingsRes.data?.findings) {
      setFindings(findingsRes.data.findings);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadScanData();
  }, [scanId, token]);

  // Real-time Socket.IO subscriptions
  useEffect(() => {
    if (!scanId || !token) return;

    // Join authorized room
    subscribeToScan(scanId, token, (res) => {
      if (!res?.success) {
        console.warn('[Socket.IO] Scan room subscription notice:', res?.message);
      }
    });

    const socket = getSocket();

    const handleProgress = (data) => {
      if (data.scanId === scanId) {
        setScan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentStage: data.currentStage || data.stage || prev.currentStage,
            progress: data.progress !== undefined ? data.progress : prev.progress,
            pagesScanned: data.pagesScanned !== undefined ? data.pagesScanned : prev.pagesScanned,
            pagesDiscovered: data.pagesDiscovered !== undefined ? data.pagesDiscovered : prev.pagesDiscovered
          };
        });
      }
    };

    const handleFinding = (newFinding) => {
      if (newFinding.scanId === scanId) {
        setFindings((prev) => {
          const idx = prev.findIndex((f) => f.fingerprint === newFinding.fingerprint);
          if (idx !== -1) {
            // Update occurrence count
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              occurrenceCount: (updated[idx].occurrenceCount || 1) + 1,
              occurrences: newFinding.occurrences || updated[idx].occurrences
            };
            return updated;
          }
          return [newFinding, ...prev];
        });
      }
    };

    const handleCompleted = (data) => {
      if (data.scanId === scanId) {
        setScan((prev) => ({
          ...prev,
          status: 'COMPLETED',
          currentStage: 'COMPLETED',
          progress: 100,
          durationMs: data.durationMs,
          findingsSummary: data.findingsSummary || prev.findingsSummary
        }));
        // Reload persisted findings from backend
        getScanFindings(scanId, {}, token).then((res) => {
          if (res.ok && res.data?.findings) {
            setFindings(res.data.findings);
          }
        });
      }
    };

    const handleCancelled = (data) => {
      if (data.scanId === scanId) {
        setScan((prev) => ({
          ...prev,
          status: 'CANCELLED',
          currentStage: 'CANCELLED'
        }));
      }
    };

    const handleFailed = (data) => {
      if (data.scanId === scanId) {
        setScan((prev) => ({
          ...prev,
          status: 'FAILED',
          currentStage: 'FAILED',
          errorSummary: data.error || 'Scan encountered an error.'
        }));
      }
    };

    socket.on('scan:progress', handleProgress);
    socket.on('scan:finding', handleFinding);
    socket.on('scan:completed', handleCompleted);
    socket.on('scan:cancelled', handleCancelled);
    socket.on('scan:failed', handleFailed);

    return () => {
      socket.off('scan:progress', handleProgress);
      socket.off('scan:finding', handleFinding);
      socket.off('scan:completed', handleCompleted);
      socket.off('scan:cancelled', handleCancelled);
      socket.off('scan:failed', handleFailed);
      unsubscribeFromScan(scanId);
    };
  }, [scanId, token]);

  const handleCancelScan = async () => {
    if (!window.confirm('Are you sure you want to stop this diagnostic scan?')) return;
    setCancelling(true);
    const res = await cancelScan(scanId, token);
    setCancelling(false);
    if (res.ok && res.data?.scan) {
      setScan(res.data.scan);
    } else {
      alert(res.error || 'Failed to cancel scan.');
    }
  };

  const handleViewOrGenerateReport = async () => {
    setGeneratingReport(true);
    const res = await createOrGetReport(scanId, token);
    setGeneratingReport(false);
    if (res.ok && res.data?.report) {
      navigate(`/reports/${res.data.report._id || res.data.report.id}`);
    } else {
      alert(res.error || 'Failed to generate diagnostic report.');
    }
  };

  const handleFindingValidated = (updatedFinding) => {
    setFindings((prev) =>
      prev.map((f) =>
        (f._id === updatedFinding._id || f.id === updatedFinding.id || f.fingerprint === updatedFinding.fingerprint)
          ? updatedFinding
          : f
      )
    );
  };

  const handleExploratoryCreated = (newFinding) => {
    setFindings((prev) => [newFinding, ...prev]);
  };

  const toggleExpand = (fId) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [fId]: !prev[fId]
    }));
  };

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
    if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
    if (confidenceFilter !== 'ALL' && f.confidence !== confidenceFilter) return false;
    if (validationFilter !== 'ALL') {
      const vStatus = f.humanValidation?.status || 'unreviewed';
      if (validationFilter === 'reviewed') {
        if (vStatus === 'unreviewed') return false;
      } else if (validationFilter !== vStatus) {
        return false;
      }
    }
    return true;
  });

  const isOwner = scan?.targetId?.owner?.toString() === user?._id?.toString() ||
                  scan?.targetId?.owner?._id?.toString() === user?._id?.toString();
  const isActive = scan?.status === 'QUEUED' || scan?.status === 'RUNNING';

  // Format duration
  const formatDuration = (ms) => {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
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

  const statusBadges = {
    QUEUED: <span className="ts-badge badge-slate">Queued</span>,
    RUNNING: (
      <span className="ts-badge badge-indigo flex items-center gap-1">
        <div className="animate-spin" style={{ width: '10px', height: '10px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
        <span>Running Diagnostics</span>
      </span>
    ),
    COMPLETED: <span className="ts-badge badge-success">Completed</span>,
    PARTIALLY_COMPLETED: <span className="ts-badge badge-warning">Partially Completed</span>,
    FAILED: <span className="ts-badge badge-danger">Failed</span>,
    CANCELLED: <span className="ts-badge badge-slate">Cancelled</span>
  };

  if (loading && !scan) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto' }} />
        <p className="text-sm text-muted" style={{ marginTop: 'var(--space-3)' }}>
          Loading diagnostic scan session...
        </p>
      </div>
    );
  }

  if (error && !scan) {
    return (
      <div className="flex flex-col gap-4">
        <div className="alert-banner error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <Link to="/targets" className="ts-btn ts-btn-outline" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} />
          <span>Return to Targets</span>
        </Link>
      </div>
    );
  }

  const target = scan?.targetId || {};
  const targetSnapshot = scan?.targetSnapshot || {};

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Breadcrumb & Actions */}
      <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="flex items-center gap-3">
          <Link to="/targets" className="ts-btn ts-btn-outline" style={{ padding: '6px 10px' }} title="Back to targets">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Diagnostic Session</span>
              <span className="text-xs font-mono text-muted">#{scanId.slice(-8)}</span>
              {statusBadges[scan?.status] || <span className="ts-badge badge-slate">{scan?.status}</span>}
            </div>
            <h1 style={{ fontSize: '1.4rem', marginTop: '2px' }}>
              {target.name || targetSnapshot.name || 'Automated Web Scan'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          {/* Tester / Developer Exploratory Bug Logging */}
          <button
            id="log-exploratory-finding-btn"
            onClick={() => setShowExploratoryModal(true)}
            className="ts-btn ts-btn-outline"
            style={{ fontSize: '0.85rem', height: '36px', gap: '6px' }}
            title="Log manual exploratory finding"
          >
            <PlusCircle size={15} style={{ color: 'var(--color-primary)' }} />
            <span>Log Bug / Finding</span>
          </button>

          {/* Diagnostic Assessment Report (Phase 4) */}
          {scan?.status !== 'QUEUED' && (
            <button
              id="view-diagnostic-report-btn"
              onClick={handleViewOrGenerateReport}
              disabled={generatingReport || isActive}
              className="ts-btn ts-btn-primary"
              style={{ fontSize: '0.85rem', height: '36px', gap: '6px' }}
              title={isActive ? 'Report will be available once scan completes' : 'Generate or view executive assessment report'}
            >
              <FileText size={15} />
              <span>{generatingReport ? 'Compiling Report...' : 'Diagnostic Report'}</span>
            </button>
          )}

          {isActive && isOwner && (
            <button
              id="cancel-active-scan-btn"
              onClick={handleCancelScan}
              disabled={cancelling}
              className="ts-btn ts-btn-outline"
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', fontSize: '0.85rem', height: '36px' }}
            >
              <StopCircle size={15} />
              <span>{cancelling ? 'Stopping...' : 'Cancel Scan'}</span>
            </button>
          )}

          <button
            onClick={loadScanData}
            disabled={loading}
            className="ts-btn ts-btn-outline"
            style={{ height: '36px', padding: '0 10px' }}
            title="Refresh scan data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Target & Scope Info Bar */}
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
            {target.targetUrl || targetSnapshot.targetUrl}
          </span>
          <a
            href={target.targetUrl || targetSnapshot.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted"
            title="Open target in new tab"
          >
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted" style={{ flexWrap: 'wrap' }}>
          <div>
            Scope Host: <strong className="font-mono text-dark">{targetSnapshot.allowedHost || target.authorizedScope?.allowedHost || '—'}</strong>
          </div>
          <div>
            Max Pages: <strong className="text-dark">{targetSnapshot.maxPages || 25}</strong>
          </div>
          <div>
            Max Depth: <strong className="text-dark">{targetSnapshot.maxDepth || 3}</strong>
          </div>
          <div>
            Rate Limit: <strong className="text-dark">{targetSnapshot.rateLimitRps || 2} req/s</strong>
          </div>
        </div>
      </div>

      {/* Failure Banner if applicable */}
      {scan?.status === 'FAILED' && scan?.errorSummary && (
        <div className="alert-banner error">
          <AlertCircle size={18} />
          <div>
            <strong>Scan Aborted:</strong> {scan.errorSummary}
          </div>
        </div>
      )}

      {/* Live Stage Progress Indicator */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Engine Telemetry Stage
              </span>
              <strong className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>
                {scan?.currentStage || 'QUEUED'}
              </strong>
            </div>
            <span className="text-xs font-semibold font-mono" style={{ color: 'var(--color-text-primary)' }}>
              {scan?.progress || 0}%
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--slate-100)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${scan?.progress || 0}%`,
                height: '100%',
                backgroundColor: scan?.status === 'FAILED' ? 'var(--color-error)' : 'var(--color-primary)',
                transition: 'width 0.4s ease-in-out'
              }}
            />
          </div>

          {/* Micro-stages checklist */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 'var(--space-2)',
              marginTop: '4px',
              fontSize: '0.7rem',
              textAlign: 'center'
            }}
          >
            <span style={{ color: scan?.progress >= 10 ? 'var(--color-success)' : 'var(--slate-400)', fontWeight: 500 }}>
              1. DNS & SSRF Check
            </span>
            <span style={{ color: scan?.progress >= 15 ? 'var(--color-success)' : 'var(--slate-400)', fontWeight: 500 }}>
              2. Browser Worker
            </span>
            <span style={{ color: scan?.progress >= 20 ? 'var(--color-success)' : 'var(--slate-400)', fontWeight: 500 }}>
              3. Crawling & Analyzers
            </span>
            <span style={{ color: scan?.progress >= 95 ? 'var(--color-success)' : 'var(--slate-400)', fontWeight: 500 }}>
              4. Deduplication
            </span>
            <span style={{ color: scan?.progress === 100 ? 'var(--color-success)' : 'var(--slate-400)', fontWeight: 500 }}>
              5. Finalized
            </span>
          </div>
        </div>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-4">
        <Card>
          <span className="text-xs text-muted font-medium">Pages Scanned</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
            {scan?.pagesScanned || 0}
            <span className="text-xs text-muted font-normal"> / {scan?.pagesDiscovered || 0} discovered</span>
          </div>
        </Card>

        <Card>
          <span className="text-xs text-muted font-medium">Unique Findings</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: findings.length > 0 ? 'var(--color-primary)' : 'var(--color-success)', marginTop: '2px' }}>
            {findings.length}
          </div>
        </Card>

        <Card>
          <span className="text-xs text-muted font-medium">Confirmed / Suspected</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
            {findings.filter((f) => f.confidence === 'Confirmed').length}
            <span className="text-xs text-muted font-normal"> / {findings.filter((f) => f.confidence === 'Suspected').length}</span>
          </div>
        </Card>

        <Card>
          <span className="text-xs text-muted font-medium">Execution Duration</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
            {formatDuration(scan?.durationMs)}
          </div>
        </Card>
      </div>

      {/* Findings Section */}
      <div className="flex flex-col gap-4">
        {/* Filter Controls Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="flex items-center gap-2">
            <Filter size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Diagnostic Findings</span>
            <span className="ts-badge badge-slate font-mono text-xs">{filteredFindings.length}</span>
          </div>

          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="ts-form-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', height: '32px' }}
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Info">Info</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="ts-form-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', height: '32px' }}
            >
              <option value="ALL">All Analyzers</option>
              <option value="runtime_error">Runtime Error</option>
              <option value="console_error">Console Error</option>
              <option value="network_failure">Network Failure</option>
              <option value="broken_link">Broken Link</option>
              <option value="security_header">Security Header</option>
              <option value="performance">Performance</option>
              <option value="accessibility">Accessibility (WCAG)</option>
            </select>

            {/* Confidence Filter */}
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="ts-form-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', height: '32px' }}
            >
              <option value="ALL">All Confidence</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Suspected">Suspected (Heuristic)</option>
            </select>

            {/* Human Tester Validation Filter */}
            <select
              value={validationFilter}
              onChange={(e) => setValidationFilter(e.target.value)}
              className="ts-form-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', height: '32px' }}
            >
              <option value="ALL">All Validation States</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Any Reviewed</option>
              <option value="confirmed">Confirmed</option>
              <option value="false_positive">False Positive</option>
              <option value="fixed">Marked Fixed</option>
              <option value="retested_pass">Retested (Passed)</option>
            </select>
          </div>
        </div>

        {/* Empty Findings State */}
        {filteredFindings.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-12) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            {isActive ? (
              <>
                <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto var(--space-3) auto' }} />
                <h3>Scanning in progress...</h3>
                <p className="text-sm text-muted" style={{ maxWidth: '420px', margin: 'var(--space-2) auto 0 auto' }}>
                  The browser worker is navigating pages and evaluating diagnostic analyzers. Findings will appear here in real time as they are discovered.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 size={36} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-3) auto' }} />
                <h3>No findings matching filter criteria</h3>
                <p className="text-sm text-muted" style={{ maxWidth: '440px', margin: 'var(--space-2) auto 0 auto' }}>
                  {findings.length === 0
                    ? 'No diagnostic issues were detected during this scan within the crawled pages.'
                    : 'Try clearing or adjusting your active filter options above.'}
                </p>
              </>
            )}
          </div>
        )}

        {/* Findings List */}
        {filteredFindings.map((finding) => {
          const fId = finding._id || finding.id || finding.fingerprint;
          const isExpanded = !!expandedFindings[fId];

          return (
            <div
              key={fId}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden'
              }}
            >
              {/* Finding Main Card Header */}
              <div
                onClick={() => toggleExpand(fId)}
                style={{
                  padding: 'var(--space-4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  backgroundColor: isExpanded ? 'var(--slate-50)' : '#ffffff'
                }}
              >
                <div className="flex items-start gap-3" style={{ flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--slate-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                  >
                    {categoryIcons[finding.category] || <Bug size={14} />}
                  </div>

                  <div className="flex flex-col gap-1" style={{ flex: 1 }}>
                    <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                      <span className={`ts-badge ${severityBadges[finding.severity] || 'badge-slate'}`}>
                        {finding.severity}
                      </span>
                      <span
                        className="ts-badge"
                        style={{
                          backgroundColor: finding.confidence === 'Confirmed' ? '#ecfdf5' : '#fef3c7',
                          color: finding.confidence === 'Confirmed' ? '#065f46' : '#92400e',
                          border: `1px solid ${finding.confidence === 'Confirmed' ? '#a7f3d0' : '#fde68a'}`
                        }}
                      >
                        {finding.confidence}
                      </span>
                      <span className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                        {finding.category.replace('_', ' ')}
                      </span>
                      {finding.occurrenceCount > 1 && (
                        <span className="ts-badge badge-slate" title="Deduplicated occurrences">
                          Seen {finding.occurrenceCount}x
                        </span>
                      )}

                      {/* Human Tester Validation Badge */}
                      {finding.humanValidation?.status === 'confirmed' && (
                        <span className="ts-badge badge-success flex items-center gap-1" title="Confirmed by human tester">
                          <CheckCircle2 size={11} /> Confirmed
                        </span>
                      )}
                      {finding.humanValidation?.status === 'false_positive' && (
                        <span className="ts-badge badge-danger flex items-center gap-1" title="Marked as false positive">
                          <XCircle size={11} /> False Positive
                        </span>
                      )}
                      {finding.humanValidation?.status === 'fixed' && (
                        <span className="ts-badge badge-indigo flex items-center gap-1" title="Marked as fixed">
                          <CheckSquare size={11} /> Fixed
                        </span>
                      )}
                      {(finding.humanValidation?.status === 'retested_pass' || finding.humanValidation?.status === 'retested_passed') && (
                        <span className="ts-badge badge-success flex items-center gap-1" title="Retested and passed">
                          <CheckCircle2 size={11} /> Retested (Pass)
                        </span>
                      )}
                      {(finding.humanValidation?.status === 'retested_fail' || finding.humanValidation?.status === 'retested_failed') && (
                        <span className="ts-badge badge-danger flex items-center gap-1" title="Retested and failed">
                          <XCircle size={11} /> Retested (Fail)
                        </span>
                      )}
                      {(!finding.humanValidation || finding.humanValidation.status === 'unreviewed') && (
                        <span className="ts-badge badge-slate" title="Unreviewed by human tester">
                          Unreviewed
                        </span>
                      )}
                      {finding.exploratory && (
                        <span className="ts-badge badge-indigo" title="Exploratory manual finding">
                          Exploratory
                        </span>
                      )}
                    </div>

                    <h4 style={{ margin: '4px 0 2px 0', fontSize: '0.975rem', fontWeight: 600 }}>
                      {finding.title}
                    </h4>

                    <p className="text-sm text-secondary" style={{ margin: 0 }}>
                      {finding.description}
                    </p>

                    <div className="flex items-center gap-2 font-mono text-xs text-muted" style={{ marginTop: '4px' }}>
                      <Globe size={11} />
                      <span className="truncate" style={{ maxWidth: '600px' }}>
                        {finding.affectedUrl}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFindingForValidation(finding);
                      setShowValidationModal(true);
                    }}
                    className="ts-btn ts-btn-outline"
                    style={{ padding: '4px 10px', fontSize: '0.78rem', height: '28px', gap: '4px' }}
                    title="Validate issue (Confirm, False Positive, Retest)"
                  >
                    <CheckSquare size={13} />
                    <span>Validate</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFindingForDuplicates(finding);
                      setShowDuplicatesModal(true);
                    }}
                    className="ts-btn ts-btn-outline"
                    style={{ padding: '4px 8px', fontSize: '0.78rem', height: '28px', gap: '4px' }}
                    title="Check duplicate findings via fingerprint and text similarity"
                  >
                    <Copy size={13} />
                    <span>Duplicates</span>
                  </button>
                  <span className="text-xs text-muted font-medium" style={{ marginLeft: '4px' }}>
                    {isExpanded ? 'Hide' : 'Evidence'}
                  </span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Collapsible Details Drawer */}
              {isExpanded && (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-4)'
                  }}
                >
                  {/* Reproduction Steps */}
                  {finding.reproductionSteps && finding.reproductionSteps.length > 0 && (
                    <div>
                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Reproduction Steps
                      </h5>
                      <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                        {finding.reproductionSteps.map((step, sIdx) => (
                          <li key={sIdx} style={{ marginBottom: '4px' }}>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Evidence Object */}
                  {finding.evidence && Object.keys(finding.evidence).length > 0 && (
                    <div>
                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Structured Evidence Captured
                      </h5>
                      <pre
                        style={{
                          backgroundColor: 'var(--slate-900)',
                          color: '#f8fafc',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-mono)',
                          overflowX: 'auto',
                          maxHeight: '260px',
                          margin: 0
                        }}
                      >
                        {JSON.stringify(finding.evidence, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Remediation Advice */}
                  {finding.remediation && (
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#eff6ff',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid #bfdbfe',
                        fontSize: '0.825rem',
                        color: '#1e40af'
                      }}
                    >
                      <strong>Recommended Remediation:</strong>
                      <div style={{ marginTop: '2px' }}>{finding.remediation}</div>
                    </div>
                  )}

                  {/* Human Validation & Tester Review Section */}
                  {finding.humanValidation && finding.humanValidation.status !== 'unreviewed' && (
                    <div
                      style={{
                        padding: '12px 14px',
                        backgroundColor: finding.humanValidation.status === 'false_positive' ? '#fef2f2' : '#f0fdf4',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${finding.humanValidation.status === 'false_positive' ? '#fecaca' : '#bbf7d0'}`,
                        fontSize: '0.825rem'
                      }}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                        <strong style={{ color: finding.humanValidation.status === 'false_positive' ? '#991b1b' : '#166534' }}>
                          Human Review: {finding.humanValidation.status.replace('_', ' ').toUpperCase()}
                        </strong>
                        {finding.humanValidation.validatedAt && (
                          <span className="text-xs text-muted">
                            {new Date(finding.humanValidation.validatedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {finding.humanValidation.validatedBy?.name && (
                        <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>
                          Reviewed by: <strong>{finding.humanValidation.validatedBy.name}</strong> ({finding.humanValidation.validatedBy.role || 'Tester'})
                        </div>
                      )}
                      {finding.humanValidation.notes && (
                        <div style={{ marginTop: '4px' }}>
                          <strong>Tester Notes:</strong> {finding.humanValidation.notes}
                        </div>
                      )}
                      {finding.humanValidation.reason && (
                        <div style={{ marginTop: '4px', color: '#991b1b' }}>
                          <strong>False Positive Reason:</strong> {finding.humanValidation.reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Activity History Log */}
                  {finding.activityHistory && finding.activityHistory.length > 0 && (
                    <div>
                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Activity & Review Trail
                      </h5>
                      <div className="flex flex-col gap-2">
                        {finding.activityHistory.map((act, aIdx) => (
                          <div
                            key={aIdx}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: 'var(--slate-50)',
                              border: '1px solid var(--slate-200)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.78rem'
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <strong>{act.action}</strong>
                              <span className="text-xs text-muted">
                                {act.timestamp ? new Date(act.timestamp).toLocaleTimeString() : ''}
                              </span>
                            </div>
                            {act.notes && <div className="text-muted" style={{ marginTop: '2px' }}>{act.notes}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deterministic Fingerprint Meta */}
                  <div className="flex items-center justify-between text-xs text-muted" style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '8px' }}>
                    <div className="flex items-center gap-1">
                      <span>Fingerprint:</span>
                      <code className="font-mono text-xs">{finding.fingerprint?.slice(0, 16)}...</code>
                    </div>
                    <span>Source: {finding.source}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tester Collaboration Modals */}
      <ValidationModal
        finding={selectedFindingForValidation}
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        onValidated={handleFindingValidated}
      />

      <DuplicateSuggestionsModal
        finding={selectedFindingForDuplicates}
        isOpen={showDuplicatesModal}
        onClose={() => setShowDuplicatesModal(false)}
      />

      <ExploratoryFindingModal
        scanId={scanId}
        targetId={target._id || target.id || scan?.targetId?._id || scan?.targetId}
        isOpen={showExploratoryModal}
        onClose={() => setShowExploratoryModal(false)}
        onCreated={handleExploratoryCreated}
      />
    </div>
  );
}
