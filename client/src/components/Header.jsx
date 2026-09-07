import { Bot, KeyRound, RefreshCw, Send, Sparkles, Wifi, WifiOff } from 'lucide-react';

export default function Header({
  isEnabled,
  serverOnline,
  onRefresh,
  onOpenSimulator,
  onOpenEnvModal,
  refreshing,
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
