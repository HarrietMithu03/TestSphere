import React from 'react';

export default function Card({ title, subtitle, icon: Icon, badge, action, children, footer, className = '' }) {
  return (
    <div className={`ts-card ${className}`}>
      {(title || subtitle || Icon || badge || action) && (
        <div className="ts-card-header">
          <div className="flex items-center gap-3">
            {Icon && (
              <div style={{
                color: 'var(--indigo-600)',
                backgroundColor: 'var(--indigo-50)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={20} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                {title && <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{title}</h3>}
                {badge}
              </div>
              {subtitle && <p className="text-xs text-muted" style={{ marginTop: '2px' }}>{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="ts-card-body">
        {children}
      </div>
      {footer && (
        <div className="ts-card-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
