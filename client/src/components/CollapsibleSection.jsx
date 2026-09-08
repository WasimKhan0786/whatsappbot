import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  subtitle,
  children,
  defaultOpen = true,
  storageKey,
  headerAction,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`panel_${storageKey}`);
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return defaultOpen;
  });

  const toggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (storageKey) {
      localStorage.setItem(`panel_${storageKey}`, String(nextState));
    }
  };

  return (
    <div
      className="collapsible-panel"
      style={{
        width: '100%',
        marginBottom: 20,
        borderRadius: 16,
        background: 'rgba(18, 27, 44, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Clickable Header Bar */}
      <div
        className="collapsible-header"
        onClick={toggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          cursor: 'pointer',
          userSelect: 'none',
          background: isOpen ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.01)',
          borderBottom: isOpen ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
          transition: 'background 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {Icon && (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                flexShrink: 0,
              }}
            >
              <Icon size={18} color="#25D366" />
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={(e) => e.stopPropagation()}>
          {headerAction}
          <button
            type="button"
            onClick={toggle}
            className="toggle-expand-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={isOpen ? 'Collapse Section' : 'Expand Section'}
          >
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isOpen && (
        <div
          className="collapsible-content"
          style={{
            padding: '20px',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
