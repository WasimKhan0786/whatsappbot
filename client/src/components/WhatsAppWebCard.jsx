import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function WhatsAppWebCard() {
  const [webStatus, setWebStatus] = useState({
    status: 'connecting',
    qrCode: null,
    connectedPhoneNumber: null,
  });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-web/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setWebStatus(json.data);
        }
      }
    } catch (err) {
      // quiet fail on network issues
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll status every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/whatsapp-web/restart', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      alert('Failed to regenerate QR: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Disconnect this WhatsApp account from the AI Bot?')) {
      return;
    }
    setActionLoading(true);
    try {
      await fetch('/api/whatsapp-web/logout', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      alert('Failed to logout: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isConnected = webStatus.status === 'connected';
  const hasQr = Boolean(webStatus.qrCode);

  return (
    <div className="card qr-connect-card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: isConnected
                ? 'linear-gradient(135deg, rgba(37, 211, 102, 0.2), rgba(18, 140, 126, 0.3))'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))',
              border: `1px solid ${isConnected ? 'rgba(37, 211, 102, 0.4)' : 'rgba(147, 51, 234, 0.4)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConnected ? '#25d366' : '#a855f7',
            }}
          >
            {isConnected ? <CheckCircle2 size={24} /> : <QrCode size={24} />}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              WhatsApp Web QR Connect
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontWeight: 600,
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: '#facc15',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                }}
              >
                No Meta Account Required
              </span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
              Scan QR with your phone WhatsApp to connect live AI auto-reply
            </p>
          </div>
        </div>

        {/* Status indicator & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: isConnected
                ? 'rgba(34, 197, 94, 0.12)'
                : hasQr
                ? 'rgba(234, 179, 8, 0.12)'
                : 'rgba(148, 163, 184, 0.12)',
              color: isConnected ? '#4ade80' : hasQr ? '#facc15' : '#94a3b8',
              border: `1px solid ${
                isConnected ? 'rgba(34, 197, 94, 0.3)' : hasQr ? 'rgba(234, 179, 8, 0.3)' : 'rgba(148, 163, 184, 0.2)'
              }`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isConnected ? '#4ade80' : hasQr ? '#facc15' : '#94a3b8',
                boxShadow: isConnected ? '0 0 10px #4ade80' : 'none',
              }}
            />
            {isConnected
              ? `Connected: ${webStatus.connectedPhoneNumber || 'Live'}`
              : hasQr
              ? 'Ready to Scan'
              : 'Initializing...'}
          </div>

          {isConnected ? (
            <button
              onClick={handleLogout}
              disabled={actionLoading}
              className="btn btn-secondary"
              style={{
                padding: '7px 14px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#f87171',
              }}
            >
              <LogOut size={14} />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleRestart}
              disabled={actionLoading}
              className="btn btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} className={actionLoading ? 'spin' : ''} />
              Refresh QR
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {isConnected ? (
          /* Connected State Banner */
          <div
            className="qr-connected-banner"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(16, 185, 129, 0.03))',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: 14,
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'rgba(34, 197, 94, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4ade80',
                }}
              >
                <Smartphone size={32} />
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  WhatsApp Account Linked & Active
                </div>
                <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 4 }}>
                  Phone:{' '}
                  <strong style={{ color: '#4ade80', letterSpacing: '0.5px' }}>
                    {webStatus.connectedPhoneNumber}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={13} color="#a855f7" /> Gemini 3.6 Flash Active
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Zap size={13} color="#facc15" /> Polite Hinglish Mode On
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ShieldCheck size={13} color="#38bdf8" /> End-to-End Encrypted
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '12px 18px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.85rem',
                color: '#94a3b8',
                maxWidth: 320,
              }}
            >
              💬 <strong style={{ color: '#f1f5f9' }}>Ready!</strong> Send a message from another phone to{' '}
              <span style={{ color: '#4ade80' }}>{webStatus.connectedPhoneNumber}</span>. The bot will automatically reply in Hinglish!
            </div>
          </div>
        ) : (
          /* QR Code Scanner Section */
          <div
            className="qr-scanner-grid"
            style={{
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 14,
              padding: 24,
            }}
          >
            {/* QR Box */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  background: '#ffffff',
                  padding: 14,
                  borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  display: 'inline-block',
                  minWidth: 220,
                  minHeight: 220,
                }}
              >
                {hasQr ? (
                  <img
                    src={webStatus.qrCode}
                    alt="WhatsApp QR Code"
                    style={{ width: 210, height: 210, display: 'block', borderRadius: 6 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 210,
                      height: 210,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                    }}
                  >
                    <RefreshCw size={32} className="spin" style={{ marginBottom: 12, color: '#3b82f6' }} />
                    <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>
                      Generating QR Code...
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                      Please wait a few seconds
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Steps Guide */}
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 14 }}>
                Follow these simple steps on your phone:
              </div>
              <ol style={{ margin: 0, paddingLeft: 20, color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.8 }}>
                <li>
                  Open <strong style={{ color: '#25d366' }}>WhatsApp</strong> on your phone.
                </li>
                <li>
                  Tap <strong>Menu</strong> (Android: 3 dots ⋮) or <strong>Settings</strong> (iPhone ⚙️).
                </li>
                <li>
                  Select <strong style={{ color: '#38bdf8' }}>Linked Devices</strong>.
                </li>
                <li>
                  Tap <strong style={{ color: '#facc15' }}>Link a Device</strong> and point your camera at this QR code.
                </li>
              </ol>

              <div
                style={{
                  marginTop: 18,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  fontSize: '0.8rem',
                  color: '#93c5fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Sparkles size={16} style={{ flexShrink: 0 }} />
                <span>
                  Once scanned, your WhatsApp will automatically stay connected even if you reload the page!
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
