import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  Globe,
  KeyRound,
  RefreshCw,
  Send,
  Sparkles,
  Wifi,
  WifiOff,
  Flame,
  Zap,
  Clock,
  Cpu,
  ArrowUpRight,
} from 'lucide-react';

export default function Header({
  isEnabled,
  autoReplyAll = false,
  onToggleAutoReplyAll,
  serverOnline,
  onRefresh,
  onOpenSimulator,
  onOpenEnvModal,
  refreshing,
  updating,
}) {
  const [quota, setQuota] = useState(null);
  const [showPopover, setShowPopover] = useState(false);
  const popoverTimeoutRef = useRef(null);

  // Fetch real-time Gemini Quota
  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/quota');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data) {
        setQuota(data.data);
      }
    } catch (err) {
      // Non-fatal for header
    }
  }, []);

  useEffect(() => {
    fetchQuota();
    // Auto-poll every 12 seconds for real-time accuracy
    const timer = setInterval(fetchQuota, 12000);
    return () => clearInterval(timer);
  }, [fetchQuota]);

  // Re-fetch quota whenever parent triggers refresh
  useEffect(() => {
    if (refreshing) {
      fetchQuota();
    }
  }, [refreshing, fetchQuota]);

  const handleMouseEnter = () => {
    if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
    setShowPopover(true);
  };

  const handleMouseLeave = () => {
    popoverTimeoutRef.current = setTimeout(() => {
      setShowPopover(false);
    }, 250);
  };

  const handleScrollToQuota = () => {
    const el = document.getElementById('gemini-quota-dashboard');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2200);
    }
  };

  const remaining = quota?.remainingToday ?? 1500;
  const limit = quota?.dailyLimit ?? 1500;
  const used = quota?.usedToday ?? 0;
  const percentRemaining = quota?.percentRemaining ?? 100;
  const percentUsed = quota?.percentUsed ?? 0;
  const resetIn = quota?.resetIn ?? '--';
  const activeModel = quota?.activeModel || 'gemini-flash-lite-latest';
  const healthTier = quota?.healthTier || 'healthy';

  const getProgressColor = (pct) => {
    if (pct > 40) return 'linear-gradient(90deg, #10b981, #06b6d4, #3b82f6)';
    if (pct > 15) return 'linear-gradient(90deg, #f59e0b, #eab308)';
    return 'linear-gradient(90deg, #ef4444, #dc2626)';
  };

  return (
    <header className="header-glass">
      <div className="brand-section">
        <div className="brand-icon-wrap">
          <Bot size={28} />
        </div>
        <div>
          <div className="brand-title">
            WhatsApp AI Studio
            <span className="brand-tag">
              <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
              Gemini Powered
            </span>
          </div>
          <div className="brand-subtitle">
            Autonomous Cloud API Webhook, Phone Filtering & Conversational Intelligence
          </div>
        </div>
      </div>

      <div className="header-actions">
        {/* Live Bot State */}
        <div
          id="bot-status-badge"
          className={`status-pill ${isEnabled ? 'active' : 'inactive'}`}
        >
          <span className="status-dot"></span>
          <span>{isEnabled ? 'Bot Active & Listening' : 'Bot Disabled'}</span>
        </div>

        {/* Global Auto-Reply All Toggle Switch */}
        <div
          id="header-auto-reply-all-toggle"
          className={`global-toggle-pill ${autoReplyAll ? 'active' : 'inactive'}`}
          title={
            autoReplyAll
              ? 'Auto-Reply All: ENABLED (Responding politely to all incoming messages)'
              : 'Auto-Reply All: DISABLED (Whitelist filter active)'
          }
        >
          <div className="global-toggle-indicator">
            <Globe size={14} className={autoReplyAll ? 'spin-slow' : ''} color={autoReplyAll ? '#818cf8' : '#9ca3af'} />
            <span className="global-toggle-text">
              Auto-Reply All:{' '}
              <strong style={{ color: autoReplyAll ? '#a5b4fc' : '#9ca3af' }}>
                {autoReplyAll ? 'ON' : 'OFF'}
              </strong>
            </span>
          </div>
          <button
            id="header-auto-reply-all-btn"
            type="button"
            className={`toggle-switch small ${autoReplyAll ? 'on' : ''}`}
            onClick={onToggleAutoReplyAll}
            disabled={updating}
            role="switch"
            aria-checked={autoReplyAll}
            aria-label="Toggle Global Auto-Reply All"
            style={{
              background: autoReplyAll ? '#6366f1' : undefined,
            }}
          >
            <span className="toggle-knob"></span>
          </button>
        </div>

        {/* ⚡ REAL-TIME GEMINI QUOTA TRACKER (TOP UI) */}
        <div
          className="header-quota-pill-wrap"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            id="header-gemini-quota-tracker"
            className="header-quota-pill"
            onClick={handleScrollToQuota}
            title="Click to jump to full Gemini Quota breakdown"
          >
            <div className="header-quota-icon-wrap">
              <Sparkles size={13} />
            </div>

            <div className="header-quota-text-group">
              <div className="header-quota-main-line">
                <span className="header-quota-used-chip" title="Aaj kitna quota khatam hua">
                  <Flame size={11} color="#ef4444" />
                  <strong>{used}</strong> khatam
                </span>
                <span className="header-quota-sep">•</span>
                <span className="header-quota-left-chip">
                  <strong>{remaining.toLocaleString()}</strong> / {limit.toLocaleString()} left
                </span>
              </div>

              {/* Micro Progress Track */}
              <div className="header-quota-mini-track">
                <div
                  className="header-quota-mini-fill"
                  style={{
                    width: `${Math.min(100, Math.max(3, percentRemaining))}%`,
                    background: getProgressColor(percentRemaining),
                  }}
                />
              </div>
            </div>

            <span className="header-quota-percent-badge">
              {percentRemaining}%
            </span>
          </div>

          {/* Hover Details Popover */}
          {showPopover && (
            <div className="header-quota-popover" onClick={handleScrollToQuota}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="#a855f7" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
                    Google Gemini AI Quota
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 12,
                    background: healthTier === 'healthy' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: healthTier === 'healthy' ? '#10b981' : '#f59e0b',
                    border: '1px solid currentColor',
                  }}
                >
                  {healthTier === 'healthy' ? 'Healthy' : 'Low'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>🔥 Khatam (Used Today):</span>
                  <strong style={{ color: '#fca5a5' }}>{used} msgs ({percentUsed}%)</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>⚡ Bacha Hua (Remaining):</span>
                  <strong style={{ color: '#38bdf8' }}>{remaining.toLocaleString()} / {limit.toLocaleString()} msgs</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>⏳ Reset In (00:00 UTC):</span>
                  <span style={{ color: '#a7f3d0' }}>{resetIn}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>🤖 Active Model:</span>
                  <span style={{ color: '#c084fc', fontFamily: 'monospace', fontSize: '0.72rem' }}>{activeModel}</span>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                }}
              >
                <span>Click to view full analytics</span>
                <ArrowUpRight size={12} color="#a855f7" />
              </div>
            </div>
          )}
        </div>

        {/* Server Health Status */}
        <div
          id="server-health-indicator"
          className={`status-pill ${serverOnline ? 'active' : 'inactive'}`}
          title={serverOnline ? 'Server connected to MongoDB' : 'Cannot reach backend server'}
        >
          {serverOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{serverOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Environment & API Key Modal Button */}
        <button
          id="open-env-modal-btn"
          className="btn-secondary"
          onClick={onOpenEnvModal}
          title="Update Gemini API Key or Upload .env"
        >
          <KeyRound size={14} color="#25D366" />
          <span>API Key & .env</span>
        </button>

        {/* Refresh Button */}
        <button
          id="refresh-btn"
          className="btn-secondary"
          onClick={onRefresh}
          disabled={refreshing}
          title="Reload settings and latest logs"
        >
          <RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />
          <span>Refresh</span>
        </button>

        {/* Simulator Button */}
        <button
          id="open-simulator-btn"
          className="btn-primary"
          onClick={onOpenSimulator}
        >
          <Send size={14} />
          <span>Test Simulator</span>
        </button>
      </div>
    </header>
  );
}
