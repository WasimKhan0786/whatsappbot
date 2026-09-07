import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, MessageSquare, Trash2, User, Sparkles } from 'lucide-react';

export default function MessageLogs({ logs, onClearLogs, loadingLogs }) {
  const [activeTab, setActiveTab] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    if (activeTab === 'ALL') return true;
    return log.status === activeTab;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PROCESSED':
        return <span className="badge-status processed">Processed & Replied</span>;
      case 'IGNORED_PHONE_MISMATCH':
        return <span className="badge-status ignored_phone_mismatch">Filtered: Mismatch</span>;
      case 'BOT_DISABLED':
        return <span className="badge-status bot_disabled">Bot Disabled</span>;
      case 'ERROR':
        return <span className="badge-status error">Error Occurred</span>;
      default:
        return <span className="badge-status">{status}</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
  };

  return (
    <div className="glass-card">
      <div className="card-title-row">
        <h2 className="card-title">
          <MessageSquare size={20} color="#25D366" />
          Message Feed & Audit Log
        </h2>
        {logs.length > 0 && (
          <button
            id="clear-logs-btn"
            className="btn-secondary"
            onClick={onClearLogs}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {['ALL', 'PROCESSED', 'IGNORED_PHONE_MISMATCH', 'BOT_DISABLED', 'ERROR'].map((tab) => (
          <button
            key={tab}
            id={`filter-tab-${tab.toLowerCase()}`}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'ALL'
              ? `All (${logs.length})`
              : tab === 'PROCESSED'
              ? 'Processed'
              : tab === 'IGNORED_PHONE_MISMATCH'
              ? 'Filtered'
              : tab === 'BOT_DISABLED'
              ? 'Disabled'
              : 'Errors'}
          </button>
        ))}
      </div>

      {/* Logs Feed */}
      <div className="logs-container">
        {loadingLogs ? (
          <div className="empty-state">Loading messages...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={36} className="empty-state-icon" />
            <p>No messages matching this filter yet.</p>
            <p style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Incoming WhatsApp messages or simulated tests will appear here in real time.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log._id} className="log-card">
              <div className="log-card-header">
                <div className="sender-tag">
                  <User size={13} />
                  <span>{log.sender}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getStatusBadge(log.status)}
                  <span className="time-tag">
                    <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              </div>

              {/* Chat bubbles */}
              <div className="chat-bubbles-wrap">
                {/* Incoming message */}
                <div className="bubble-in">
                  <div className="bubble-label in">
                    <ArrowDownLeft size={12} />
                    Incoming WhatsApp
                  </div>
                  <div>{log.messageIn || '<em>(Empty body)</em>'}</div>
                </div>

                {/* Outgoing reply if processed */}
                {log.messageOut && (
                  <div className="bubble-out">
                    <div className="bubble-label out">
                      <Sparkles size={12} />
                      Gemini AI Reply
                    </div>
                    <div>{log.messageOut}</div>
                  </div>
                )}

                {/* Error message if any */}
                {log.errorMessage && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderLeft: '3px solid #ef4444',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      color: '#fca5a5',
                    }}
                  >
                    <strong>Error:</strong> {log.errorMessage}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
