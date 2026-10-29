import React from 'react';

export default function StatusBadge({ status, label, className = '' }) {
  let badgeClass = 'badge-slate';

  switch (status) {
    case 'connected':
    case 'healthy':
    case 'active':
    case 'pass':
      badgeClass = 'badge-success';
      break;
    case 'disconnected':
    case 'down':
    case 'fail':
    case 'critical':
      badgeClass = 'badge-danger';
      break;
    case 'degraded':
    case 'connecting':
    case 'warning':
    case 'blocked':
      badgeClass = 'badge-warning';
      break;
    case 'info':
    case 'in_progress':
      badgeClass = 'badge-indigo';
      break;
    default:
      badgeClass = 'badge-slate';
  }

  return (
    <span className={`ts-badge ${badgeClass} ${className}`}>
      <span className="badge-dot" />
      <span>{label || status}</span>
    </span>
  );
}
