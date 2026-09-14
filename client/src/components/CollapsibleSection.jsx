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
    <div className={`collapsible-panel ${isOpen ? 'is-open' : 'is-collapsed'}`}>
      {/* Clickable Header Bar */}
      <div
        className={`collapsible-header ${isOpen ? 'open' : 'closed'}`}
        onClick={toggle}
      >
        <div className="collapsible-header-left">
          {Icon && (
            <div className="collapsible-icon-box">
              <Icon size={18} color="#25D366" />
            </div>
          )}

          <div className="collapsible-text-wrap">
            <div className="collapsible-title-row">
              <h3 className="collapsible-title">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="collapsible-subtitle">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="collapsible-header-actions" onClick={(e) => e.stopPropagation()}>
          {headerAction}
          <button
            type="button"
            onClick={toggle}
            className="toggle-expand-btn"
            title={isOpen ? 'Collapse Section' : 'Expand Section'}
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isOpen && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}
