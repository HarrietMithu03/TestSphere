import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  ExternalLink,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Play,
  Layers,
  CheckCircle2,
  Lock,
  Code2,
  Bug,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTargets, deleteTarget } from '../../services/api';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import RegisterTargetModal from '../../components/targets/RegisterTargetModal';
import AssignTesterModal from '../../components/targets/AssignTesterModal';
import LaunchScanModal from '../../components/scans/LaunchScanModal';

export default function TargetsPage() {
  const { user, token } = useAuth();

  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedTargetForAssign, setSelectedTargetForAssign] = useState(null);
  const [selectedTargetForScan, setSelectedTargetForScan] = useState(null);

  const fetchTargets = async () => {
    setLoading(true);
    setError('');
    const res = await getTargets(token);
    if (res.ok && res.data?.targets) {
      setTargets(res.data.targets);
    } else {
      setError(res.error || 'Failed to load applications.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTargets();
  }, [token]);

  const handleTargetCreated = (newTarget) => {
    setTargets((prev) => [newTarget, ...prev]);
  };

  const handleTesterAssigned = (updatedTarget) => {
    setTargets((prev) =>
      prev.map((t) => ((t._id || t.id) === (updatedTarget._id || updatedTarget.id) ? updatedTarget : t))
    );
  };

  const handleDeleteTarget = async (targetId, targetName) => {
    if (!window.confirm(`Are you sure you want to archive '${targetName}'?`)) {
      return;
    }
    const res = await deleteTarget(targetId, token);
    if (res.ok) {
      setTargets((prev) => prev.filter((t) => (t._id || t.id) !== targetId));
    } else {
      alert(res.error || 'Failed to archive application.');
    }
  };

  const isDeveloper = user?.role === 'developer';

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-8)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span className={`ts-badge ${isDeveloper ? 'badge-indigo' : 'badge-success'}`}>
                {isDeveloper ? 'Developer Control Center' : 'Tester Workspace'}
              </span>
              <span className="text-xs text-muted">Target Scope & Authorization</span>
            </div>
            <h1>{isDeveloper ? 'Target Applications' : 'Assigned Applications'}</h1>
            <p style={{ marginTop: 'var(--space-2)', maxWidth: '680px', fontSize: '0.95rem' }}>
              {isDeveloper
                ? 'Register web applications for automated diagnostic scanning, set crawl scope boundaries, and assign QA testers to review findings.'
                : 'Applications assigned to you by developers. Review target scopes, launch automated diagnostic scans, and validate findings.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isDeveloper && (
              <button
                id="open-register-target-modal-btn"
                onClick={() => setIsRegisterModalOpen(true)}
                className="ts-btn ts-btn-primary"
              >
                <Plus size={16} />
                <span>Register Application</span>
              </button>
            )}
            <button
              onClick={fetchTargets}
              disabled={loading}
              className="ts-btn ts-btn-outline"
              title="Refresh target list"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Bar (Developer) */}
      {isDeveloper && (
        <div className="grid grid-cols-3">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted font-medium">Registered Applications</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {targets.length}
                </div>
              </div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--indigo-50)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Globe size={22} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted font-medium">Verified Scopes</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px' }}>
                  {targets.filter((t) => t.ownershipVerification?.status === 'verified').length}
                </div>
              </div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--emerald-50)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={22} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted font-medium">Assigned QA Testers</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                  {targets.reduce((acc, t) => acc + (t.assignedTesters?.length || 0), 0)}
                </div>
              </div>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--slate-100)',
                color: 'var(--slate-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={22} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert-banner error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto' }} />
          <p className="text-sm text-muted" style={{ marginTop: 'var(--space-3)' }}>
            Loading target applications...
          </p>
        </div>
      )}

      {/* Empty State: Developer with 0 targets */}
      {!loading && targets.length === 0 && isDeveloper && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-12) var(--space-6)',
          backgroundColor: 'var(--color-surface)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--indigo-50)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-4) auto'
          }}>
            <Globe size={32} />
          </div>
          <h3>No applications registered yet</h3>
          <p style={{ maxWidth: '440px', margin: 'var(--space-2) auto var(--space-6) auto', fontSize: '0.9rem' }}>
            Register your web application to define its target URL and crawl boundaries. Once registered, you will be able to launch automated diagnostics in Phase 3.
          </p>
          <button
            id="empty-state-register-btn"
            onClick={() => setIsRegisterModalOpen(true)}
            className="ts-btn ts-btn-primary"
          >
            <Plus size={16} />
            <span>Register Your First Application</span>
          </button>
        </div>
      )}

      {/* Empty State: Tester with 0 assigned targets */}
      {!loading && targets.length === 0 && !isDeveloper && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-12) var(--space-6)',
          backgroundColor: 'var(--color-surface)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--emerald-50)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-4) auto'
          }}>
            <Users size={32} />
          </div>
          <h3>No applications assigned yet</h3>
          <p style={{ maxWidth: '460px', margin: 'var(--space-2) auto var(--space-4) auto', fontSize: '0.9rem' }}>
            You have not been assigned to any target applications yet. Share your registered email address with your engineering team:
          </p>
          <div style={{
            display: 'inline-block',
            padding: '6px 14px',
            backgroundColor: 'var(--slate-100)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--slate-200)'
          }}>
            {user?.email}
          </div>
        </div>
      )}

      {/* Targets Grid */}
      {!loading && targets.length > 0 && (
        <div className="grid grid-cols-2">
          {targets.map((target) => {
            const targetId = target._id || target.id;
            const envColors = {
              production: 'badge-danger',
              staging: 'badge-warning',
              development: 'badge-indigo',
              preview: 'badge-slate'
            };

            return (
              <Card
                key={targetId}
                className="target-card"
                title={target.name}
                subtitle={`Host: ${target.authorizedScope?.allowedHost || '—'}`}
                icon={Globe}
                badge={
                  <div className="flex items-center gap-2">
                    <span className={`ts-badge ${envColors[target.environment] || 'badge-slate'}`} style={{ textTransform: 'capitalize' }}>
                      {target.environment}
                    </span>
                    <StatusBadge status="pass" label="Verified Scope" />
                  </div>
                }
                action={
                  isDeveloper && (
                    <button
                      onClick={() => handleDeleteTarget(targetId, target.name)}
                      className="ts-btn ts-btn-outline"
                      style={{ padding: '6px 8px', color: 'var(--color-error)' }}
                      title="Archive Target Application"
                    >
                      <Trash2 size={14} />
                    </button>
                  )
                }
              >
                <div className="flex flex-col gap-4">
                  {/* Target URL */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--slate-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--slate-200)',
                    fontSize: '0.85rem'
                  }}>
                    <span className="font-mono" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                      {target.targetUrl}
                    </span>
                    <a
                      href={target.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs"
                      title="Open target in new tab"
                    >
                      <span>Visit</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* Scope Parameters */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--space-2)',
                    fontSize: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ padding: '6px', backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
                      <span className="text-muted" style={{ display: 'block' }}>Max Depth</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{target.authorizedScope?.maxDepth || 3} levels</strong>
                    </div>
                    <div style={{ padding: '6px', backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
                      <span className="text-muted" style={{ display: 'block' }}>Max Pages</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{target.authorizedScope?.maxPages || 25} pages</strong>
                    </div>
                    <div style={{ padding: '6px', backgroundColor: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
                      <span className="text-muted" style={{ display: 'block' }}>Subdomains</span>
                      <strong style={{ color: 'var(--color-text-primary)' }}>
                        {target.authorizedScope?.allowSubdomains ? 'Allowed' : 'Isolated'}
                      </strong>
                    </div>
                  </div>

                  {/* Assigned Testers Section */}
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                      <span className="text-xs font-semibold text-muted">
                        Assigned Testers ({target.assignedTesters?.length || 0})
                      </span>
                      {isDeveloper && (
                        <button
                          onClick={() => setSelectedTargetForAssign(target)}
                          className="ts-btn ts-btn-outline"
                          style={{ padding: '2px 8px', fontSize: '0.7rem', height: '26px' }}
                        >
                          <UserPlus size={12} />
                          <span>Assign Tester</span>
                        </button>
                      )}
                    </div>

                    {target.assignedTesters && target.assignedTesters.length > 0 ? (
                      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                        {target.assignedTesters.map((t) => (
                          <div
                            key={t._id || t.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'var(--emerald-50)',
                              border: '1px solid var(--emerald-100)',
                              fontSize: '0.75rem',
                              color: 'var(--color-success)'
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{t.name}</span>
                            <span className="text-xs text-muted">({t.email})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                        {isDeveloper
                          ? 'No testers assigned yet. Click Assign Tester to collaborate.'
                          : 'Assigned to you.'}
                      </p>
                    )}
                  </div>

                  {/* Phase 3 Automated Diagnostic Scan Actions */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#faf5ff',
                      border: '1px solid #e9d5ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Play size={14} style={{ color: 'var(--color-primary)' }} />
                      <span style={{ color: '#581c87', fontWeight: 600 }}>
                        Automated Diagnostics
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/scans?targetId=${targetId}`}
                        className="ts-btn ts-btn-outline"
                        style={{ padding: '3px 8px', fontSize: '0.725rem', height: '26px' }}
                      >
                        <span>History</span>
                      </Link>

                      <button
                        id={`launch-scan-btn-${targetId}`}
                        onClick={() => setSelectedTargetForScan(target)}
                        className="ts-btn ts-btn-primary"
                        style={{ padding: '3px 10px', fontSize: '0.725rem', height: '26px' }}
                      >
                        <Play size={12} />
                        <span>Run Scan</span>
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <RegisterTargetModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onTargetCreated={handleTargetCreated}
      />

      <AssignTesterModal
        target={selectedTargetForAssign}
        isOpen={!!selectedTargetForAssign}
        onClose={() => setSelectedTargetForAssign(null)}
        onTesterAssigned={handleTesterAssigned}
      />

      <LaunchScanModal
        target={selectedTargetForScan}
        isOpen={!!selectedTargetForScan}
        onClose={() => setSelectedTargetForScan(null)}
      />
    </div>
  );
}
