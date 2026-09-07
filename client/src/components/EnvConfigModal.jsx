import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  KeyRound,
  Upload,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sliders,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

export default function EnvConfigModal({ isOpen, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('key'); // 'key' | 'file' | 'overview'
  const [envData, setEnvData] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Key form state
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [submittingKey, setSubmittingKey] = useState(false);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedPreview, setParsedPreview] = useState(null);
  const [rawFileContent, setRawFileContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [submittingFile, setSubmittingFile] = useState(false);

  // Status feedback
  const [statusMessage, setStatusMessage] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch current env status on open
  useEffect(() => {
    if (isOpen) {
      fetchEnvStatus();
      setStatusMessage(null);
      setUploadedFile(null);
      setParsedPreview(null);
      setRawFileContent('');
      setGeminiKeyInput('');
    }
  }, [isOpen]);

  const fetchEnvStatus = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/env');
      const data = await res.json();
      if (data.success) {
        setEnvData(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch env config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  if (!isOpen) return null;

  // Handle direct API key update
  const handleKeySubmit = async (e) => {
    e.preventDefault();
    if (!geminiKeyInput.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter a valid Google Gemini API key.',
      });
      return;
    }

    setSubmittingKey(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: geminiKeyInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update API key');
      }

      setStatusMessage({
        type: data.geminiProbe?.isValid ? 'success' : 'warning',
        text: data.geminiProbe?.isValid
          ? 'Gemini API key updated and verified live! Bot is ready to reply.'
          : `API Key saved, but live test probe returned: ${data.geminiProbe?.message || 'Could not verify'}. Check if model access is enabled.`,
      });

      setGeminiKeyInput('');
      fetchEnvStatus();
      if (onSuccess) onSuccess();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message,
      });
    } finally {
      setSubmittingKey(false);
    }
  };

  // Parse .env file locally for instant visual feedback
  const parseEnvFileLocally = (text, file) => {
    setRawFileContent(text);
    setUploadedFile(file);

    const lines = text.split(/\r?\n/);
    const parsed = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        // Mask value partially for security in preview
        const masked =
          val.length > 8
            ? `${val.substring(0, 4)}••••${val.substring(val.length - 4)}`
            : '••••••••';
        parsed.push({ key, masked, isSecret: key.includes('KEY') || key.includes('TOKEN') || key.includes('URI') });
      }
    }
    setParsedPreview(parsed);
  };

  // Handle file select
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseEnvFileLocally(event.target.result, file);
    };
    reader.readAsText(file);
  };

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseEnvFileLocally(event.target.result, file);
    };
    reader.readAsText(file);
  };

  // Submit uploaded .env file
  const handleFileSubmit = async () => {
    if (!rawFileContent) return;

    setSubmittingFile(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envContent: rawFileContent }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update environment');
      }

      setStatusMessage({
        type: 'success',
        text: `Environment updated successfully! Applied ${data.updatedKeys?.length || 0} variables dynamically without reboot.`,
      });

      setUploadedFile(null);
      setParsedPreview(null);
      setRawFileContent('');
      fetchEnvStatus();
      if (onSuccess) onSuccess();
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message,
      });
    } finally {
      setSubmittingFile(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content env-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640 }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge gemini-gradient-badge">
              <KeyRound size={20} color="#25D366" />
            </div>
            <div>
              <h2 className="modal-title">API Keys & Environment</h2>
              <p className="modal-subtitle">
                Hot-reload your credentials dynamically without restarting the server
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="filter-tabs" style={{ marginBottom: 16 }}>
          <button
            className={`tab-btn ${activeTab === 'key' ? 'active' : ''}`}
            onClick={() => setActiveTab('key')}
          >
            <KeyRound size={13} style={{ marginRight: 6 }} />
            Update Gemini Key
          </button>
          <button
            className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            <Upload size={13} style={{ marginRight: 6 }} />
            Upload .env File
          </button>
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Sliders size={13} style={{ marginRight: 6 }} />
            Active Config
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`env-alert-banner ${statusMessage.type}`}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background:
                statusMessage.type === 'success'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : statusMessage.type === 'warning'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              border:
                statusMessage.type === 'success'
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : statusMessage.type === 'warning'
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
              color:
                statusMessage.type === 'success'
                  ? '#4ade80'
                  : statusMessage.type === 'warning'
                  ? '#fbbf24'
                  : '#f87171',
            }}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab 1: Direct Gemini API Key Update */}
        {activeTab === 'key' && (
          <form onSubmit={handleKeySubmit} className="env-tab-content">
            <div className="env-current-status-box">
              <div className="env-status-label">Current Active Gemini Key:</div>
              <div className="env-status-pill-row">
                <span className="code-pill">
                  {envData?.maskedGeminiKey || 'Loading...'}
                </span>
                <span
                  className={`badge-status ${
                    envData?.hasGeminiKey ? 'processed' : 'error'
                  }`}
                >
                  {envData?.hasGeminiKey ? 'Active & Configured' : 'Missing'}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="input-label" htmlFor="gemini-key-input">
                New Google Gemini API Key
              </label>
              <div className="env-input-with-actions">
                <input
                  id="gemini-key-input"
                  type={showKey ? 'text' : 'password'}
                  className="text-input"
                  placeholder="Paste your key: AIzaSy... or API Key"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  className="btn-input-icon"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="input-help" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span>Updates server .env and memory instantly without restart.</span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  Get Key from Google AI Studio <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submittingKey || !geminiKeyInput.trim()}
              >
                {submittingKey ? (
                  <>
                    <RefreshCw size={14} className="spin-anim" />
                    <span>Testing & Applying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Apply Live Key</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Upload .env File */}
        {activeTab === 'file' && (
          <div className="env-tab-content">
            <input
              ref={fileInputRef}
              type="file"
              accept=".env,.env.*,.txt"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            {!uploadedFile ? (
              <div
                className={`env-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon-wrap">
                  <Upload size={32} color="#25D366" />
                </div>
                <div className="dropzone-title">
                  Drag and drop your <code>.env</code> file here
                </div>
                <div className="dropzone-subtitle">
                  or click to browse from your device
                </div>
                <div className="dropzone-badge">Accepts .env, .txt</div>
              </div>
            ) : (
              <div className="env-preview-box">
                <div className="preview-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileCode size={18} color="#25D366" />
                    <span style={{ fontWeight: 600 }}>{uploadedFile.name}</span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      ({Math.round(uploadedFile.size / 1024 * 10) / 10} KB)
                    </span>
                  </div>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setUploadedFile(null);
                      setParsedPreview(null);
                      setRawFileContent('');
                    }}
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="parsed-keys-list">
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>
                    Detected Variables ({parsedPreview?.length || 0}):
                  </div>
                  <div className="parsed-keys-scroll">
                    {parsedPreview?.map((item) => (
                      <div key={item.key} className="parsed-key-row">
                        <span className="parsed-key-name">{item.key}</span>
                        <span className="parsed-key-val">{item.masked}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submittingFile || !uploadedFile}
                onClick={handleFileSubmit}
              >
                {submittingFile ? (
                  <>
                    <RefreshCw size={14} className="spin-anim" />
                    <span>Uploading & Reloading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Upload & Hot-Reload</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Active Config Overview */}
        {activeTab === 'overview' && (
          <div className="env-tab-content">
            <div className="env-overview-table">
              <div className="overview-row">
                <span className="overview-key">Google Gemini API Key:</span>
                <span className="code-pill">{envData?.maskedGeminiKey || 'None'}</span>
              </div>
              <div className="overview-row">
                <span className="overview-key">Allowed Phone Numbers:</span>
                <span className="overview-val">{envData?.allowedPhoneNumber || 'All'}</span>
              </div>
              <div className="overview-row">
                <span className="overview-key">Max Chat History per Session:</span>
                <span className="overview-val">{envData?.chatHistoryMaxMessages || 20} messages ($slice capped)</span>
              </div>
              <div className="overview-row">
                <span className="overview-key">Chat Session TTL (Auto-Delete):</span>
                <span className="overview-val">{envData?.chatSessionTtlDays || 7} days of inactivity</span>
              </div>
              <div className="overview-row">
                <span className="overview-key">Message Log Retention (TTL):</span>
                <span className="overview-val">{envData?.messageLogTtlDays || 30} days</span>
              </div>
              <div className="overview-row">
                <span className="overview-key">Server Port:</span>
                <span className="overview-val">{envData?.port || 5000}</span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
