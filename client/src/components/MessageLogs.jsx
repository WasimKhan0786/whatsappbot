import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, MessageSquare, Trash2, User, Sparkles, ChevronDown, ChevronUp, ShieldAlert, Image as ImageIcon, Timer, Newspaper } from 'lucide-react';

export default function MessageLogs({ logs, onClearLogs, loadingLogs }) {
  const [activeTab, setActiveTab] = useState('ALL');
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const LOGS_PER_PAGE = 5;

  const filteredLogs = logs.filter((log) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'NEWS') return log.routingCategory === 'NEWS' || log.status === 'NEWS_FETCHED';
    return log.status === activeTab;
  });

  const displayedLogs = isExpandedAll ? filteredLogs : filteredLogs.slice(0, LOGS_PER_PAGE);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PROCESSED':
        return <span className="badge-status processed">Processed & Replied</span>;
      case 'NEWS_FETCHED':
        return (
          <span
            className="badge-status"
            style={{
              background: 'rgba(6, 182, 212, 0.2)',
              color: '#67e8f9',
              borderColor: 'rgba(6, 182, 212, 0.4)',
              border: '1px solid',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Newspaper size={11} />
            News Delivered
          </span>
        );
      case 'IMAGE_GENERATED':
        return (
          <span
            className="badge-status"
            style={{
              background: 'rgba(236, 72, 153, 0.2)',
              color: '#f472b6',
              borderColor: 'rgba(236, 72, 153, 0.4)',
              border: '1px solid',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ImageIcon size={11} />
            Image Generated
          </span>
        );
      case 'PAUSED_OWNER_ACTIVE':
        return (
          <span
            className="badge-status"
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              border: '1px solid',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Timer size={11} />
            Owner Active (Silenced)
          </span>
        );
      case 'IGNORED_PHONE_MISMATCH':
        return <span className="badge-status ignored_phone_mismatch">Filtered: Mismatch</span>;
      case 'BOT_DISABLED':
        return <span className="badge-status bot_disabled">Bot Disabled</span>;
      case 'ERROR':
        return <span className="badge-status error">Error Occurred</span>;
      case 'PROFANITY_BLOCKED':
        return (
          <span
            className="badge-status"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              borderColor: 'rgba(239, 68, 68, 0.4)',
              border: '1px solid',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ShieldAlert size={11} />
            Abuse Blocked
          </span>
        );
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
        {['ALL', 'PROCESSED', 'IMAGE_GENERATED', 'NEWS', 'PROFANITY_BLOCKED', 'PAUSED_OWNER_ACTIVE', 'IGNORED_PHONE_MISMATCH', 'BOT_DISABLED', 'ERROR'].map((tab) => (
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
              : tab === 'IMAGE_GENERATED'
              ? '🎨 Image Gen'
              : tab === 'NEWS'
              ? '📰 News'
              : tab === 'PROFANITY_BLOCKED'
              ? 'Abuse Blocked'
              : tab === 'PAUSED_OWNER_ACTIVE'
              ? '🕒 Owner Silence'
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
          displayedLogs.map((log) => (
            <div key={log._id} className="log-card">
              <div className="log-card-header">
                <div className="sender-tag">
                  <User size={13} />
                  <span>{log.sender}</span>
                </div>
                <div className="log-badges-wrap">
                  {log.routingCategory && (
                    <span
                      style={{
                        background:
                          log.routingCategory === 'IMAGE_GEN'
                            ? 'rgba(236, 72, 153, 0.15)'
                            : log.routingCategory === 'NEWS'
                            ? 'rgba(6, 182, 212, 0.15)'
                            : log.routingCategory === 'OWNER_ACTIVE'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : log.routingCategory === 'ROUTINE'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(168, 85, 247, 0.15)',
                        color:
                          log.routingCategory === 'IMAGE_GEN'
                            ? '#f472b6'
                            : log.routingCategory === 'NEWS'
                            ? '#67e8f9'
                            : log.routingCategory === 'OWNER_ACTIVE'
                            ? '#fbbf24'
                            : log.routingCategory === 'ROUTINE'
                            ? '#4ade80'
                            : '#c084fc',
                        borderColor:
                          log.routingCategory === 'IMAGE_GEN'
                            ? 'rgba(236, 72, 153, 0.35)'
                            : log.routingCategory === 'NEWS'
                            ? 'rgba(6, 182, 212, 0.35)'
                            : log.routingCategory === 'OWNER_ACTIVE'
                            ? 'rgba(245, 158, 11, 0.35)'
                            : log.routingCategory === 'ROUTINE'
                            ? 'rgba(34, 197, 94, 0.35)'
                            : 'rgba(168, 85, 247, 0.35)',
                        fontSize: '0.7rem',
                        padding: '2px 7px',
                        borderRadius: 6,
                        border: '1px solid',
                      }}
                      title={log.routingIntent ? `Intent: ${log.routingIntent}` : undefined}
                    >
                      {log.routingCategory === 'IMAGE_GEN'
                        ? '🎨 Image Gen'
                        : log.routingCategory === 'NEWS'
                        ? '📰 News Wire'
                        : log.routingCategory === 'OWNER_ACTIVE'
                        ? '🕒 Owner Active'
                        : log.routingCategory === 'ROUTINE'
                        ? '⚡ Routine'
                        : '🤖 Complex AI'}
                    </span>
                  )}
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
                {(log.messageOut || log.mediaUrl) && (
                  <div className="bubble-out">
                    <div className="bubble-label out">
                      {log.routingCategory === 'IMAGE_GEN' ? (
                        <span style={{ color: '#f472b6', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Sparkles size={12} />
                          Hugging Face FLUX AI Artwork Dispatched
                        </span>
                      ) : log.routingCategory === 'NEWS' ? (
                        <span style={{ color: '#67e8f9', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Newspaper size={12} />
                          World News API Live Wire
                        </span>
                      ) : log.routingCategory === 'PROFANITY' ? (
                        <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ShieldAlert size={12} />
                          Owner Predefined Profanity Intercept
                        </span>
                      ) : log.routingCategory === 'ROUTINE' ? (
                        <>⚡ Routine Template ({log.routingIntent || 'Fast Path'})</>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          Gemini AI Reply
                        </>
                      )}
                    </div>
                    {log.messageOut && <div>{log.messageOut}</div>}
                    {log.mediaUrl && (
                      <div
                        style={{
                          marginTop: 10,
                          maxWidth: 320,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          background: 'rgba(0, 0, 0, 0.4)',
                        }}
                      >
                        <a href={log.mediaUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={log.mediaUrl}
                            alt="Generated AI Artwork"
                            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </a>
                        <div
                          style={{
                            padding: '5px 10px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            fontSize: '0.74rem',
                            color: '#cbd5e1',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span>🎨 FLUX.1 Artwork</span>
                          <a
                            href={log.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }}
                          >
                            View Full Resolution ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Owner Inactivity Pause indicator */}
                {log.status === 'PAUSED_OWNER_ACTIVE' && (
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      borderLeft: '3px solid #f59e0b',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      color: '#fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Timer size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Automated Reply Suppressed:</strong> Owner was active on this chat recently. The bot is in smart silence mode to prevent interrupting human conversation.
                    </span>
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

        {/* Space Optimization Expander for Message Logs */}
        {filteredLogs.length > LOGS_PER_PAGE && (
          <div className="space-optimizer-bar">
            <button
              type="button"
              onClick={() => setIsExpandedAll(!isExpandedAll)}
              className={`see-all-btn ${isExpandedAll ? 'expanded' : ''}`}
            >
              {isExpandedAll ? (
                <>
                  <ChevronUp size={15} />
                  <span>Show Fewer Messages (Collapse to {LOGS_PER_PAGE})</span>
                </>
              ) : (
                <>
                  <ChevronDown size={15} />
                  <span>See All Message Logs ({filteredLogs.length} Total)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
