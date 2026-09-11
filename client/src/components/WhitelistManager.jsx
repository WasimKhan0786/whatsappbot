import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Phone,
  Heart,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Tag,
  CheckCircle2,
  X,
  UploadCloud,
  FileText,
  Dna,
  Zap,
  Bot,
  Sliders,
  Quote,
  Clock,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

const COMMON_RELATIONSHIPS = [
  'Brother',
  'Bhabhi',
  'Wife',
  'Husband',
  'Mother',
  'Father',
  'Sister',
  'Best Friend',
  'Friend',
  'Colleague',
  'Client / Customer',
  'Other (Custom)',
];

export default function WhitelistManager({ onContactsUpdated }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRel, setSelectedRel] = useState('Brother');
  const [customRel, setCustomRel] = useState('');
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('AUTO');
  const [customToneInstructions, setCustomToneInstructions] = useState('');
  const [formMaxLimit, setFormMaxLimit] = useState(0);
  const [showFormChatSample, setShowFormChatSample] = useState(false);
  const [formChatSample, setFormChatSample] = useState('');

  // Contacts Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'CAP_REACHED' | 'CLONED'

  // Chat Style Cloner Modal State
  const [styleModalContact, setStyleModalContact] = useState(null);
  const [chatSampleInput, setChatSampleInput] = useState('');
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [styleModalError, setStyleModalError] = useState('');
  const [styleModalSuccess, setStyleModalSuccess] = useState('');
  const [activeModalTab, setActiveModalTab] = useState('profile'); // 'profile' or 'upload'

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/whitelist');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setContacts(json.data);
          // If modal is currently open, keep styleModalContact in sync
          setStyleModalContact((prev) => {
            if (!prev) return null;
            const updated = json.data.find((c) => c._id === prev._id);
            return updated || prev;
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch whitelist contacts:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Reset message counter back to 0 & unpause bot
  const handleResetCounter = async (id, nameOrPhone) => {
    try {
      const res = await fetch(`/api/whitelist/${id}/reset-counter`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Message counter reset to 0 for ${nameOrPhone}. Auto-replies unblocked!`);
        await fetchContacts();
        if (onContactsUpdated) onContactsUpdated();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setError('Failed to reset message counter: ' + err.message);
    }
  };

  // Change contact limit on the fly
  const handleQuickLimitChange = async (id, newLimit, nameOrPhone) => {
    try {
      const res = await fetch(`/api/whitelist/${id}/message-limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxMessageLimit: Number(newLimit) }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Limit updated to ${newLimit === 0 ? 'Unlimited' : newLimit + ' msgs'} for ${nameOrPhone}`);
        await fetchContacts();
        if (onContactsUpdated) onContactsUpdated();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setError('Failed to update limit: ' + err.message);
    }
  };

  // Add +5 more messages to current limit
  const handleAddMoreLimit = async (contact) => {
    const currentBase = Math.max(contact.maxMessageLimit || 0, contact.messagesSentCount || 0);
    const nextLimit = currentBase + 5;
    await handleQuickLimitChange(contact._id, nextLimit, contact.name || contact.phoneNumber);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!phoneNumber || phoneNumber.trim().length < 8) {
      setError('Please enter a valid phone number (e.g. +919876543210).');
      return;
    }

    const finalRelationship =
      selectedRel === 'Other (Custom)' ? (customRel.trim() || 'Friend') : selectedRel;

    setAdding(true);
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          relationship: finalRelationship,
          name: name.trim(),
          persona: persona,
          customToneInstructions: customToneInstructions.trim(),
          rawChatSample: formChatSample.trim(),
          maxMessageLimit: Number(formMaxLimit) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add contact');
      }

      setSuccessMsg(`Added ${data.data.phoneNumber} (${finalRelationship})! Limit: ${data.data.maxMessageLimit ? data.data.maxMessageLimit + ' msgs' : 'Unlimited'}`);
      setPhoneNumber('');
      setName('');
      setCustomRel('');
      setPersona('AUTO');
      setCustomToneInstructions('');
      setFormMaxLimit(0);
      setFormChatSample('');
      setShowFormChatSample(false);
      await fetchContacts();
      if (onContactsUpdated) onContactsUpdated();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, phone) => {
    if (!window.confirm(`Remove ${phone} from the whitelist? The bot will no longer reply to this number.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/whitelist/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (styleModalContact?._id === id) {
          setStyleModalContact(null);
        }
        await fetchContacts();
        if (onContactsUpdated) onContactsUpdated();
      }
    } catch (err) {
      alert('Failed to delete contact: ' + err.message);
    }
  };

  // Open Style Cloner Modal
  const openStyleModal = (contact) => {
    setStyleModalContact(contact);
    setChatSampleInput(contact.rawChatSample || '');
    setStyleModalError('');
    setStyleModalSuccess('');
    setActiveModalTab(contact?.styleProfile?.hasCustomStyle ? 'profile' : 'upload');
  };

  // Handle Chat File Upload (.txt WhatsApp export) for Modal
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setChatSampleInput(content);
        setStyleModalSuccess(`Loaded "${file.name}" (${(content.length / 1024).toFixed(1)} KB). Click "Analyze & Map Style" below!`);
      }
    };
    reader.onerror = () => {
      setStyleModalError('Failed to read file content.');
    };
    reader.readAsText(file);
  };

  // Handle Chat File Upload for Form
  const handleFormFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setFormChatSample(content);
      }
    };
    reader.readAsText(file);
  };

  // Paste Sample Chat helper for Modal
  const handlePasteExample = () => {
    const rel = (styleModalContact?.relationship || 'Friend').toLowerCase();
    let example = '';
    if (rel.includes('wife') || rel.includes('love') || rel.includes('jaan') || rel.includes('chipkali')) {
      example = `Me: suno na khana khaya kya\nChipkali: haan baba kha liya aapne khaya?\nMe: bas abhi baitha hu office se nikalke.. boht thak gya yaar ❤️\nChipkali: jaldi ghar aao fir aaram kro\nMe: haan bas 10 min me nikal raha hu meri jaan.. kuch lana h kya raste se?`;
    } else if (rel.includes('brother') || rel.includes('bhai') || rel.includes('friend') || rel.includes('dost') || rel.includes('gym')) {
      example = `Me: bhai kahan hai abhi?\nBhai: gym me workout kar raha tha bol\nMe: arre shaam ko nikalna hai kya cafe pe? scene bna fir bawa\nBhai: haan haan 7:30 baje done hai\nMe: theek hai bhai chill maar milte hai`;
    } else if (rel.includes('bhabhi') || rel.includes('mother') || rel.includes('father') || rel.includes('elder')) {
      example = `Me: Pranam Bhabhi ji! Kaise hain aap sab?\nBhabhi: Hum sab badhiya hain Wasim, tum batao ghar kab aa rahe ho?\nMe: Ji Bhabhi ji, is weekend zaroor aayenge. Bhaiya ko mera pranam dijiyega.\nBhabhi: Theek hai zaroor bol denge beta, khayal rakhna apna.`;
    } else {
      example = `Me: Hey! Are you free for a quick call later today?\nContact: Yes, after 3 PM works best for me.\nMe: Sounds good, will ping you around 3:15 then. Thanks!`;
    }
    setChatSampleInput(example);
    setStyleModalSuccess('Sample chat pasted! Click "Analyze & Map Style" to train AI on this fingerprint.');
  };

  // Paste Sample Chat helper for Form
  const handlePasteFormExample = () => {
    const rel = (selectedRel || 'Friend').toLowerCase();
    let example = '';
    if (rel.includes('wife') || rel.includes('love') || rel.includes('husband')) {
      example = `Me: suno na khana khaya kya\nWife: haan baba kha liya aapne?\nMe: bas nikal raha hu meri jaan.. boht thak gya yaar ❤️`;
    } else if (rel.includes('brother') || rel.includes('bhai') || rel.includes('friend')) {
      example = `Me: bhai kahan hai?\nBhai: gym me hu bol na\nMe: sham ko milte hai bawa chill maar`;
    } else {
      example = `Me: Pranam ji, sab theek thaak?\nContact: Haan ji sab badhiya hai.`;
    }
    setFormChatSample(example);
  };

  // Trigger Gemini Analysis & Saving
  const handleAnalyzeStyle = async () => {
    if (!chatSampleInput || chatSampleInput.trim().length < 20) {
      setStyleModalError('Please provide at least 2-3 sample message exchanges (minimum 20 characters).');
      return;
    }

    setAnalyzingStyle(true);
    setStyleModalError('');
    setStyleModalSuccess('');

    try {
      const res = await fetch(`/api/whitelist/${styleModalContact._id}/analyze-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatText: chatSampleInput }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to analyze chat sample');
      }

      setStyleModalContact(json.data);
      setStyleModalSuccess('🎉 Chat style successfully analyzed! Tone, vocabulary & typing quirks are now active exclusively for this contact.');
      setActiveModalTab('profile');
      await fetchContacts();
      if (onContactsUpdated) onContactsUpdated();
    } catch (err) {
      setStyleModalError(err.message);
    } finally {
      setAnalyzingStyle(false);
    }
  };

  // Reset Style back to default persona
  const handleClearStyle = async () => {
    if (!window.confirm('Reset this contact back to default persona? The learned vocabulary and typing quirks will be removed.')) {
      return;
    }

    setStyleModalError('');
    setStyleModalSuccess('');

    try {
      const res = await fetch(`/api/whitelist/${styleModalContact._id}/chat-style`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to reset chat style');
      }

      setStyleModalContact(json.data);
      setChatSampleInput('');
      setStyleModalSuccess('Chat style reset. Contact reverted to standard dynamic persona.');
      setActiveModalTab('upload');
      await fetchContacts();
      if (onContactsUpdated) onContactsUpdated();
    } catch (err) {
      setStyleModalError(err.message);
    }
  };

  const getRelationshipBadgeStyle = (rel) => {
    const lower = (rel || '').toLowerCase();
    if (lower.includes('wife') || lower.includes('husband') || lower.includes('love')) {
      return { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.3)' };
    }
    if (lower.includes('bhabhi')) {
      return { bg: 'rgba(217, 70, 239, 0.15)', text: '#e879f9', border: 'rgba(217, 70, 239, 0.3)' };
    }
    if (lower.includes('brother') || lower.includes('bhai') || lower.includes('sister')) {
      return { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
    }
    if (lower.includes('mother') || lower.includes('father') || lower.includes('family') || lower.includes('owner')) {
      return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
    }
    return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' };
  };

  // Real-time search & category filter logic
  const filteredContacts = contacts.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const cleanQ = query.replace(/\D/g, '');
      const cleanPhone = (c.phoneNumber || '').replace(/\D/g, '');
      const phoneMatches = (cleanQ && cleanPhone.includes(cleanQ)) || (c.phoneNumber || '').toLowerCase().includes(query);
      const nameMatches = c.name && c.name.toLowerCase().includes(query);
      const relMatches = c.relationship && c.relationship.toLowerCase().includes(query);
      const personaMatches = c.persona && c.persona.toLowerCase().includes(query);
      const noteMatches = (c.notes && c.notes.toLowerCase().includes(query)) || (c.customToneInstructions && c.customToneInstructions.toLowerCase().includes(query));
      const crmMatches = c.crmTag && c.crmTag.toLowerCase().includes(query);

      if (!phoneMatches && !nameMatches && !relMatches && !personaMatches && !noteMatches && !crmMatches) {
        return false;
      }
    }

    if (filterCategory === 'CAP_REACHED') {
      return c.isCapReached || (c.maxMessageLimit > 0 && c.messagesSentCount >= c.maxMessageLimit);
    }
    if (filterCategory === 'CLONED') {
      return Boolean(c.styleProfile?.hasCustomStyle);
    }
    if (filterCategory === 'ACTIVE') {
      return !c.isCapReached && !(c.maxMessageLimit > 0 && c.messagesSentCount >= c.maxMessageLimit);
    }
    return true;
  });

  // Space optimization state (Show top 6 by default with 'See All' toggle)
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const CONTACTS_PER_PAGE = 6;
  const displayedContacts = isExpandedAll ? filteredContacts : filteredContacts.slice(0, CONTACTS_PER_PAGE);

  return (
    <div className="card whitelist-manager-card" style={{ marginBottom: 24 }}>
      {/* Card Header */}
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.2))',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Whitelist & Dynamic AI Personas
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Tailored reply personas, chat style cloning & phone number access control
            </p>
          </div>
        </div>

        <button
          onClick={fetchContacts}
          disabled={loading}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Add New Contact Form */}
      <form onSubmit={handleAdd} style={{ marginTop: 18, background: 'rgba(15, 23, 42, 0.35)', padding: 16, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={16} color="#10b981" />
          Add Authorized Contact & Assign Persona:
        </div>

        <div className="whitelist-form-grid">
          {/* Phone Number Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              WhatsApp Phone Number *
            </label>
            <input
              type="text"
              className="text-input"
              style={{ height: 42, fontSize: '0.88rem', margin: 0 }}
              placeholder="+919876543210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          {/* Relationship Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Relationship / Role *
            </label>
            <select
              className="text-input"
              style={{ height: 42, fontSize: '0.88rem', background: '#0f172a', color: '#f1f5f9', cursor: 'pointer' }}
              value={selectedRel}
              onChange={(e) => setSelectedRel(e.target.value)}
            >
              {COMMON_RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Relationship Input */}
          {selectedRel === 'Other (Custom)' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Specify Relationship *
              </label>
              <input
                type="text"
                className="text-input"
                style={{ height: 42, fontSize: '0.88rem' }}
                placeholder="e.g. Chachi, Manager, etc."
                value={customRel}
                onChange={(e) => setCustomRel(e.target.value)}
                required
              />
            </div>
          )}

          {/* Contact Name (Optional) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Contact Name / Nickname (Optional)
            </label>
            <input
              type="text"
              className="text-input"
              style={{ height: 42, fontSize: '0.88rem', margin: 0 }}
              placeholder="e.g. Rahul, Fatima, Chipkali"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* AI Persona & Tone Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Dynamic AI Persona & Tone *
            </label>
            <select
              className="text-input"
              style={{ height: 42, fontSize: '0.88rem', background: '#0f172a', color: '#f1f5f9', cursor: 'pointer' }}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
            >
              <option value="AUTO">✨ Auto Detect (from Relationship / Name)</option>
              <option value="CASUAL_SLANG">⚡ Casual with Slang (Bhai / Dost / Bros)</option>
              <option value="ROMANTIC">💖 Romantic & Affectionate (Wife / GF / Jaan)</option>
              <option value="RESPECTFUL">🙏 Respectful & Polite (Bhabhi / Elders)</option>
              <option value="EMOTIONAL">🫂 Emotional & Empathetic (Supportive)</option>
              <option value="PROFESSIONAL">💼 Professional & Courteous</option>
              <option value="FRIENDLY">😊 Warm & Friendly Desi (Default)</option>
            </select>
          </div>

          {/* Special Custom Tone / Nickname Instruction */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Special Tone Instruction (Optional)
            </label>
            <input
              type="text"
              className="text-input"
              style={{ height: 42, fontSize: '0.88rem', margin: 0 }}
              placeholder="e.g. Call her Chipkali affectionately, Use Bambaiya slang"
              value={customToneInstructions}
              onChange={(e) => setCustomToneInstructions(e.target.value)}
            />
            <span style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: 4, display: 'block' }}>
              💡 Sirf 1-line prompt note ke liye. Bada chat transcript analyze karne ke liye neeche card me <b>"Clone Chat Style"</b> dabayein.
            </span>
          </div>

          {/* Max Message Limit (Auto-Cap Controller) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              📊 Max Messages Limit (Auto-Cap)
            </label>
            <select
              className="text-input"
              style={{ height: 42, fontSize: '0.88rem', background: '#0f172a', color: '#f1f5f9', cursor: 'pointer' }}
              value={formMaxLimit}
              onChange={(e) => setFormMaxLimit(Number(e.target.value))}
            >
              <option value={0}>♾️ Unlimited (or Global Default)</option>
              <option value={3}>🎯 3 Messages Only</option>
              <option value={5}>🎯 5 Messages Only</option>
              <option value={10}>🎯 10 Messages Only</option>
              <option value={20}>🎯 20 Messages Only</option>
              <option value={50}>🎯 50 Messages Only</option>
            </select>
            <span style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: 4, display: 'block' }}>
              Is number ko utne messages bhejte hi bot automatically pause ho jayega.
            </span>
          </div>
        </div>

        {/* Optional Expandable Chat Sample Box right inside the Add Form */}
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setShowFormChatSample(!showFormChatSample)}
            style={{
              background: showFormChatSample ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px dashed rgba(168, 85, 247, 0.4)',
              color: '#d8b4fe',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Dna size={15} color="#c084fc" />
            <span>{showFormChatSample ? '▲ Hide Chat Sample Box' : '▼ + Paste / Upload Chat Samples (To Map Typing Habits Now)'}</span>
          </button>

          {showFormChatSample && (
            <div style={{ marginTop: 10, background: 'rgba(20, 10, 40, 0.4)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>
                  Paste chat exchanges between you and this contact:
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={handlePasteFormExample}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#38bdf8',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                    }}
                  >
                    Quick Sample
                  </button>
                  <label
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#60a5fa',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                    }}
                  >
                    Upload .txt
                    <input type="file" accept=".txt" style={{ display: 'none' }} onChange={handleFormFileUpload} />
                  </label>
                </div>
              </div>
              <textarea
                className="text-input"
                rows={4}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem', background: '#090d16', margin: 0 }}
                placeholder={`Me: suno na khana khaya kya\nContact: haan baba aapne?\nMe: bas abhi nikal raha hu office se.. boht thak gya yaar ❤️`}
                value={formChatSample}
                onChange={(e) => setFormChatSample(e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                Gemini will analyze your typing habits (lowercase, double dots, shorthand, emojis) and map it exclusively to this contact.
              </div>
            </div>
          )}
        </div>

        {/* Feedback Alert */}
        {error && (
          <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={adding}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #10b981, #059669)',
            }}
          >
            <UserPlus size={16} />
            {adding ? 'Saving Contact...' : 'Add Whitelist Contact'}
          </button>
        </div>
      </form>

      {/* Contacts List / Table */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="#10b981" />
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>
              Active Whitelisted Numbers ({contacts.length}):
            </span>
          </div>

          {/* Quick Clone Button in Header */}
          {contacts.length > 0 && (
            <button
              onClick={() => openStyleModal(contacts[0])}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                border: 'none',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 10px rgba(139, 92, 246, 0.35)',
              }}
              title="Open Chat Style Cloner popup"
            >
              <Dna size={15} />
              🧬 Open Chat Style Cloner
            </button>
          )}
        </div>

        {/* 🔍 REAL-TIME SEARCH BOX & FILTER PILLS */}
        {contacts.length > 0 && (
          <div style={{ marginBottom: 16, background: 'rgba(15, 23, 42, 0.45)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search Input */}
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: searchQuery ? '#10b981' : '#64748b',
                    pointerEvents: 'none',
                    transition: 'color 0.2s',
                  }}
                />
                <input
                  type="text"
                  className="text-input"
                  style={{
                    width: '100%',
                    paddingLeft: 36,
                    paddingRight: searchQuery ? 36 : 12,
                    height: 40,
                    margin: 0,
                    fontSize: '0.86rem',
                    background: '#090d16',
                    borderColor: searchQuery ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.12)',
                    boxShadow: searchQuery ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none',
                  }}
                  placeholder="Search by contact name, phone (+91...), relationship, or persona..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: 'none',
                      color: '#cbd5e1',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Quick Filter Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { key: 'ALL', label: `All (${contacts.length})` },
                  { key: 'ACTIVE', label: '🟢 Active' },
                  { key: 'CAP_REACHED', label: '🛑 Cap Reached' },
                  { key: 'CLONED', label: '🧬 Cloned Style' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilterCategory(tab.key)}
                    style={{
                      background: filterCategory === tab.key ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      border: filterCategory === tab.key ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: filterCategory === tab.key ? '#4ade80' : '#94a3b8',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: '0.76rem',
                      fontWeight: filterCategory === tab.key ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Counter & Reset Filter Link */}
            {(searchQuery || filterCategory !== 'ALL') && (
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span>
                  Showing <b>{filteredContacts.length}</b> of <b>{contacts.length}</b> contacts
                  {searchQuery && <> matching "<b>{searchQuery}</b>"</>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('ALL');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Reset Search & Filters
                </button>
              </div>
            )}
          </div>
        )}

        {contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b', fontSize: '0.9rem' }}>
            No contacts in whitelist yet. Add contacts above to allow bot auto-replies!
          </div>
        ) : filteredContacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 12, border: '1px dashed rgba(255, 255, 255, 0.15)', marginTop: 10 }}>
            <Search size={32} color="#64748b" style={{ margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
              No contacts matching "{searchQuery}"
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#94a3b8' }}>
              Check spelling or try searching by phone digits or relationship.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('ALL');
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              Clear Search & Show All
            </button>
          </div>
        ) : (
          <>
            <div className="whitelist-contacts-grid">
              {displayedContacts.map((c) => {
              const badge = getRelationshipBadgeStyle(c.relationship);
              const pKey = c.persona || 'AUTO';
              const isRomantic = pKey === 'ROMANTIC' || (pKey === 'AUTO' && /wife|chipkali|jaan|gf|love/i.test(c.relationship + ' ' + (c.name || '')));
              const isRespectful = pKey === 'RESPECTFUL' || (pKey === 'AUTO' && /bhabhi|mother|father|elder/i.test(c.relationship + ' ' + (c.name || '')));
              const isCasual = pKey === 'CASUAL_SLANG' || (pKey === 'AUTO' && /brother|bhai|friend|dost|gym/i.test(c.relationship + ' ' + (c.name || '')));
              const hasCustomStyle = Boolean(c.styleProfile?.hasCustomStyle);

              return (
                <div
                  key={c._id}
                  style={{
                    background: hasCustomStyle ? 'linear-gradient(145deg, rgba(30, 16, 56, 0.7), rgba(15, 23, 42, 0.8))' : 'rgba(15, 23, 42, 0.55)',
                    border: hasCustomStyle ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 14,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    boxShadow: hasCustomStyle ? '0 6px 24px rgba(168, 85, 247, 0.18)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    {/* Top Row: Phone Number, Name, Delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1.02rem' }}>
                            {c.phoneNumber}
                          </span>
                          {c.name && (
                            <span style={{ fontSize: '0.84rem', color: '#38bdf8', fontWeight: 600 }}>
                              ({c.name})
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(c._id, c.phoneNumber)}
                        title="Delete from whitelist"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          borderRadius: 8,
                          width: 30,
                          height: 30,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Badges Row */}
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          padding: '2px 9px',
                          borderRadius: 12,
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {c.relationship}
                      </span>

                      {/* Dynamic Persona Badge */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 9px',
                          borderRadius: 12,
                          fontWeight: 700,
                          background: isRomantic
                            ? 'rgba(244, 63, 94, 0.15)'
                            : isRespectful
                            ? 'rgba(217, 70, 239, 0.15)'
                            : isCasual
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(34, 197, 94, 0.15)',
                          color: isRomantic
                            ? '#fb7185'
                            : isRespectful
                            ? '#e879f9'
                            : isCasual
                            ? '#60a5fa'
                            : '#4ade80',
                          border: isRomantic
                            ? '1px solid rgba(244, 63, 94, 0.3)'
                            : isRespectful
                            ? '1px solid rgba(217, 70, 239, 0.3)'
                            : isCasual
                            ? '1px solid rgba(59, 130, 246, 0.3)'
                            : '1px solid rgba(34, 197, 94, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isRomantic ? '💖 Romantic' : isRespectful ? '🙏 Respectful' : isCasual ? '⚡ Casual Slang' : '😊 Friendly Tone'}
                      </span>

                      {/* Custom Chat Style Learned Badge */}
                      {hasCustomStyle && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 9px',
                            borderRadius: 12,
                            fontWeight: 700,
                            background: 'rgba(168, 85, 247, 0.25)',
                            color: '#d8b4fe',
                            border: '1px solid rgba(168, 85, 247, 0.5)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            boxShadow: '0 0 10px rgba(168, 85, 247, 0.3)',
                          }}
                        >
                          <Dna size={12} color="#c084fc" />
                          Style Cloned (Exclusive)
                        </span>
                      )}
                    </div>

                    {/* Learned Style Traits Preview */}
                    {hasCustomStyle && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'rgba(20, 10, 40, 0.5)',
                          border: '1px solid rgba(168, 85, 247, 0.25)',
                          fontSize: '0.78rem',
                          color: '#e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c084fc', fontWeight: 600, marginBottom: 4 }}>
                          <Sparkles size={13} />
                          <span>Learned Linguistic Fingerprint:</span>
                        </div>
                        <div style={{ color: '#cbd5e1', marginBottom: 4, fontSize: '0.75rem', lineHeight: '1.3' }}>
                          <b>Tone:</b> {c.styleProfile.tone}
                        </div>
                        {c.styleProfile.vocabulary?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {c.styleProfile.vocabulary.slice(0, 5).map((w, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: 'rgba(168, 85, 247, 0.2)',
                                  border: '1px solid rgba(168, 85, 247, 0.35)',
                                  color: '#e9d5ff',
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  fontSize: '0.7rem',
                                }}
                              >
                                "{w}"
                              </span>
                            ))}
                            {c.styleProfile.vocabulary.length > 5 && (
                              <span style={{ color: '#c084fc', fontSize: '0.7rem', alignSelf: 'center' }}>
                                +{c.styleProfile.vocabulary.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {c.customToneInstructions && !hasCustomStyle && (
                      <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                        Note: "{c.customToneInstructions}"
                      </div>
                    )}

                    {/* Message Limit & Counter Progress Section */}
                    <div
                      style={{
                        marginTop: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: c.isCapReached
                          ? 'rgba(239, 68, 68, 0.12)'
                          : 'rgba(15, 23, 42, 0.65)',
                        border: c.isCapReached
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: c.isCapReached ? '#f87171' : '#e2e8f0' }}>
                            📊 Message Cap:
                          </span>
                          {c.isCapReached ? (
                            <span style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 6, background: '#ef4444', color: '#fff', fontWeight: 800 }}>
                              🛑 CAP REACHED (PAUSED)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                              {c.maxMessageLimit > 0 ? `${c.messagesSentCount || 0}/${c.maxMessageLimit} sent` : `${c.messagesSentCount || 0} sent (♾️ Unlimited)`}
                            </span>
                          )}
                        </div>

                        {/* Limit Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Limit:</span>
                          <select
                            value={c.maxMessageLimit || 0}
                            onChange={(e) => handleQuickLimitChange(c._id, Number(e.target.value), c.name || c.phoneNumber)}
                            style={{
                              background: '#090d16',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              color: '#f8fafc',
                              borderRadius: 6,
                              padding: '2px 6px',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                            }}
                          >
                            <option value={0}>♾️ Unlimited</option>
                            <option value={3}>3 msgs</option>
                            <option value={5}>5 msgs</option>
                            <option value={10}>10 msgs</option>
                            <option value={20}>20 msgs</option>
                            <option value={50}>50 msgs</option>
                          </select>
                        </div>
                      </div>

                      {/* Progress Bar (if limit > 0) */}
                      {c.maxMessageLimit > 0 && (
                        <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.round(((c.messagesSentCount || 0) / c.maxMessageLimit) * 100))}%`,
                              height: '100%',
                              background: c.isCapReached
                                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                : 'linear-gradient(90deg, #10b981, #06b6d4)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      )}

                      {/* Quick Action Buttons: Reset & +5 More */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                          onClick={() => handleResetCounter(c._id, c.name || c.phoneNumber)}
                          title="Reset sent counter to 0 and re-enable bot replies"
                          style={{
                            flex: 1,
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.35)',
                            color: '#60a5fa',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <RefreshCw size={11} />
                          Reset Count (0)
                        </button>
                        <button
                          onClick={() => handleAddMoreLimit(c)}
                          title="Add 5 more messages to allowed limit and unpause bot"
                          style={{
                            flex: 1,
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            color: '#34d399',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <Zap size={11} />
                          +5 More Msgs
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* HIGH-VISIBILITY ACTION BUTTON: CLONE / VIEW STYLE */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 10 }}>
                    <button
                      onClick={() => openStyleModal(c)}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: 9,
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: hasCustomStyle
                          ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                          : 'linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(99, 102, 241, 0.35))',
                        border: hasCustomStyle ? '1px solid #a855f7' : '1px solid rgba(168, 85, 247, 0.55)',
                        color: '#ffffff',
                        boxShadow: '0 3px 12px rgba(139, 92, 246, 0.25)',
                        transition: 'all 0.2s',
                      }}
                      title="Analyze chat logs and teach AI the user's authentic typing quirks"
                    >
                      <Dna size={16} color="#ffffff" />
                      {hasCustomStyle ? '✨ View / Edit Learned Chat Style' : '🧬 Clone My Chat Style (Upload Logs)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredContacts.length > CONTACTS_PER_PAGE && (
            <div className="space-optimizer-bar">
              <button
                type="button"
                onClick={() => setIsExpandedAll(!isExpandedAll)}
                className={`see-all-btn ${isExpandedAll ? 'expanded' : ''}`}
              >
                {isExpandedAll ? (
                  <>
                    <ChevronUp size={15} />
                    <span>Show Fewer Contacts (Collapse to {CONTACTS_PER_PAGE})</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={15} />
                    <span>See All Contacts ({filteredContacts.length} Total)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>

      {/* ======================================================== */}
      {/* CHAT STYLE CLONER & LINGUISTIC TRAIT ANALYZER MODAL     */}
      {/* ======================================================== */}
      {styleModalContact && (
        <div
          className="whitelist-cloner-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setStyleModalContact(null)}
        >
          <div
            className="whitelist-cloner-modal"
            style={{
              background: '#0c1322',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              borderRadius: 18,
              maxWidth: 740,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.35), rgba(59, 130, 246, 0.35))',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c084fc',
                  }}
                >
                  <Dna size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                      Chat Style Cloner & Linguistic Profiler
                    </h3>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 2 }}>
                    Recipient:{' '}
                    <b style={{ color: '#f1f5f9' }}>
                      {styleModalContact.name || styleModalContact.relationship}
                    </b>{' '}
                    ({styleModalContact.phoneNumber}) •{' '}
                    <span style={{ color: '#a855f7', fontWeight: 600 }}>
                      {styleModalContact.relationship}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStyleModalContact(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Strict Exclusivity Notice Banner */}
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(168, 85, 247, 0.1))',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: '0.8rem',
                color: '#cbd5e1',
                lineHeight: 1.4,
              }}
            >
              <ShieldCheck size={18} color="#a855f7" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <b style={{ color: '#e2e8f0' }}>Strict Privacy & Contact Isolation Guarantee:</b>
                <br />
                The vocabulary, typing habits (lowercase, double dots, shorthand), and tone extracted from this chat history will be enforced{' '}
                <b style={{ color: '#38bdf8' }}>EXCLUSIVELY</b> when replying to{' '}
                <b style={{ color: '#f1f5f9' }}>
                  {styleModalContact.name || styleModalContact.relationship} ({styleModalContact.phoneNumber})
                </b>
                . They will never leak to or influence replies to other contacts.
              </div>
            </div>

            {/* Navigation Tabs (Upload/Analyze vs Learned Profile) */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 8 }}>
              {styleModalContact.styleProfile?.hasCustomStyle && (
                <button
                  onClick={() => setActiveModalTab('profile')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: activeModalTab === 'profile' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                    border: activeModalTab === 'profile' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
                    color: activeModalTab === 'profile' ? '#e9d5ff' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={15} color="#c084fc" />
                  Learned Linguistic Profile
                </button>
              )}

              <button
                onClick={() => setActiveModalTab('upload')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeModalTab === 'upload' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  border: activeModalTab === 'upload' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  color: activeModalTab === 'upload' ? '#93c5fd' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <UploadCloud size={15} color="#60a5fa" />
                {styleModalContact.styleProfile?.hasCustomStyle ? 'Re-analyze / Update Chat Logs' : 'Upload & Analyze Chat'}
              </button>
            </div>

            {/* Alerts */}
            {styleModalError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                {styleModalError}
              </div>
            )}
            {styleModalSuccess && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} />
                {styleModalSuccess}
              </div>
            )}

            {/* TAB 1: LEARNED PROFILE VIEW */}
            {activeModalTab === 'profile' && styleModalContact.styleProfile?.hasCustomStyle && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                  {/* Tone Card */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Heart size={14} color="#f43f5e" />
                      Conversational Tone & Mood:
                    </div>
                    <div style={{ fontSize: '0.92rem', color: '#f1f5f9', fontWeight: 500, lineHeight: 1.4 }}>
                      {styleModalContact.styleProfile.tone}
                    </div>
                  </div>

                  {/* Typing Habits Card */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Sliders size={14} color="#38bdf8" />
                      Typing Habits & Punctuation Mechanics:
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                      {styleModalContact.styleProfile.typingHabits}
                    </div>
                  </div>

                  {/* Vocabulary & Pet Names */}
                  {styleModalContact.styleProfile.vocabulary?.length > 0 && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Tag size={14} color="#a855f7" />
                        Mapped Vocabulary, Pet Names & Slang:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {styleModalContact.styleProfile.vocabulary.map((word, i) => (
                          <span
                            key={i}
                            style={{
                              background: 'rgba(168, 85, 247, 0.15)',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              color: '#d8b4fe',
                              padding: '3px 10px',
                              borderRadius: 8,
                              fontSize: '0.8rem',
                              fontWeight: 500,
                            }}
                          >
                            "{word}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Typical Catchphrases */}
                  {styleModalContact.styleProfile.typicalPhrases?.length > 0 && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <MessageSquare size={14} color="#10b981" />
                        Frequent Catchphrases / Expressions:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {styleModalContact.styleProfile.typicalPhrases.map((phrase, i) => (
                          <div
                            key={i}
                            style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              borderLeft: '3px solid #10b981',
                              padding: '6px 12px',
                              borderRadius: '0 8px 8px 0',
                              fontSize: '0.82rem',
                              color: '#a7f3d0',
                            }}
                          >
                            "{phrase}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Authentic Snippet References */}
                  {styleModalContact.styleProfile.sampleSnippets?.length > 0 && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Quote size={14} color="#eab308" />
                        Authentic Chat Snippets Cloned from User:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {styleModalContact.styleProfile.sampleSnippets.map((snippet, i) => (
                          <div
                            key={i}
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px dashed rgba(255, 255, 255, 0.12)',
                              padding: '6px 10px',
                              borderRadius: 6,
                              fontSize: '0.8rem',
                              color: '#cbd5e1',
                              fontFamily: 'monospace',
                            }}
                          >
                            💬 "{snippet}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generated AI Directive */}
                  {styleModalContact.styleProfile.stylePromptDirective && (
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Bot size={14} color="#6366f1" />
                        Exclusive AI Prompt Directive Sent to Gemini:
                      </div>
                      <div
                        style={{
                          background: '#090d16',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          fontSize: '0.78rem',
                          color: '#cbd5e1',
                          fontFamily: 'monospace',
                          lineHeight: 1.5,
                        }}
                      >
                        {styleModalContact.styleProfile.stylePromptDirective}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    onClick={handleClearStyle}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Trash2 size={14} />
                    Reset to Default Persona
                  </button>

                  <button
                    onClick={() => setActiveModalTab('upload')}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 18px',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <UploadCloud size={14} />
                    Update / Re-analyze Chat Logs
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: UPLOAD / PASTE LOGS VIEW */}
            {(activeModalTab === 'upload' || !styleModalContact.styleProfile?.hasCustomStyle) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0' }}>
                    Paste WhatsApp Chat Transcript or Upload Export File:
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handlePasteExample}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#38bdf8',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Sparkles size={12} />
                      Insert Quick Sample
                    </button>

                    <label
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#60a5fa',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <UploadCloud size={12} />
                      Upload .txt Export
                      <input
                        type="file"
                        accept=".txt"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>

                <textarea
                  className="text-input"
                  rows={8}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    background: '#070c18',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 10,
                    padding: 12,
                    resize: 'vertical',
                  }}
                  placeholder={`Paste conversation history here...\nExamples:\nMe: suno na khana khaya kya\nChipkali: haan baba aapne khaya?\nMe: bas abhi baitha hu.. boht thak gya yaar ❤️\n\nOr paste standard WhatsApp export logs [date, time] Name: message`}
                  value={chatSampleInput}
                  onChange={(e) => setChatSampleInput(e.target.value)}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '0.76rem', color: '#94a3b8' }}>
                  <span>
                    Length: <b>{chatSampleInput.length}</b> characters (Recommended: 100+ chars)
                  </span>
                  <span>Supports Hinglish, English, Desi Slangs, Emojis & Punctuation quirks</span>
                </div>

                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setStyleModalContact(null)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={analyzingStyle || chatSampleInput.trim().length < 20}
                    onClick={handleAnalyzeStyle}
                    style={{
                      background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '8px 22px',
                      borderRadius: 8,
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      cursor: analyzingStyle ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
                    }}
                  >
                    <Dna size={16} className={analyzingStyle ? 'spin' : ''} />
                    {analyzingStyle ? 'Analyzing Chat Patterns with Gemini...' : 'Analyze & Map Stylistic Fingerprint'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
