import React, { useState, useEffect } from 'react';
import { Bot, Check, Phone, Save, Sparkles, Sliders } from 'lucide-react';

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
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
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
    });
  };

  // Form submit for phone number and prompt
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    const res = await onUpdateSettings({
      isEnabled,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
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
