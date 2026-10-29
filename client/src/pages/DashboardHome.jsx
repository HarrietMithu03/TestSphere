import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Server,
  Database,
  Radio,
  Zap,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Shield,
  Layers,
  ArrowRight,
  Code2,
  Bug,
  UserCheck,
  LogIn,
  FileText,
  Globe,
  Activity,
  CheckSquare,
  Clock,
  ExternalLink
} from 'lucide-react';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import {
  getHealthStatus,
  pingApi,
  API_BASE_URL,
  runLiveBenchmark,
  getScanById,
  getScanFindings,
  getTargets
} from '../services/api';
import {
  pingSocket,
  SOCKET_URL,
  getSocket,
  subscribeToScan,
  unsubscribeFromScan
} from '../services/socket';
import { useAuth } from '../context/AuthContext';

export default function DashboardHome() {
  const { isSocketConnected, isApiHealthy } = useOutletContext();
  const { user, token, isAuthenticated } = useAuth();
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [testLog, setTestLog] = useState([]);
  const [isTesting, setIsTesting] = useState(false);
  const [roleNotice, setRoleNotice] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [benchmarkProgress, setBenchmarkProgress] = useState(null);

  // Targets state for application selection
  const [userTargets, setUserTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [targetsLoading, setTargetsLoading] = useState(false);

  const activePollRef = useRef(null);
  const activeScanIdRef = useRef(null);

  // Fetch full health payload on mount
  const fetchHealth = async () => {
    setHealthLoading(true);
    const result = await getHealthStatus();
    if (result.ok) {
      setHealthData(result.data);
    } else {
      setHealthData(null);
    }
    setHealthLoading(false);
  };

  // Fetch user's accessible targets
  const fetchUserTargets = async () => {
    if (!token) return;
    setTargetsLoading(true);
    const res = await getTargets(token);
    if (res.ok && res.data?.targets) {
      setUserTargets(res.data.targets);
      if (res.data.targets.length > 0) {
        if (user?.role === 'tester') {
          setSelectedTargetId(res.data.targets[0]._id || res.data.targets[0].id);
        }
      }
    }
    setTargetsLoading(false);
  };

  useEffect(() => {
    fetchHealth();
    if (isAuthenticated) {
      fetchUserTargets();
    }

    return () => {
      if (activePollRef.current) {
        clearInterval(activePollRef.current);
      }
      if (activeScanIdRef.current) {
        unsubscribeFromScan(activeScanIdRef.current);
      }
    };
  }, [isAuthenticated, token, user?.role]);

  // Run comprehensive connectivity benchmark and automated Playwright diagnostics
  const handleRunDiagnostic = async () => {
    if (isTesting) return; // Prevent duplicate concurrent submissions

    setRoleNotice(null);
    setBenchmarkProgress(null);
    setIsTesting(true);
    const logs = [];

    // Step 1: REST API Ping
    logs.push({
      step: 'REST API',
      action: `GET ${API_BASE_URL}/health/ping`,
      timestamp: new Date().toLocaleTimeString()
    });

    const pingRes = await pingApi();
    if (pingRes.ok) {
      logs.push({
        step: 'REST API',
        action: `Success: Received '${pingRes.data?.message}' in ${pingRes.latency}ms`,
        status: 'pass',
        timestamp: new Date().toLocaleTimeString()
      });
    } else {
      logs.push({
        step: 'REST API',
        action: `Failed: ${pingRes.error}`,
        status: 'fail',
        timestamp: new Date().toLocaleTimeString()
      });
    }

    // Step 2: Database Check via Health Endpoint
    logs.push({
      step: 'Database',
      action: 'Checking MongoDB readyState via health check...',
      timestamp: new Date().toLocaleTimeString()
    });

    const healthRes = await getHealthStatus();
    if (healthRes.ok && healthRes.data?.components?.database?.isHealthy) {
      logs.push({
        step: 'Database',
        action: `Success: MongoDB state is '${healthRes.data.components.database.status}'`,
        status: 'pass',
        timestamp: new Date().toLocaleTimeString()
      });
      setHealthData(healthRes.data);
    } else {
      logs.push({
        step: 'Database',
        action: `Degraded: MongoDB state is '${healthRes.data?.components?.database?.status || 'unreachable'}'`,
        status: 'fail',
        timestamp: new Date().toLocaleTimeString()
      });
    }

    // Step 3: WebSocket Ping
    logs.push({
      step: 'Socket.IO',
      action: `Emitting 'system:ping' to ${SOCKET_URL}...`,
      timestamp: new Date().toLocaleTimeString()
    });

    try {
      const socketRes = await pingSocket();
      logs.push({
        step: 'Socket.IO',
        action: `Success: Received '${socketRes.response?.message}' in ${socketRes.latency}ms round-trip`,
        status: 'pass',
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (err) {
      logs.push({
        step: 'Socket.IO',
        action: `Warning: ${err.message}`,
        status: 'fail',
        timestamp: new Date().toLocaleTimeString()
      });
    }

    setTestLog([...logs]);

    // Step 4: Role-based Authorization & Live Automated Benchmark Execution
    if (!isAuthenticated) {
      logs.push({
        step: 'Auth Check',
        action: 'Unauthenticated request: Automated diagnostic scans require Developer or Tester credentials.',
        status: 'fail',
        timestamp: new Date().toLocaleTimeString()
      });
      setRoleNotice({
        type: 'auth_required',
        title: 'Authentication Required to Launch Live Benchmark',
        message: 'The Live Benchmark runs browser crawling and real diagnostic checks against the test fixture or assigned target application. Please sign in to execute scans.',
        actionLink: '/login',
        actionLabel: 'Sign In to TestSphere'
      });
      setTestLog([...logs]);
      setIsTesting(false);
      return;
    }

    // Role check: If tester has no assigned targets, explain that a Developer must assign one first
    if (user?.role === 'tester' && userTargets.length === 0 && !selectedTargetId) {
      logs.push({
        step: 'Target Scope',
        action: 'No application assigned: Testers can only run Live Benchmarks on applications assigned by a Developer.',
        status: 'fail',
        timestamp: new Date().toLocaleTimeString()
      });

      setRoleNotice({
        type: 'tester_no_targets',
        title: 'No Applications Assigned to Tester Account',
        message: 'As a Tester, you can run Live Benchmarks and diagnostic scans against applications assigned to you. A Developer must assign an application to your account before you can launch scans.',
        actionLink: '/targets',
        actionLabel: 'View Applications Page'
      });
      setTestLog([...logs]);
      setIsTesting(false);
      return;
    }

    // Target name resolution for log
    let targetName = 'Controlled Test Fixture (http://127.0.0.1:5050)';
    if (selectedTargetId) {
      const matched = userTargets.find((t) => (t._id || t.id) === selectedTargetId);
      if (matched) {
        targetName = `${matched.name} (${matched.targetUrl})`;
      }
    } else if (user?.role === 'tester' && userTargets.length > 0) {
      targetName = `${userTargets[0].name} (${userTargets[0].targetUrl})`;
    }

    logs.push({
      step: 'Live Benchmark',
      action: `Initiating automated diagnostic benchmark against ${targetName}...`,
      timestamp: new Date().toLocaleTimeString()
    });
    setTestLog([...logs]);

    const targetToLaunch = selectedTargetId || (user?.role === 'tester' && userTargets.length > 0 ? (userTargets[0]._id || userTargets[0].id) : null);
    const benchRes = await runLiveBenchmark(token, targetToLaunch);
    if (!benchRes.ok) {
      logs.push({
        step: 'Live Benchmark',
        action: `Benchmark failed to launch: ${benchRes.error}`,
        status: 'fail',
        timestamp: new Date().toLocaleTimeString()
      });
      setRoleNotice({
        type: 'benchmark_error',
        title: 'Benchmark Execution Error',
        message: benchRes.error || 'Failed to initiate benchmark scan on target application.',
        actionLink: '/targets',
        actionLabel: 'Check Applications'
      });
      setTestLog([...logs]);
      setIsTesting(false);
      return;
    }

    const scanData = benchRes.data?.scan;
    const scanId = scanData?.id || scanData?._id;
    activeScanIdRef.current = scanId;

    logs.push({
      step: 'Live Benchmark',
      action: `Job queued (Scan ID: ${scanId}). Initializing Playwright browser automation...`,
      status: 'pass',
      timestamp: new Date().toLocaleTimeString()
    });
    setTestLog([...logs]);

    setBenchmarkProgress({
      scanId,
      status: scanData?.status || 'QUEUED',
      stage: scanData?.currentStage || 'QUEUED',
      progress: scanData?.progress || 0,
      pagesScanned: scanData?.pagesScanned || 0
    });

    // Subscribe to Socket.IO scan room for real-time updates
    subscribeToScan(scanId, token);
    const socket = getSocket();

    const handleSocketProgress = (data) => {
      if (data.scanId === scanId) {
        setBenchmarkProgress((prev) => ({
          ...prev,
          status: 'RUNNING',
          stage: data.currentStage || data.stage || prev?.stage,
          progress: data.progress !== undefined ? data.progress : prev?.progress,
          pagesScanned: data.pagesScanned !== undefined ? data.pagesScanned : prev?.pagesScanned
        }));
      }
    };

    socket.on('scan:progress', handleSocketProgress);

    // Polling fallback to ensure completion detection
    let isFinished = false;
    const pollInterval = setInterval(async () => {
      if (isFinished) return;

      const pollRes = await getScanById(scanId, token);
      if (pollRes.ok && pollRes.data?.scan) {
        const currentScan = pollRes.data.scan;
        setBenchmarkProgress({
          scanId,
          status: currentScan.status,
          stage: currentScan.currentStage,
          progress: currentScan.progress,
          pagesScanned: currentScan.pagesScanned
        });

        if (['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'].includes(currentScan.status)) {
          isFinished = true;
          clearInterval(pollInterval);
          activePollRef.current = null;
          socket.off('scan:progress', handleSocketProgress);
          unsubscribeFromScan(scanId);

          if (currentScan.status === 'COMPLETED' || currentScan.status === 'PARTIALLY_COMPLETED') {
            const findingsRes = await getScanFindings(scanId, {}, token);
            const findingsList = findingsRes.ok && findingsRes.data?.findings ? findingsRes.data.findings : [];

            const durationSec = Math.round((currentScan.durationMs || 0) / 1000);

            logs.push({
              step: 'Live Benchmark',
              action: `Completed: ${findingsList.length} real findings verified across ${currentScan.pagesScanned} pages (${durationSec}s runtime).`,
              status: 'pass',
              timestamp: new Date().toLocaleTimeString()
            });

            setBenchmarkResult({
              scanId,
              targetUrl: currentScan.targetSnapshot?.targetUrl || 'http://127.0.0.1:5050',
              targetName: currentScan.targetSnapshot?.name || 'Controlled Test Fixture (Live Benchmark)',
              pagesScanned: currentScan.pagesScanned,
              durationSeconds: durationSec,
              status: currentScan.status,
              findingsSummary: currentScan.findingsSummary || { total: findingsList.length },
              findings: findingsList
            });
          } else {
            logs.push({
              step: 'Live Benchmark',
              action: `Scan terminated with status '${currentScan.status}': ${currentScan.errorSummary || 'Scan execution error'}`,
              status: 'fail',
              timestamp: new Date().toLocaleTimeString()
            });
          }

          setTestLog([...logs]);
          setIsTesting(false);
        }
      }
    }, 1500);

    activePollRef.current = pollInterval;
  };
  const dbState = healthData?.components?.database?.status || 'disconnected';
  const isDbHealthy = healthData?.components?.database?.isHealthy || false;

  return (
    <div className="flex flex-col gap-6">
      {/* User Welcome / Auth State Callout */}
      {isAuthenticated ? (
        <div style={{
          backgroundColor: user?.role === 'developer' ? '#eef2ff' : '#ecfdf5',
          border: `1.5px solid ${user?.role === 'developer' ? '#c7d2fe' : '#a7f3d0'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)'
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: user?.role === 'developer' ? 'var(--color-primary)' : 'var(--color-success)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {user?.role === 'developer' ? <Code2 size={20} /> : <Bug size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Welcome back, {user?.name}!
                </span>
                <span className={`ts-badge ${user?.role === 'developer' ? 'badge-indigo' : 'badge-success'}`}>
                  {user?.role === 'developer' ? 'Developer Workspace' : 'Tester Workspace'}
                </span>
              </div>
              <p className="text-xs text-muted" style={{ marginTop: '2px' }}>
                Signed in with verified JWT &bull; Email: <strong>{user?.email}</strong> &bull; Role:{' '}
                {user?.role === 'developer'
                  ? 'Application registration, Playwright diagnostic scans, axe-core WCAG audits, and executive reports'
                  : 'Target testing, Live Benchmark diagnostics, finding validation, false positive review, and exploratory bug logging'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <Link
              id="dashboard-targets-cta-btn"
              to="/targets"
              className="ts-btn ts-btn-primary"
              style={{ height: '36px', fontSize: '0.85rem' }}
            >
              <span>Applications</span>
              <ArrowRight size={15} />
            </Link>
            <Link
              id="dashboard-scans-cta-btn"
              to="/scans"
              className="ts-btn ts-btn-outline"
              style={{ height: '36px', fontSize: '0.85rem' }}
            >
              <Activity size={15} />
              <span>Scans</span>
            </Link>
            <Link
              id="dashboard-reports-cta-btn"
              to="/reports"
              className="ts-btn ts-btn-outline"
              style={{ height: '36px', fontSize: '0.85rem' }}
            >
              <FileText size={15} />
              <span>Reports</span>
            </Link>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--indigo-50)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserCheck size={18} />
            </div>
            <div>
              <span style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Application Diagnostics Platform Ready
              </span>
              <p className="text-xs text-muted" style={{ marginTop: '2px' }}>
                Sign in or register as a Developer or Tester to access automated web scanning, human validation, and diagnostic reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className="ts-btn ts-btn-outline" style={{ height: '36px', fontSize: '0.85rem' }}>
              <LogIn size={15} />
              <span>Sign In</span>
            </Link>
            <Link to="/register" className="ts-btn ts-btn-primary" style={{ height: '36px', fontSize: '0.85rem' }}>
              <span>Create Account</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {/* Role-based Authorization / Workflow Notice Banner */}
      {roleNotice && (
        <div style={{
          backgroundColor: roleNotice.type === 'auth_required' ? '#fffbeb' : '#eff6ff',
          border: `1.5px solid ${roleNotice.type === 'auth_required' ? '#fde68a' : '#bfdbfe'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: roleNotice.type === 'auth_required' ? '#d97706' : '#2563eb',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {roleNotice.type === 'auth_required' ? <AlertTriangle size={20} /> : <Shield size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 700, color: '#1e293b' }}>
                  {roleNotice.title}
                </h4>
                <span className="ts-badge badge-warning" style={{ fontSize: '0.7rem' }}>
                  {roleNotice.type === 'auth_required' ? 'Sign In Needed' : 'Tester Permitted Workflow'}
                </span>
              </div>
              <p className="text-xs text-muted" style={{ margin: '4px 0 0 0', maxWidth: '780px', lineHeight: 1.5 }}>
                {roleNotice.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              id="role-notice-action-btn"
              to={roleNotice.actionLink}
              className="ts-btn ts-btn-primary"
              style={{ height: '36px', fontSize: '0.85rem' }}
            >
              <span>{roleNotice.actionLabel}</span>
              <ArrowRight size={15} />
            </Link>
            <button
              id="role-notice-dismiss-btn"
              onClick={() => setRoleNotice(null)}
              className="ts-btn ts-btn-outline"
              style={{ height: '36px', fontSize: '0.85rem' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-8) var(--space-8)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span className="ts-badge badge-indigo">Diagnostics Platform</span>
              <span className="text-xs text-muted">Playwright Automation &bull; axe-core &bull; Human Validation</span>
            </div>
            <h1>TestSphere Quality & Bug Intelligence</h1>
            <p style={{ marginTop: 'var(--space-2)', maxWidth: '680px', fontSize: '0.95rem' }}>
              Professional application diagnostics platform. Register authorized targets, execute real-time automated browser diagnostics, evaluate WCAG accessibility via axe-core, review structured evidence, collaborate with human testers, and export PDF diagnostic reports.
            </p>
          </div>

          <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
            {isAuthenticated && userTargets.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-medium">Target:</span>
                <select
                  id="dashboard-target-selector"
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  disabled={isTesting}
                  className="ts-form-input"
                  style={{
                    height: '38px',
                    padding: '4px 10px',
                    fontSize: '0.85rem',
                    width: 'auto',
                    maxWidth: '260px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {user?.role === 'developer' && (
                    <option value="">Controlled Fixture (127.0.0.1:5050)</option>
                  )}
                  {userTargets.map((t) => (
                    <option key={t._id || t.id} value={t._id || t.id}>
                      {t.name} ({t.environment})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              id="run-benchmark-btn"
              onClick={handleRunDiagnostic}
              disabled={isTesting}
              className="ts-btn ts-btn-primary"
            >
              {isTesting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Run Live Benchmark
                </>
              )}
            </button>
            <button
              id="refresh-health-btn"
              onClick={fetchHealth}
              disabled={healthLoading}
              className="ts-btn ts-btn-outline"
              title="Refresh health data"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Live Benchmark Execution Banner */}
      {isTesting && benchmarkProgress && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1.5px solid var(--indigo-200)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5) var(--space-6)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div className="flex items-center gap-3">
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--indigo-100)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <RefreshCw size={18} className="animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Live Diagnostic Benchmark Running
                  </span>
                  <span className="ts-badge badge-indigo">
                    Stage: {benchmarkProgress.stage}
                  </span>
                </div>
                <p className="text-xs text-muted" style={{ marginTop: '2px' }}>
                  Target: <code>http://127.0.0.1:5050</code> &bull; Job ID: <code>{benchmarkProgress.scanId}</code> &bull; Pages Crawled: {benchmarkProgress.pagesScanned}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--indigo-600)' }}>
                {benchmarkProgress.progress}% Completed
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'var(--slate-200)',
            borderRadius: '999px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.max(benchmarkProgress.progress || 5, 5)}%`,
              height: '100%',
              backgroundColor: 'var(--color-primary)',
              borderRadius: '999px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>
      )}

      {/* Benchmark Results Summary Card */}
      {benchmarkResult && (
        <Card
          title="Live Diagnostic Benchmark Results"
          subtitle={`Verified automated Playwright scan against ${benchmarkResult.targetName}`}
          icon={Zap}
          badge={<StatusBadge status="pass" label="Benchmark Completed" />}
          action={
            <div className="flex items-center gap-2">
              <Link
                id="view-benchmark-scan-btn"
                to={`/scans/${benchmarkResult.scanId}`}
                className="ts-btn ts-btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <span>Inspect Scan Details</span>
                <ExternalLink size={14} />
              </Link>
              <button
                id="dismiss-benchmark-result-btn"
                onClick={() => setBenchmarkResult(null)}
                className="ts-btn ts-btn-outline"
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              >
                Dismiss
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span className="text-xs text-muted">Scan Status</span>
              <div className="font-semibold text-sm" style={{ color: 'var(--emerald-600)', marginTop: '4px' }}>
                {benchmarkResult.status}
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span className="text-xs text-muted">Pages Crawled</span>
              <div className="font-semibold text-sm" style={{ color: 'var(--slate-800)', marginTop: '4px' }}>
                {benchmarkResult.pagesScanned} pages
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span className="text-xs text-muted">Execution Duration</span>
              <div className="font-semibold text-sm" style={{ color: 'var(--slate-800)', marginTop: '4px' }}>
                {benchmarkResult.durationSeconds}s
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span className="text-xs text-muted">Real Findings Verified</span>
              <div className="font-semibold text-sm" style={{ color: 'var(--indigo-600)', marginTop: '4px' }}>
                {benchmarkResult.findings?.length || benchmarkResult.findingsSummary?.total || 0} Issues
              </div>
            </div>
          </div>

          {/* Finding Categories Pill Breakdown */}
          {benchmarkResult.findings && benchmarkResult.findings.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '8px' }}>
                Discovered Diagnostic Finding Categories:
              </span>
              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                {Object.entries(
                  benchmarkResult.findings.reduce((acc, f) => {
                    acc[f.category] = (acc[f.category] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([category, count]) => (
                  <span
                    key={category}
                    className="ts-badge"
                    style={{
                      backgroundColor: 'var(--slate-100)',
                      color: 'var(--slate-700)',
                      border: '1px solid var(--slate-200)',
                      fontSize: '0.75rem',
                      padding: '4px 8px'
                    }}
                  >
                    <strong>{category.replace('_', ' ')}:</strong> {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 4-Card System Diagnostics Grid */}
      <div className="grid grid-cols-4">
        {/* Backend API */}
        <Card
          title="Express REST API"
          subtitle="Node.js &bull; Port 5000"
          icon={Server}
          badge={
            <StatusBadge
              status={isApiHealthy ? 'healthy' : 'disconnected'}
              label={isApiHealthy ? 'Online' : 'Offline'}
            />
          }
        >
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Health Endpoint:</span>
              <code style={{ fontSize: '0.75rem', color: 'var(--indigo-600)' }}>/api/health</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Environment:</span>
              <span className="font-medium text-xs">{healthData?.environment || 'development'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Server Uptime:</span>
              <span className="font-medium text-xs">
                {healthData?.uptimeSeconds !== undefined ? `${healthData.uptimeSeconds}s` : '—'}
              </span>
            </div>
          </div>
        </Card>

        {/* Database */}
        <Card
          title="MongoDB Database"
          subtitle="Mongoose ODM &bull; Port 27017"
          icon={Database}
          badge={
            <StatusBadge
              status={isDbHealthy ? 'healthy' : 'disconnected'}
              label={isDbHealthy ? 'Connected' : 'Offline'}
            />
          }
        >
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Database Name:</span>
              <code style={{ fontSize: '0.75rem', color: 'var(--slate-800)' }}>testsphere</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Ready State:</span>
              <span className="font-medium text-xs" style={{ textTransform: 'capitalize' }}>
                {dbState}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Status:</span>
              <span className="font-semibold text-xs" style={{ color: isDbHealthy ? 'var(--emerald-600)' : 'var(--rose-600)' }}>
                {isDbHealthy ? 'Active & Healthy' : 'Action Required'}
              </span>
            </div>
          </div>
        </Card>

        {/* Socket.IO */}
        <Card
          title="Real-Time Gateway"
          subtitle="Socket.IO &bull; Bidirectional"
          icon={Radio}
          badge={
            <StatusBadge
              status={isSocketConnected ? 'connected' : 'connecting'}
              label={isSocketConnected ? 'Connected' : 'Connecting'}
            />
          }
        >
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Transport:</span>
              <span className="font-medium text-xs">WebSocket / Polling</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Target Origin:</span>
              <code style={{ fontSize: '0.75rem', color: 'var(--slate-800)' }}>:5173</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">State:</span>
              <span className="font-semibold text-xs" style={{ color: isSocketConnected ? 'var(--emerald-600)' : 'var(--amber-600)' }}>
                {isSocketConnected ? 'Live Synchronized' : 'Connecting...'}
              </span>
            </div>
          </div>
        </Card>

        {/* Frontend Client */}
        <Card
          title="Frontend Client"
          subtitle="React 18 &bull; Vite &bull; Port 5173"
          icon={Layers}
          badge={<StatusBadge status="healthy" label="Loaded" />}
        >
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Theme:</span>
              <span className="font-medium text-xs">Light SaaS (Slate/Indigo)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Routing:</span>
              <span className="font-medium text-xs">React Router v6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Build Tool:</span>
              <span className="font-medium text-xs">Vite 6</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Benchmark Log & Response Viewer */}
      <div className="grid grid-cols-2">
        <Card
          title="Live Diagnostic Execution Log"
          subtitle="Interactive round-trip verification"
          icon={Terminal}
          action={
            <button
              onClick={() => setTestLog([])}
              className="ts-btn ts-btn-outline"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            >
              Clear Log
            </button>
          }
        >
          {testLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--text-subtle)' }}>
              <Terminal size={32} style={{ margin: '0 auto var(--space-2) auto', opacity: 0.4 }} />
              <p className="text-sm">Click "Run Live Benchmark" above to verify all services.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {testLog.map((log, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: log.status === 'pass' ? 'var(--emerald-50)' : log.status === 'fail' ? 'var(--rose-50)' : 'var(--slate-50)',
                    border: `1px solid ${log.status === 'pass' ? 'var(--emerald-100)' : log.status === 'fail' ? 'var(--rose-100)' : 'var(--slate-200)'}`,
                    fontSize: '0.8rem'
                  }}
                >
                  <div className="flex items-center gap-2">
                    {log.status === 'pass' ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--emerald-600)' }} />
                    ) : log.status === 'fail' ? (
                      <AlertCircle size={16} style={{ color: 'var(--rose-600)' }} />
                    ) : (
                      <div className="badge-dot" style={{ backgroundColor: 'var(--indigo-600)' }} />
                    )}
                    <span className="font-semibold" style={{ color: 'var(--slate-800)' }}>[{log.step}]</span>
                    <span style={{ color: 'var(--slate-700)' }}>{log.action}</span>
                  </div>
                  <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Raw Health JSON Response */}
        <Card
          title="Raw Health Inspection Payload"
          subtitle="GET /api/health Response"
          icon={Server}
        >
          <div className="code-block" style={{ maxHeight: '220px' }}>
            <pre>{JSON.stringify(healthData || { status: 'loading or unreachable' }, null, 2)}</pre>
          </div>
        </Card>
      </div>

      {/* Diagnostic Platform Architecture & Workflows */}
      <Card
        title="TestSphere Diagnostic Architecture & Workflows"
        subtitle="End-to-end automated and human-validated quality assurance"
        icon={Shield}
      >
        <div className="grid grid-cols-3">
          <div style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'white'
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
              <span className="font-semibold text-sm" style={{ color: 'var(--slate-700)' }}>1. Scope & Auth</span>
              <StatusBadge status="pass" label="Enforced" />
            </div>
            <h4 style={{ fontSize: '0.95rem' }}>Authorized Targets</h4>
            <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
              SSRF validation, DNS rebinding guards, host scope enforcement, rate limits, and dedicated test session auth.
            </p>
            <div style={{ marginTop: '12px' }}>
              <Link to="/targets" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                Explore Targets &rarr;
              </Link>
            </div>
          </div>

          <div style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--indigo-200)',
            backgroundColor: 'var(--indigo-50)'
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
              <span className="font-semibold text-sm" style={{ color: 'var(--indigo-900)' }}>2. Automated Scan</span>
              <StatusBadge status="healthy" label="Playwright" />
            </div>
            <h4 style={{ fontSize: '0.95rem' }}>Headless Chromium Diagnostics</h4>
            <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
              Runtime JS errors, network failures, console logs, security headers, performance timing, and WCAG accessibility via axe-core.
            </p>
            <div style={{ marginTop: '12px' }}>
              <Link to="/scans" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                View Scan History &rarr;
              </Link>
            </div>
          </div>

          <div style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'white'
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
              <span className="font-semibold text-sm" style={{ color: 'var(--slate-700)' }}>3. Validation & Reports</span>
              <StatusBadge status="pass" label="PDF Ready" />
            </div>
            <h4 style={{ fontSize: '0.95rem' }}>Human Testing & PDF Export</h4>
            <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
              Tester confirmation, false positive triage with rationales, fingerprint duplicate matching, and downloadable PDF reports.
            </p>
            <div style={{ marginTop: '12px' }}>
              <Link to="/reports" className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                Browse Reports &rarr;
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
