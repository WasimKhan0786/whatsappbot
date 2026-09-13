import { Bot, Globe, KeyRound, RefreshCw, Send, Sparkles, Wifi, WifiOff } from 'lucide-react';

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
