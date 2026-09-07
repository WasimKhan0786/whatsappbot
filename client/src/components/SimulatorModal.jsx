import React, { useState } from 'react';
import { Send, X, AlertCircle, CheckCircle2, ShieldAlert, Sparkles, Phone } from 'lucide-react';

export default function SimulatorModal({
  isOpen,
  onClose,
  allowedPhoneNumber,
  onSimulationSuccess,
}) {
  const [sender, setSender] = useState(allowedPhoneNumber || '+1234567890');
  const [messageText, setMessageText] = useState('Hello! What are your business hours and services?');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleUseAllowed = () => {
    setSender(allowedPhoneNumber || '+1234567890');
  };

  const handleUseUnauthorized = () => {
    setSender('+9998887766');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, messageText }),
      });
      const data = await res.json();
      setResult(data);
      if (onSimulationSuccess) {
        onSimulationSuccess();
      }
    } catch (err) {
      setResult({
        success: false,
        status: 'ERROR',
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Send size={20} color="#25D366" />
            WhatsApp Webhook Simulator
          </div>
          <button id="close-modal-btn" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Test the complete end-to-end automation without waiting for Meta domain verification:
              validates the phone whitelist filter, invokes Gemini AI, and records the event in MongoDB.
            </p>

            {/* Sender Phone Input */}
            <div className="control-group">
              <label className="control-label" htmlFor="sim-sender-input">
                <span>Sender Phone Number</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="chip-btn"
                    onClick={handleUseAllowed}
                    title="Set to authorized number"
                  >
                    Use Allowed Number
                  </button>
                  <button
                    type="button"
                    className="chip-btn"
                    onClick={handleUseUnauthorized}
                    title="Set to random number to test rejection"
                  >
                    Test Unauthorized
                  </button>
                </div>
              </label>
              <div className="input-with-icon">
                <Phone size={16} className="input-icon" />
                <input
                  id="sim-sender-input"
                  type="text"
                  className="text-input phone-format"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="+1234567890"
                  required
                />
              </div>
            </div>

            {/* Message Body Input */}
            <div className="control-group">
              <label className="control-label" htmlFor="sim-message-input">
                <span>Incoming WhatsApp Message Body</span>
              </label>
              <textarea
                id="sim-message-input"
                className="textarea-input"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                required
              />
            </div>

            {/* Simulation Result Preview */}
            {result && (
              <div
                style={{
                  background:
                    result.status === 'PROCESSED'
                      ? 'rgba(34, 197, 94, 0.1)'
                      : result.status === 'IGNORED_PHONE_MISMATCH'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${
                    result.status === 'PROCESSED'
                      ? 'rgba(34, 197, 94, 0.3)'
                      : result.status === 'IGNORED_PHONE_MISMATCH'
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.9rem' }}>
                  {result.status === 'PROCESSED' && (
                    <>
                      <CheckCircle2 size={18} color="#4ade80" />
                      <span style={{ color: '#4ade80' }}>Processed & Replied</span>
                    </>
                  )}
                  {result.status === 'IGNORED_PHONE_MISMATCH' && (
                    <>
                      <AlertCircle size={18} color="#fbbf24" />
                      <span style={{ color: '#fbbf24' }}>Filtered (Phone Number Mismatch)</span>
                    </>
                  )}
                  {result.status === 'BOT_DISABLED' && (
                    <>
                      <ShieldAlert size={18} color="#c084fc" />
                      <span style={{ color: '#c084fc' }}>Ignored (Bot is Disabled)</span>
                    </>
                  )}
                  {result.status === 'ERROR' && (
                    <>
                      <AlertCircle size={18} color="#f87171" />
                      <span style={{ color: '#f87171' }}>Error</span>
                    </>
                  )}
                </div>

                {result.replyText && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                      <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
                      Gemini Response Generated:
                    </div>
                    <div style={{ fontSize: '0.86rem', color: '#f8fafc', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 8 }}>
                      {result.replyText}
                    </div>
                  </div>
                )}

                {result.message && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {result.message}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              id="submit-simulation-btn"
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              <Send size={15} />
              <span>{loading ? 'Processing...' : 'Send Simulated Message'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
