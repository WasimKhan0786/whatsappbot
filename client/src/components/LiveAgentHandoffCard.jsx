import React, { useState, useEffect, useCallback } from 'react';
import { Headphones, Play, RefreshCw, AlertTriangle, ShieldCheck, Clock, Phone, AlertCircle } from 'lucide-react';

export default function LiveAgentHandoffCard({ onHandoffChanged }) {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resumingId, setResumingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchHandoffs = useCallback(async () => {
    try {
      const res = await fetch('/api/handoffs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.handoffs)) {
        setHandoffs(data.handoffs);
      }
    } catch (err) {
      console.error('Error loading handoffs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHandoffs();
    const interval = setInterval(fetchHandoffs, 8000);
    return () => clearInterval(interval);
  }, [fetchHandoffs]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchHandoffs();
  };

  const handleResume = async (sessionId) => {
    setResumingId(sessionId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/handoffs/${encodeURIComponent(sessionId)}/resume`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      
      setActionMessage({ type: 'success', text: `AI Bot resumed for ${sessionId}!` });
      await fetchHandoffs();
      if (onHandoffChanged) onHandoffChanged();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      console.error('Error resuming session:', err);
      setActionMessage({ type: 'error', text: `Failed to resume: ${err.message}` });
    } finally {
      setResumingId(null);
    }
  };

  const formatReason = (reason) => {
    switch (reason) {
      case 'KEYWORD_AGENT':
        return { label: 'Keyword: "agent"', color: 'badge-amber' };
      case 'KEYWORD_HUMAN':
        return { label: 'Keyword: "human"', color: 'badge-amber' };
      case 'MAX_FAILED_ATTEMPTS':
        return { label: 'Failed 3 AI Attempts', color: 'badge-crimson' };
      default:
        return { label: reason || 'Live Request', color: 'badge-amber' };
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString() + ')';
    } catch {
      return dateStr;
    }
  };

  const activeCount = handoffs.length;

  return (
    <div className={`handoff-container glass-panel ${activeCount > 0 ? 'handoff-alert-border' : ''}`}>
      <div className="handoff-header">
        <div className="handoff-title-wrap">
          <div className={`handoff-icon-badge ${activeCount > 0 ? 'alert-pulse' : 'normal'}`}>
            <Headphones size={22} className={activeCount > 0 ? 'text-amber' : 'text-primary'} />
          </div>
          <div>
            <div className="handoff-title-row">
              <h3 className="handoff-title">Live Agent Handoff & Auto-Pause Guard</h3>
              {activeCount > 0 ? (
                <span className="handoff-counter-badge alert">
                  {activeCount} Paused Session{activeCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="handoff-counter-badge idle">
                  <ShieldCheck size={14} className="inline-icon" /> All Active (0 Paused)
                </span>
              )}
            </div>
            <p className="handoff-subtitle">
              Automatically pauses AI bot replies when users request an agent or when AI fails 3 consecutive queries.
            </p>
          </div>
        </div>

        <button
          className="icon-button-refresh"
          onClick={handleManualRefresh}
          disabled={refreshing}
          title="Refresh handoffs"
        >
          <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
        </button>
      </div>

      {actionMessage && (
        <div className={`handoff-banner ${actionMessage.type}`}>
          {actionMessage.type === 'success' ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {loading && handoffs.length === 0 ? (
        <div className="handoff-loading">Checking live agent status...</div>
      ) : activeCount === 0 ? (
        <div className="handoff-empty-state">
          <ShieldCheck size={28} className="text-success empty-icon" />
          <p className="empty-text">No chat sessions currently paused for live agents.</p>
          <span className="empty-subtext">
            If a user types <code>"agent"</code> or <code>"human"</code>, or if AI fails 3 times, their chat will appear here with automated replies paused.
          </span>
        </div>
      ) : (
        <div className="handoff-list">
          {handoffs.map((item) => {
            const reasonBadge = formatReason(item.handoverReason);
            const isResuming = resumingId === item.sessionId;

            return (
              <div key={item.sessionId} className="handoff-item-card">
                <div className="handoff-item-left">
                  <div className="handoff-phone-row">
                    <Phone size={16} className="text-secondary" />
                    <span className="handoff-phone">{item.sessionId}</span>
                    <span className={`handoff-reason-tag ${reasonBadge.color}`}>
                      {reasonBadge.label}
                    </span>
                  </div>

                  <div className="handoff-meta-row">
                    <span className="meta-info">
                      <Clock size={13} className="inline-icon" /> Handed off: {formatTime(item.handedOffAt)}
                    </span>
                    {item.unresolvedAttempts > 0 && (
                      <span className="meta-info text-danger">
                        <AlertTriangle size={13} className="inline-icon" /> {item.unresolvedAttempts} Failed Attempt{item.unresolvedAttempts > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="meta-info text-muted">
                      {item.messageCount || 0} messages in context
                    </span>
                  </div>
                </div>

                <div className="handoff-item-actions">
                  <button
                    className="btn-resume-ai"
                    onClick={() => handleResume(item.sessionId)}
                    disabled={isResuming}
                  >
                    {isResuming ? (
                      <>
                        <RefreshCw size={14} className="spinning" /> Resuming...
                      </>
                    ) : (
                      <>
                        <Play size={14} /> Resume AI Bot
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
