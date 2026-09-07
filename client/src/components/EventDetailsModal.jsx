import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  CheckCircle2,
  Filter,
  ShieldAlert,
  Search,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Trash2,
  ExternalLink,
  ShieldCheck,
  User,
} from 'lucide-react';

export default function EventDetailsModal({
  isOpen,
  onClose,
  initialTab = 'ALL',
  logs = [],
  onClearLogs,
  stats,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Synchronize initialTab whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'ALL');
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter logs by tab & search query
  const filteredLogs = logs.filter((log) => {
    // Tab filtering
    let matchesTab = true;
    if (activeTab === 'PROCESSED') {
      matchesTab = log.status === 'PROCESSED';
    } else if (activeTab === 'IGNORED_PHONE_MISMATCH') {
      matchesTab = log.status === 'IGNORED_PHONE_MISMATCH';
    } else if (activeTab === 'PAUSED') {
      matchesTab = log.status === 'BOT_DISABLED' || log.status === 'ERROR';
    }

    if (!matchesTab) return false;

    // Search query filtering
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const sender = (log.sender || '').toLowerCase();
    const msgIn = (log.messageIn || '').toLowerCase();
    const msgOut = (log.messageOut || '').toLowerCase();
    const status = (log.status || '').toLowerCase();

    return sender.includes(q) || msgIn.includes(q) || msgOut.includes(q) || status.includes(q);
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PROCESSED':
        return (
          <span className="badge-status processed">
            <CheckCircle2 size={12} />
            <span>Processed & Replied</span>
          </span>
        );
      case 'IGNORED_PHONE_MISMATCH':
        return (
          <span className="badge-status ignored_phone_mismatch">
            <Filter size={12} />
            <span>Filtered: Whitelist Mismatch</span>
          </span>
        );
      case 'BOT_DISABLED':
        return (
          <span className="badge-status bot_disabled">
            <ShieldAlert size={12} />
            <span>Bot Disabled</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="badge-status error">
            <ShieldAlert size={12} />
            <span>Error Occurred</span>
          </span>
        );
      default:
        return <span className="badge-status">{status}</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const d = new Date(dateString);
    return (
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' +
      d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
      ')'
    );
  };

  const tabs = [
    {
      id: 'ALL',
      label: 'All Events',
      count: stats?.total ?? logs.length,
      icon: MessageSquare,
      color: '#38bdf8',
    },
    {
      id: 'PROCESSED',
      label: 'Processed & Replied',
      count: stats?.processed ?? logs.filter((l) => l.status === 'PROCESSED').length,
      icon: CheckCircle2,
      color: '#4ade80',
    },
    {
      id: 'IGNORED_PHONE_MISMATCH',
      label: 'Filtered By Phone',
      count: stats?.ignored ?? logs.filter((l) => l.status === 'IGNORED_PHONE_MISMATCH').length,
      icon: Filter,
      color: '#fbbf24',
    },
    {
      id: 'PAUSED',
      label: 'Paused Events',
      count: (stats?.disabled ?? 0) + (stats?.errors ?? 0),
      icon: ShieldAlert,
      color: '#f87171',
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content event-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-with-badge">
            <div className="event-modal-icon-halo">
              <MessageSquare size={22} color="#25D366" />
            </div>
            <div>
              <h3 className="modal-heading">Activity & Event Details Log</h3>
              <p className="modal-subheading">
                Inspecting real-time webhook hits, Gemini replies, and filter audit records
              </p>
            </div>
          </div>
          <button id="close-event-modal-btn" className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="modal-event-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`modal-tab-${tab.id.toLowerCase()}`}
                className={`modal-event-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  borderBottomColor: isActive ? tab.color : 'transparent',
                }}
              >
                <Icon size={15} style={{ color: tab.color }} />
                <span>{tab.label}</span>
                <span
                  className="modal-tab-count"
                  style={{
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Actions Toolbar */}
        <div className="modal-toolbar">
          <div className="modal-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search sender number (+91...), message text, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="modal-search-input"
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {logs.length > 0 && onClearLogs && (
            <button
              className="btn-danger-outline"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all log history?')) {
                  onClearLogs();
                }
              }}
              title="Clear all stored logs"
            >
              <Trash2 size={14} />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {/* Event Cards Scrollable Feed */}
        <div className="modal-event-list">
          {filteredLogs.length === 0 ? (
            <div className="modal-empty-state">
              <div className="empty-icon-circle">
                <Filter size={26} color="#64748b" />
              </div>
              <h4 className="empty-title">No events found in this category</h4>
              <p className="empty-desc">
                {searchQuery
                  ? `No logs matched your search "${searchQuery}". Try a different keyword.`
                  : activeTab === 'PAUSED'
                  ? 'No paused or error events. The bot is running smoothly!'
                  : activeTab === 'IGNORED_PHONE_MISMATCH'
                  ? 'No unauthorized messages have been filtered yet.'
                  : 'New messages will automatically appear here live as they are received.'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log, idx) => (
              <div key={log._id || idx} className="event-item-card">
                {/* Item Top Bar */}
                <div className="event-item-header">
                  <div className="event-sender-pill">
                    <User size={13} />
                    <span className="sender-number">{log.sender}</span>
                  </div>
                  <div className="event-header-right">
                    {getStatusBadge(log.status)}
                    <span className="event-timestamp">
                      <Clock size={12} />
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Incoming Message Bubble */}
                <div className="event-message-block incoming">
                  <div className="event-direction-label incoming">
                    <ArrowDownLeft size={13} />
                    <span>Incoming WhatsApp Message:</span>
                  </div>
                  <p className="event-message-text">"{log.messageIn || '(empty message)'}"</p>
                </div>

                {/* Outgoing Reply / Ignored Note */}
                {log.status === 'PROCESSED' ? (
                  <div className="event-message-block outgoing">
                    <div className="event-direction-label outgoing">
                      <Sparkles size={13} />
                      <span>Google Gemini AI Generated Reply:</span>
                    </div>
                    <p className="event-message-text outgoing-text">{log.messageOut}</p>
                  </div>
                ) : log.status === 'IGNORED_PHONE_MISMATCH' ? (
                  <div className="event-message-block ignored">
                    <div className="event-direction-label ignored">
                      <ShieldCheck size={13} />
                      <span>Security Whitelist Action:</span>
                    </div>
                    <p className="event-message-text ignored-text">
                      Silently ignored. Sender <strong>{log.sender}</strong> is not present in your whitelist database.
                    </p>
                  </div>
                ) : (
                  <div className="event-message-block paused">
                    <div className="event-direction-label paused">
                      <ShieldAlert size={13} />
                      <span>Bot Action:</span>
                    </div>
                    <p className="event-message-text">
                      {log.errorMessage || 'No reply sent (Bot paused or error encountered).'}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer event-modal-footer">
          <div className="modal-footer-stats">
            Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> total events
          </div>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
