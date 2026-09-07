import React from 'react';
import { CheckCircle2, Filter, MessageSquare, ShieldAlert, ArrowUpRight } from 'lucide-react';

export default function StatsBar({ stats, onCardClick }) {
  const items = [
    {
      id: 'stat-total',
      filterKey: 'ALL',
      label: 'Total Events',
      value: stats?.total ?? 0,
      sub: 'All incoming webhook hits',
      icon: MessageSquare,
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.15)',
    },
    {
      id: 'stat-processed',
      filterKey: 'PROCESSED',
      label: 'Processed & Replied',
      value: stats?.processed ?? 0,
      sub: 'Polite Gemini AI replies sent',
      icon: CheckCircle2,
      color: '#4ade80',
      bg: 'rgba(74, 222, 128, 0.15)',
    },
    {
      id: 'stat-ignored',
      filterKey: 'IGNORED_PHONE_MISMATCH',
      label: 'Filtered By Phone',
      value: stats?.ignored ?? 0,
      sub: 'Safely ignored (whitelist filter)',
      icon: Filter,
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.15)',
    },
    {
      id: 'stat-disabled',
      filterKey: 'PAUSED',
      label: 'Paused Events',
      value: (stats?.disabled ?? 0) + (stats?.errors ?? 0),
      sub: `${stats?.errors ?? 0} errors, ${stats?.disabled ?? 0} while disabled`,
      icon: ShieldAlert,
      color: '#f87171',
      bg: 'rgba(248, 113, 113, 0.15)',
    },
  ];

  return (
    <div className="stats-grid">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            id={item.id}
            className="stat-card clickable-stat-card"
            onClick={() => onCardClick && onCardClick(item.filterKey, item.label)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardClick && onCardClick(item.filterKey, item.label);
              }
            }}
            title={`Click to view all ${item.label}`}
          >
            <div className="stat-card-header">
              <span className="stat-label">{item.label}</span>
              <div className="stat-header-actions">
                <div
                  className="stat-icon"
                  style={{ background: item.bg, color: item.color }}
                >
                  <Icon size={18} />
                </div>
              </div>
            </div>
            <div className="stat-value-row">
              <div className="stat-value">{item.value}</div>
              <span className="stat-click-hint" style={{ color: item.color }}>
                <span>View</span>
                <ArrowUpRight size={13} />
              </span>
            </div>
            <div className="stat-sub">{item.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
