import React, { useState, useEffect } from 'react';
import { Bot, Check, Phone, Save, Sparkles, Sliders, Shield, Clock, Zap } from 'lucide-react';

const PRESETS = [
  {
    name: 'Real Human (Dost / Personal)',
    prompt:
      'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nGuidelines:\n- Bilkul natural, casual aur friendly desi chat style (Hinglish).\n- Words use karo: haanji, bhai, bolo, boliye, aap boliye, arre, theek hai.\n- Agar koi Assalam Walekum ya salam bole, toh "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".\n- Messages hamesha realistic aur short (1-2 sentences) rakho jaise normal log WhatsApp par type karte hain.',
  },
  {
    name: 'Warm & Polite',
    prompt:
      'You are a warm, polite, and helpful AI assistant responding via WhatsApp. Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies. Always reply in friendly, respectful, and natural Hinglish (conversational Hindi written in English script). Keep your answers concise, courteous, and easy to read on mobile screens.',
  },
  {
    name: 'Customer Support',
    prompt:
      'You are a courteous WhatsApp support agent for our company. Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies. Provide clear, direct, and reassuring solutions. Speak with empathy and politeness, and offer further assistance at the end.',
  },
  {
    name: 'Ultra Concise',
    prompt:
      'You are a concise, helpful assistant on WhatsApp. Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies. Respond politely in 1 to 2 short sentences. Avoid fluff and keep information direct and friendly.',
  },
];

