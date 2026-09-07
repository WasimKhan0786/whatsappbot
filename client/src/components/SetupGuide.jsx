import React, { useState } from 'react';
import { BookOpen, Check, Copy, ExternalLink, Key, ShieldCheck } from 'lucide-react';

export default function SetupGuide({ envStatus }) {
  const [copiedKey, setCopiedKey] = useState('');

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:5000/webhook`;
  const verifyToken = envStatus?.verifyToken || 'whatsapp_bot_verify_token_secret_123';

  return (
    <div className="glass-card" style={{ marginTop: 24 }}>
      <div className="card-title-row">
        <h2 className="card-title">
          <BookOpen size={20} color="#38bdf8" />
          Meta WhatsApp Cloud API Configuration Guide
        </h2>
      </div>

      <div className="setup-guide-grid">
        {/* Step 1: Webhook Setup */}
        <div className="guide-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>
            <span style={{ background: '#25D366', color: '#090d16', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
            Configure Meta Webhook
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            In Meta App Dashboard &rarr; <strong>WhatsApp &rarr; Configuration</strong>, paste your public URL (via ngrok or live domain) and Verify Token:
          </p>

          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Callback URL:
            </span>
            <div className="code-snippet-box">
              <span>{webhookUrl}</span>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(webhookUrl, 'url')}
                title="Copy URL"
              >
                {copiedKey === 'url' ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Verify Token:
            </span>
            <div className="code-snippet-box">
              <span>{verifyToken}</span>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(verifyToken, 'token')}
                title="Copy Verify Token"
              >
                {copiedKey === 'token' ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Subscribe to the <strong>messages</strong> webhook field under WhatsApp events.
          </p>
        </div>

        {/* Step 2: Environment Variables */}
        <div className="guide-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>
            <span style={{ background: '#38bdf8', color: '#090d16', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
            API Keys & Server .env
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Configure your keys in <code style={{ color: '#38bdf8' }}>server/.env</code>:
          </p>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Key size={14} color="#fbbf24" />
                <span>GEMINI_API_KEY</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: envStatus?.hasGeminiKey ? '#4ade80' : '#fbbf24' }}>
                {envStatus?.hasGeminiKey ? '● Configured' : '○ Not set in .env'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#25D366" />
                <span>WHATSAPP_TOKEN</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: envStatus?.hasWhatsAppToken ? '#4ade80' : '#fbbf24' }}>
                {envStatus?.hasWhatsAppToken ? '● Configured' : '○ Mock/Dev Mode'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                color: '#60a5fa',
                textDecoration: 'none',
              }}
            >
              <span>Get free Gemini API Key at Google AI Studio</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