export default function BotControls({ settings, onUpdateSettings, updating }) {
  const [isEnabled, setIsEnabled] = useState(settings?.isEnabled ?? true);
  const [phoneNumber, setPhoneNumber] = useState(settings?.allowedPhoneNumber ?? '');
  const [prompt, setPrompt] = useState(settings?.systemPrompt ?? '');
  const [humanSimulationEnabled, setHumanSimulationEnabled] = useState(settings?.humanSimulationEnabled ?? true);
  const [minReadingDelayMs, setMinReadingDelayMs] = useState(settings?.minReadingDelayMs ?? 2000);
  const [maxReadingDelayMs, setMaxReadingDelayMs] = useState(settings?.maxReadingDelayMs ?? 6000);
  const [typingSpeedCPM, setTypingSpeedCPM] = useState(settings?.typingSpeedCPM ?? 250);
  const [defaultMaxMessagesPerContact, setDefaultMaxMessagesPerContact] = useState(settings?.defaultMaxMessagesPerContact ?? 0);
  const [limitReachedClosingMessage, setLimitReachedClosingMessage] = useState(settings?.limitReachedClosingMessage ?? '');

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setHumanSimulationEnabled(settings.humanSimulationEnabled ?? true);
      setMinReadingDelayMs(settings.minReadingDelayMs ?? 2000);
      setMaxReadingDelayMs(settings.maxReadingDelayMs ?? 6000);
      setTypingSpeedCPM(settings.typingSpeedCPM ?? 250);
      setDefaultMaxMessagesPerContact(settings.defaultMaxMessagesPerContact ?? 0);
      setLimitReachedClosingMessage(settings.limitReachedClosingMessage || '');

      // Only sync if user is not actively editing
      if (!isEditingPhone) {
        setPhoneNumber(settings.allowedPhoneNumber || '');
      }
      if (!isEditingPrompt) {
        setPrompt(settings.systemPrompt || '');
      }
    }
  }, [settings, isEditingPhone, isEditingPrompt]);

  // Instant toggle handler
  const handleToggle = async () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);
    await onUpdateSettings({
      isEnabled: nextState,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
    });
  };

  // Instant Anti-Ban toggle handler
  const handleAntiBanToggle = async () => {
    const nextAntiBan = !humanSimulationEnabled;
    setHumanSimulationEnabled(nextAntiBan);
    await onUpdateSettings({
      isEnabled,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled: nextAntiBan,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
    });
  };

  // Form submit for phone number, prompt, anti-ban settings, and message limits
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    const res = await onUpdateSettings({
      isEnabled,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs: Number(minReadingDelayMs),
      maxReadingDelayMs: Number(maxReadingDelayMs),
      typingSpeedCPM: Number(typingSpeedCPM),
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
    });
    if (res) {
      setIsEditingPhone(false);
      setIsEditingPrompt(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-title-row">
        <h2 className="card-title">
          <Sliders size={20} color="#25D366" />
          Bot Control & Filter Settings
        </h2>
      </div>

      {/* Master Toggle Switch Card */}
      <div
        id="master-switch-card"
        className={`master-switch-card ${isEnabled ? 'active' : ''}`}
      >
        <div className="switch-info">
          <h3>Bot Operational State</h3>
          <p>
            {isEnabled
              ? 'Active: Accepting webhooks, verifying phone whitelist, and replying with Gemini.'
              : 'Disabled: Webhooks are acknowledged but no AI replies will be dispatched.'}
          </p>
        </div>

        <div className="toggle-switch-container">
          <button
            id="bot-toggle-btn"
            type="button"
            className={`toggle-switch ${isEnabled ? 'on' : ''}`}
            onClick={handleToggle}
            disabled={updating}
            role="switch"
            aria-checked={isEnabled}
            aria-label="Toggle WhatsApp Bot Active State"
          >
            <span className="toggle-knob"></span>
          </button>
        </div>
      </div>

      {/* 🛡️ Anti-Ban & Human Simulation Protection Shield */}
      <div
        style={{
          marginTop: 16,
          marginBottom: 20,
          padding: '16px 20px',
          background: humanSimulationEnabled
            ? 'rgba(37, 211, 102, 0.08)'
            : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${humanSimulationEnabled ? 'rgba(37, 211, 102, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color={humanSimulationEnabled ? '#25D366' : '#ef4444'} />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                Anti-Ban & Human Simulation Shield
              </h3>
              <span style={{ fontSize: '0.78rem', color: humanSimulationEnabled ? '#4ade80' : '#f87171' }}>
                {humanSimulationEnabled ? '🛡️ Active Protection: 4-Step Human Reading & Typing Rhythm On' : '⚠️ Disabled: Instant 0s Replies (Higher Ban Risk)'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={`toggle-switch ${humanSimulationEnabled ? 'on' : ''}`}
            onClick={handleAntiBanToggle}
            disabled={updating}
            role="switch"
            aria-checked={humanSimulationEnabled}
            aria-label="Toggle Anti-Ban Protection Shield"
            style={{ width: 44, height: 24 }}
          >
            <span className="toggle-knob" style={{ width: 18, height: 18 }}></span>
          </button>
        </div>

        {humanSimulationEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 14 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                Min Read Delay (ms)
              </label>
              <input
                type="number"
                className="text-input"
                value={minReadingDelayMs}
                onChange={(e) => setMinReadingDelayMs(e.target.value)}
                step="500"
                min="500"
                max="10000"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                Max Typing Delay (ms)
              </label>
              <input
                type="number"
                className="text-input"
                value={maxReadingDelayMs}
                onChange={(e) => setMaxReadingDelayMs(e.target.value)}
                step="500"
                min="1000"
                max="20000"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                <Zap size={12} style={{ display: 'inline', marginRight: 4 }} />
                Typing Speed (CPM)
              </label>
              <input
                type="number"
                className="text-input"
                value={typingSpeedCPM}
                onChange={(e) => setTypingSpeedCPM(e.target.value)}
                step="25"
                min="100"
                max="1000"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSaveConfig}>
        {/* Phone Number Filter (Whitelist) */}
        <div className="control-group">
          <label className="control-label" htmlFor="allowed-phone-input">
            <span>Allowed Numbers (Whitelist Filter)</span>
            <span className="label-badge">Selected Only</span>
          </label>
          <div className="input-with-icon">
            <Phone size={18} className="input-icon" />
            <input
              id="allowed-phone-input"
              type="text"
              className="text-input phone-format"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setIsEditingPhone(true);
              }}
              placeholder="+919876543210, +919123456789 (Comma separated for multiple)"
            />
          </div>
          <p className="input-hint">
            <strong>Selected Numbers Only:</strong> Bot sirf inhi numbers ke messages ka automatic reply karega.
            Baaki kisi bhi vyakti ke message par bot koi reply nahi bhejega.
          </p>
        </div>

        {/* Gemini Persona System Prompt */}
        <div className="control-group">
          <label className="control-label" htmlFor="gemini-prompt-input">
            <span>Gemini AI Persona & Tone</span>
            <span className="label-badge">Polite Prompts</span>
          </label>
          <textarea
            id="gemini-prompt-input"
            className="textarea-input"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setIsEditingPrompt(true);
            }}
            rows={4}
            placeholder="Instruction for Gemini AI tone and politeness..."
          />
          <div className="preset-chips">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              Presets:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="chip-btn"
                onClick={() => {
                  setPrompt(p.prompt);
                  setIsEditingPrompt(true);
                }}
              >
                <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Global Max Messages Per Contact (Auto-Cap Controller) */}
        <div className="control-group" style={{ marginTop: 16 }}>
          <label className="control-label" htmlFor="global-limit-input">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              📊 Global Max Messages Per Contact
            </span>
            <span className="label-badge" style={{ background: defaultMaxMessagesPerContact > 0 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)', color: defaultMaxMessagesPerContact > 0 ? '#facc15' : '#4ade80' }}>
              {defaultMaxMessagesPerContact > 0 ? `Max ${defaultMaxMessagesPerContact} Replies` : 'Unlimited Default'}
            </span>
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="global-limit-input"
              type="number"
              min="0"
              max="1000"
              className="text-input"
              style={{ width: 140, height: 40, fontSize: '0.9rem' }}
              value={defaultMaxMessagesPerContact}
              onChange={(e) => setDefaultMaxMessagesPerContact(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0 (Unlimited)"
            />
            <div className="preset-chips" style={{ margin: 0 }}>
              {[0, 3, 5, 10, 20].map((lim) => (
                <button
                  key={lim}
                  type="button"
                  className={`chip-btn ${defaultMaxMessagesPerContact === lim ? 'active' : ''}`}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    background: defaultMaxMessagesPerContact === lim ? 'rgba(37, 211, 102, 0.25)' : undefined,
                    borderColor: defaultMaxMessagesPerContact === lim ? '#25D366' : undefined,
                    color: defaultMaxMessagesPerContact === lim ? '#4ade80' : undefined,
                  }}
                  onClick={() => setDefaultMaxMessagesPerContact(lim)}
                >
                  {lim === 0 ? '♾️ Unlimited' : `🎯 ${lim} msgs`}
                </button>
              ))}
            </div>
          </div>
          <p className="input-hint">
            <strong>Global Message Cap:</strong> Agar set kiya toh bot kisi bhi contact ko max utne hi messages bhejega, uske baad khud pause ho jayega (Quota bachega aur spamming rukegi). Whitelist list me individual contacts par alag limit bhi set kar sakte hain.
          </p>
        </div>

        {/* Auto-Closing Farewell Message (Handoff to Owner Announcement) */}
        <div className="control-group" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="control-label" htmlFor="closing-message-input" style={{ margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                ✨ Auto-Closing Farewell Message (Sent When Limit Hits)
              </span>
            </label>
            <button
              type="button"
              className="chip-btn"
              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
              onClick={() => {
                setLimitReachedClosingMessage(
                  'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke AI WhatsApp Assistant se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much! ✨'
                );
              }}
            >
              Reset Default Text
            </button>
          </div>
          <textarea
            id="closing-message-input"
            className="textarea-input"
            rows={3}
            value={limitReachedClosingMessage}
            onChange={(e) => setLimitReachedClosingMessage(e.target.value)}
            placeholder="Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke AI WhatsApp Assistant se baat kar rahe the..."
          />
          <p className="input-hint">
            <strong>Farewell Note:</strong> Jaise hi koi contact apni last message limit par pahuchega, bot final reply bhejne ke theek 1.5s baad yeh closing message bhej kar shant ho jayega.
          </p>
        </div>

        {/* Save Button & Feedback */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            id="save-settings-btn"
            type="submit"
            className="btn-primary"
            disabled={updating}
          >
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>Saved to MongoDB!</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{updating ? 'Saving...' : 'Save Settings'}</span>
              </>
            )}
          </button>
          {savedSuccess && (
            <span style={{ fontSize: '0.82rem', color: '#4ade80' }}>
              Database updated in real-time.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
