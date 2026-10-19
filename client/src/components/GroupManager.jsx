import React, { useState, useEffect } from 'react';
import {
  Users,
  Check,
  Save,
  Sparkles,
  RefreshCw,
  Play,
  Clock,
  Zap,
  Globe,
  Sliders,
  AlertCircle,
  MessageSquare,
  Shield,
  Layers,
  Search,
} from 'lucide-react';

const GROUP_PRESETS = [
  {
    name: 'Desi Dost & Active Member',
    prompt:
      'Tum WhatsApp group ke ek sensible, helpful aur active member ho. Group members aapas me jo bhi baat kar rahe hain ya sawal puch rahe hain, conversation ko samajh kar bilkul relevant/related, short (1-2 sentences) aur natural jawab do. Desi Hinglish ya Hindi me reply karo jaise group me log baat karte hain. Kabhi faltu lambe robotic bhashan mat do aur na hi spam karo.',
  },
  {
    name: 'Helpful & Professional',
    prompt:
      'You are a polite, helpful, and attentive member of this WhatsApp group. Respond only with information that is directly relevant to what was asked or discussed in the group. Keep replies strictly to 1 or 2 concise, friendly sentences.',
  },
  {
    name: 'Fun & Casual Banter',
    prompt:
      'Tum group ke chill aur witty member ho. Group conversation ko follow karte huye light-hearted, friendly aur relevant short reply do. Har baat pe unnecessary advice mat do, sensible desi casual chat rakho.',
  },
];

export default function GroupManager({ settings, onUpdateSettings, updating, logs = [] }) {
  const [groupAutoReplyEnabled, setGroupAutoReplyEnabled] = useState(settings?.groupAutoReplyEnabled ?? false);
  const [groupTargetScope, setGroupTargetScope] = useState(settings?.groupTargetScope || 'ALL');
  const [targetGroups, setTargetGroups] = useState(Array.isArray(settings?.targetGroups) ? settings.targetGroups : []);
  const [groupReplyMode, setGroupReplyMode] = useState(settings?.groupReplyMode || 'ALL');
  const [groupTriggerKeywords, setGroupTriggerKeywords] = useState(
    Array.isArray(settings?.groupTriggerKeywords)
      ? settings.groupTriggerKeywords.join(', ')
      : '@bot, wasim, bot, bhai, help, kaha ho, suno'
  );
  const [groupSystemPrompt, setGroupSystemPrompt] = useState(
    settings?.groupSystemPrompt ||
      'Tum WhatsApp group ke ek sensible, helpful aur active member ho. Group members aapas me jo bhi baat kar rahe hain ya sawal puch rahe hain, conversation ko samajh kar bilkul relevant/related, short (1-2 sentences) aur natural jawab do. Desi Hinglish ya Hindi me reply karo jaise group me log baat karte hain. Kabhi faltu lambe robotic bhashan mat do aur na hi spam karo.'
  );
  const [groupCooldownSeconds, setGroupCooldownSeconds] = useState(settings?.groupCooldownSeconds ?? 5);
  const [groupQuoteOriginal, setGroupQuoteOriginal] = useState(settings?.groupQuoteOriginal ?? true);

  // Live WhatsApp Groups from Baileys
  const [availableWhatsAppGroups, setAvailableWhatsAppGroups] = useState([]);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Add Form
  const [manualName, setManualName] = useState('');
  const [manualJid, setManualJid] = useState('');

  // Sandbox Tester
  const [testGroupName, setTestGroupName] = useState('Wasim Tech Family');
  const [testSenderName, setTestSenderName] = useState('Faizan Ali');
  const [testMessage, setTestMessage] = useState('Bhai kal meeting ka timing kya hai?');
  const [testingReply, setTestingReply] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync when settings prop updates
  useEffect(() => {
    if (settings) {
      setGroupAutoReplyEnabled(settings.groupAutoReplyEnabled ?? false);
      setGroupTargetScope(settings.groupTargetScope || 'ALL');
      if (Array.isArray(settings.targetGroups)) {
        setTargetGroups(settings.targetGroups);
      }
      setGroupReplyMode(settings.groupReplyMode || 'ALL');
      if (Array.isArray(settings.groupTriggerKeywords)) {
        setGroupTriggerKeywords(settings.groupTriggerKeywords.join(', '));
      }
      setGroupSystemPrompt(
        settings.groupSystemPrompt ||
          'Tum WhatsApp group ke ek sensible, helpful aur active member ho. Group members aapas me jo bhi baat kar rahe hain ya sawal puch rahe hain, conversation ko samajh kar bilkul relevant/related, short (1-2 sentences) aur natural jawab do. Desi Hinglish ya Hindi me reply karo jaise group me log baat karte hain. Kabhi faltu lambe robotic bhashan mat do aur na hi spam karo.'
      );
      setGroupCooldownSeconds(settings.groupCooldownSeconds ?? 5);
      setGroupQuoteOriginal(settings.groupQuoteOriginal ?? true);
    }
  }, [settings]);

  // Master Toggle Handler
  const handleToggleGroup = async () => {
    const nextState = !groupAutoReplyEnabled;
    setGroupAutoReplyEnabled(nextState);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled: nextState,
      groupTargetScope,
      targetGroups,
      groupReplyMode,
      groupTriggerKeywords: groupTriggerKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal,
    });
  };

  // Save Settings to Backend
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    const res = await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope,
      targetGroups,
      groupReplyMode,
      groupTriggerKeywords: groupTriggerKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal,
    });
    if (res) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  // Fetch Live WhatsApp Groups
  const handleFetchGroups = async () => {
    setFetchingGroups(true);
    setFetchStatus(null);
    try {
      const res = await fetch('/api/settings/whatsapp-groups');
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setAvailableWhatsAppGroups(data.groups);
        setFetchStatus({
          success: true,
          message: `Found ${data.groups.length} participating WhatsApp groups!`,
        });
      } else {
        setFetchStatus({
          success: false,
          message: data.message || data.error || 'WhatsApp Web is not linked. Please connect via QR code first.',
        });
      }
    } catch (err) {
      setFetchStatus({ success: false, message: err.message || 'Failed to connect to server' });
    } finally {
      setFetchingGroups(false);
    }
  };

  // Instant Scope Switch Handler (Auto-saves immediately to MongoDB)
  const handleScopeChange = async (newScope) => {
    setGroupTargetScope(newScope);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope: newScope,
      targetGroups,
      groupReplyMode,
      groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
        ? groupTriggerKeywords
        : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal,
    });
  };

  // Instant Toggle Target Group Selection (Auto-saves immediately)
  const handleToggleTargetGroup = async (group) => {
    const existingIdx = targetGroups.findIndex(
      (g) => (g.jid && g.jid === group.jid) || (g.name && group.name && g.name.toLowerCase() === group.name.toLowerCase())
    );
    let nextTargets;
    if (existingIdx >= 0) {
      nextTargets = targetGroups.filter((_, idx) => idx !== existingIdx);
    } else {
      nextTargets = [...targetGroups, { jid: group.jid, name: group.name, isEnabled: true }];
    }
    setTargetGroups(nextTargets);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope,
      targetGroups: nextTargets,
      groupReplyMode,
      groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
        ? groupTriggerKeywords
        : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal,
    });
  };

  // Instant Remove single target group (Auto-saves immediately)
  const handleRemoveTargetGroup = async (index) => {
    const nextTargets = targetGroups.filter((_, idx) => idx !== index);
    setTargetGroups(nextTargets);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope,
      targetGroups: nextTargets,
      groupReplyMode,
      groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
        ? groupTriggerKeywords
        : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal,
    });
  };

  // Instant Clear All Targets
  const handleClearAllTargets = async () => {
    setTargetGroups([]);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope,
      targetGroups: [],
      groupReplyMode,
      groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
        ? groupTriggerKeywords
        : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal,
    });
  };

  // Instant Add Manual Target Group (Auto-saves immediately)
  const handleAddManualGroup = async (e) => {
    if (e) e.preventDefault();
    if (!manualName.trim() && !manualJid.trim()) return;

    const jidToAdd = manualJid.trim() || `${Date.now()}@g.us`;
    const nameToAdd = manualName.trim() || manualJid.trim();

    const exists = targetGroups.some(
      (g) => (g.jid && g.jid === jidToAdd) || (g.name && g.name.toLowerCase() === nameToAdd.toLowerCase())
    );

    if (!exists) {
      const nextTargets = [...targetGroups, { jid: jidToAdd, name: nameToAdd, isEnabled: true }];
      setTargetGroups(nextTargets);
      await onUpdateSettings({
        ...settings,
        groupAutoReplyEnabled,
        groupTargetScope,
        targetGroups: nextTargets,
        groupReplyMode,
        groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
          ? groupTriggerKeywords
          : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
        groupSystemPrompt,
        groupCooldownSeconds: Number(groupCooldownSeconds),
        groupQuoteOriginal,
      });
    }

    setManualName('');
    setManualJid('');
  };

  // Instant Reply Mode Change
  const handleReplyModeChange = async (newMode) => {
    setGroupReplyMode(newMode);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope,
      targetGroups,
      groupReplyMode: newMode,
      groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
        ? groupTriggerKeywords
        : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal,
    });
  };

  // Instant Anti-Spam Cooldown Change
  const handleCooldownChange = async (newSec) => {
    setGroupCooldownSeconds(newSec);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope,
      targetGroups,
      groupReplyMode,
      groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
        ? groupTriggerKeywords
        : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(newSec),
      groupQuoteOriginal,
    });
  };

  // Instant WhatsApp Quoting Toggle
  const handleQuoteToggle = async () => {
    const nextQuote = !groupQuoteOriginal;
    setGroupQuoteOriginal(nextQuote);
    await onUpdateSettings({
      ...settings,
      groupAutoReplyEnabled,
      groupTargetScope,
      targetGroups,
      groupReplyMode,
      groupTriggerKeywords: Array.isArray(groupTriggerKeywords)
        ? groupTriggerKeywords
        : String(groupTriggerKeywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      groupSystemPrompt,
      groupCooldownSeconds: Number(groupCooldownSeconds),
      groupQuoteOriginal: nextQuote,
    });
  };

  // Test Group Reply
  const handleTestGroupReply = async (e) => {
    if (e) e.preventDefault();
    if (!testMessage.trim()) return;
    setTestingReply(true);
    setTestResult(null);

    const matchedTg = targetGroups.find(
      (g) => g.name && g.name.toLowerCase().trim() === testGroupName.toLowerCase().trim()
    );

    try {
      const res = await fetch('/api/settings/test-group-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: testGroupName,
          groupJid: matchedTg ? matchedTg.jid : '120363023456789012@g.us',
          senderName: testSenderName,
          messageText: testMessage,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingReply(false);
    }
  };

  // Filter group logs from logs array
  const groupLogs = logs.filter(
    (l) => l.status === 'GROUP_REPLY_SENT' || l.routingCategory === 'GROUP_CHAT' || (l.sender && l.sender.includes('[Group:'))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 🚀 Main Header Banner Card */}
      <div
        style={{
          padding: '20px 24px',
          background: groupAutoReplyEnabled
            ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(99, 102, 241, 0.18))'
            : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${groupAutoReplyEnabled ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 16,
          boxShadow: groupAutoReplyEnabled ? '0 8px 32px rgba(14, 165, 233, 0.15)' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: groupAutoReplyEnabled ? 'rgba(14, 165, 233, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${groupAutoReplyEnabled ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            }}
          >
            <Users size={28} color={groupAutoReplyEnabled ? '#38bdf8' : '#9ca3af'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                WhatsApp Groups Studio (ग्रुप ऑटो-रिप्लाई व टारगेट फ़िल्टर)
              </h2>
              <span
                className="label-badge"
                style={{
                  background: groupAutoReplyEnabled ? 'rgba(14, 165, 233, 0.25)' : 'rgba(107, 114, 128, 0.2)',
                  color: groupAutoReplyEnabled ? '#7dd3fc' : '#9ca3af',
                  borderColor: groupAutoReplyEnabled ? '#0284c7' : 'rgba(255, 255, 255, 0.1)',
                  fontSize: '0.8rem',
                  padding: '3px 10px',
                }}
              >
                {groupAutoReplyEnabled ? '👥 Group AI: ONLINE & ACTIVE' : 'Group Replies: OFF'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: groupAutoReplyEnabled ? '#bae6fd' : '#94a3b8', lineHeight: 1.5 }}>
              Selective WhatsApp Group Auto-Reply: Apne chune hue WhatsApp groups me aane wale messages ko AI se analyse karke bilkul relevant, short aur natural reply bhejein.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            className={`toggle-switch ${groupAutoReplyEnabled ? 'on' : ''}`}
            onClick={handleToggleGroup}
            disabled={updating}
            role="switch"
            aria-checked={groupAutoReplyEnabled}
            aria-label="Toggle WhatsApp Group Auto-Reply"
            style={{
              background: groupAutoReplyEnabled ? '#0284c7' : undefined,
              width: 52,
              height: 28,
            }}
          >
            <span className="toggle-knob" style={{ width: 22, height: 22 }}></span>
          </button>
        </div>
      </div>

      {/* 🎯 Quick Stats Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 2 }}>Target Scope</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: groupTargetScope === 'SELECTED' ? '#fde047' : '#38bdf8' }}>
            {groupTargetScope === 'SELECTED' ? `🎯 Selected Groups (${targetGroups.length})` : '🌐 All WhatsApp Groups'}
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 2 }}>Trigger Mode</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: groupReplyMode === 'MENTION_ONLY' ? '#c084fc' : '#4ade80' }}>
            {groupReplyMode === 'MENTION_ONLY' ? '🏷️ Mention & Keyword Only' : '💬 All Incoming Messages'}
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 2 }}>Anti-Spam Cooldown</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8' }}>
            ⏳ {groupCooldownSeconds}s Delay per Group
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.07)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 2 }}>WhatsApp Quoting</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: groupQuoteOriginal ? '#4ade80' : '#9ca3af' }}>
            {groupQuoteOriginal ? '✅ Quoting Original Message' : '⚪ Normal Message Send'}
          </div>
        </div>
      </div>

      {/* 🎯 Section 1: Target Groups Selection Panel */}
      <div
        style={{
          padding: '20px',
          borderRadius: 14,
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🎯 Step 1: Target Groups Filter (ग्रुप सेलेक्शन)</span>
              <span
                className="label-badge"
                style={{
                  background: groupTargetScope === 'SELECTED' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(14, 165, 233, 0.2)',
                  color: groupTargetScope === 'SELECTED' ? '#fde047' : '#38bdf8',
                  borderColor: groupTargetScope === 'SELECTED' ? '#ca8a04' : '#0284c7',
                }}
              >
                {groupTargetScope === 'SELECTED' ? `🎯 Targeted: ${targetGroups.length} Groups` : '🌐 All Groups Mode'}
              </span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Chunein ki bot aapke sabhi groups me reply kare ya sirf aapke dwara select kiye gaye specific groups me.
            </p>
          </div>
        </div>

        {/* Scope Selector: All Groups vs Selected Groups */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div
            onClick={() => handleScopeChange('ALL')}
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              cursor: 'pointer',
              background: groupTargetScope === 'ALL' ? 'rgba(14, 165, 233, 0.16)' : 'rgba(255, 255, 255, 0.03)',
              border: `2px solid ${groupTargetScope === 'ALL' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: `2px solid ${groupTargetScope === 'ALL' ? '#38bdf8' : '#6b7280'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {groupTargetScope === 'ALL' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#38bdf8' }} />}
              </div>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: groupTargetScope === 'ALL' ? '#38bdf8' : '#e5e7eb' }}>
                🌐 All WhatsApp Groups (Sabhi Groups)
              </span>
            </div>
            <p style={{ margin: '6px 0 0 28px', fontSize: '0.78rem', color: '#94a3b8' }}>
              Aapka bot phone me maujood sabhi WhatsApp groups me aane wale message par reply karega.
            </p>
          </div>

          <div
            onClick={() => handleScopeChange('SELECTED')}
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              cursor: 'pointer',
              background: groupTargetScope === 'SELECTED' ? 'rgba(234, 179, 8, 0.16)' : 'rgba(255, 255, 255, 0.03)',
              border: `2px solid ${groupTargetScope === 'SELECTED' ? '#facc15' : 'rgba(255, 255, 255, 0.08)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: `2px solid ${groupTargetScope === 'SELECTED' ? '#facc15' : '#6b7280'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {groupTargetScope === 'SELECTED' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#facc15' }} />}
              </div>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: groupTargetScope === 'SELECTED' ? '#facc15' : '#e5e7eb' }}>
                🎯 Selected Groups Only (Sirf Chune Hue Groups)
              </span>
            </div>
            <p style={{ margin: '6px 0 0 28px', fontSize: '0.78rem', color: '#94a3b8' }}>
              Bot <strong>sirf target kiye gaye groups me</strong> reply karega. Baaki sabhi groups ko silently ignore karega.
            </p>
          </div>
        </div>

        {/* Selected Groups Detailed Box */}
        {groupTargetScope === 'SELECTED' && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {/* Active Target Group Chips */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.84rem', color: '#fde047', fontWeight: 700 }}>
                  📌 Active Target Groups ({targetGroups.length}):
                </span>
                {targetGroups.length > 0 && (
                  <button
                    type="button"
                    className="chip-btn"
                    style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    onClick={handleClearAllTargets}
                  >
                    Clear All Targets
                  </button>
                )}
              </div>

              {targetGroups.length === 0 ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px dashed rgba(234, 179, 8, 0.4)',
                    color: '#fef08a',
                    fontSize: '0.82rem',
                  }}
                >
                  ⚠️ Abhi tak koi specific group target nahi kiya gaya hai. Niche <strong>"Fetch My WhatsApp Groups"</strong> dabayein aur apne pasandeeda groups select karein.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {targetGroups.map((tg, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 24,
                        background: 'rgba(234, 179, 8, 0.2)',
                        border: '1px solid rgba(234, 179, 8, 0.5)',
                        color: '#fef08a',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>👥 {tg.name || tg.jid}</span>
                      <span style={{ fontSize: '0.7rem', color: '#ca8a04', fontWeight: 400 }}>
                        ({tg.jid && tg.jid.includes('@') ? tg.jid.split('@')[0].slice(-6) + '@g.us' : tg.jid})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTargetGroup(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: 4,
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          lineHeight: 1,
                        }}
                        title="Remove from target list"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fetch Groups Button & Status */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <button
                type="button"
                onClick={handleFetchGroups}
                disabled={fetchingGroups}
                className="chip-btn"
                style={{
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  background: 'rgba(14, 165, 233, 0.25)',
                  borderColor: '#38bdf8',
                  color: '#38bdf8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 700,
                }}
              >
                <RefreshCw size={14} className={fetchingGroups ? 'animate-spin' : ''} />
                <span>{fetchingGroups ? 'Loading WhatsApp Groups...' : '🔄 Fetch My WhatsApp Groups (लाइव ग्रुप्स लाएं)'}</span>
              </button>

              {fetchStatus && (
                <span style={{ fontSize: '0.82rem', color: fetchStatus.success ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                  {fetchStatus.message}
                </span>
              )}
            </div>

            {/* Live WhatsApp Groups List (if loaded) */}
            {availableWhatsAppGroups.length > 0 && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '14px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 700 }}>
                    WhatsApp Web Connected Groups ({availableWhatsAppGroups.length}) — Click checkbox to target:
                  </span>
                  <div style={{ position: 'relative', width: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search group name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-input"
                      style={{ width: '100%', height: 30, fontSize: '0.78rem', paddingLeft: 28 }}
                    />
                  </div>
                </div>

                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {availableWhatsAppGroups
                    .filter((g) => !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((g) => {
                      const isSelected = targetGroups.some((tg) => tg.jid === g.jid);
                      return (
                        <div
                          key={g.jid}
                          onClick={() => handleToggleTargetGroup(g)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(234, 179, 8, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isSelected ? 'rgba(234, 179, 8, 0.5)' : 'rgba(255, 255, 255, 0.05)'}`,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: 'pointer', width: 16, height: 16 }}
                            />
                            <div>
                              <span style={{ fontSize: '0.86rem', color: isSelected ? '#fde047' : '#fff', fontWeight: isSelected ? 700 : 500 }}>
                                {g.name}
                              </span>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                JID: {g.jid}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.76rem', color: isSelected ? '#fde047' : '#94a3b8', fontWeight: 600 }}>
                            {g.memberCount ? `👥 ${g.memberCount} members` : ''}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Manual Group Add Form */}
            <div style={{ paddingTop: 10, borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                Or Add Group Manually (Agar koi group list me na dikhe):
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="text-input"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Group Name (e.g. Wasim Family Tech)"
                  style={{ flex: 1, minWidth: 180, height: 36, fontSize: '0.82rem' }}
                />
                <input
                  type="text"
                  className="text-input"
                  value={manualJid}
                  onChange={(e) => setManualJid(e.target.value)}
                  placeholder="Group JID (optional e.g. 1203630...@g.us)"
                  style={{ flex: 1, minWidth: 180, height: 36, fontSize: '0.82rem' }}
                />
                <button
                  type="button"
                  className="chip-btn"
                  onClick={handleAddManualGroup}
                  disabled={!manualName.trim() && !manualJid.trim()}
                  style={{
                    height: 36,
                    padding: '0 16px',
                    fontSize: '0.82rem',
                    borderColor: '#facc15',
                    color: '#facc15',
                    background: 'rgba(234, 179, 8, 0.2)',
                    fontWeight: 700,
                  }}
                >
                  + Add to Target List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🏷️ Section 2: Trigger Mode & Anti-Spam Controls */}
      <div
        style={{
          padding: '20px',
          borderRadius: 14,
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
          🏷️ Step 2: Group Trigger Mode & Anti-Spam Safety
        </h3>

        {/* Mode Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div
            onClick={() => handleReplyModeChange('ALL')}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              background: groupReplyMode === 'ALL' ? 'rgba(14, 165, 233, 0.18)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${groupReplyMode === 'ALL' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `2px solid ${groupReplyMode === 'ALL' ? '#38bdf8' : '#6b7280'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {groupReplyMode === 'ALL' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />}
              </div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: groupReplyMode === 'ALL' ? '#38bdf8' : '#fff' }}>
                🌐 Har Message Par Related Reply
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', paddingLeft: 24 }}>
              Group me jo bhi baat chal rahi ho us se related aur relevant short AI reply bhejega.
            </p>
          </div>

          <div
            onClick={() => handleReplyModeChange('MENTION_ONLY')}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              background: groupReplyMode === 'MENTION_ONLY' ? 'rgba(14, 165, 233, 0.18)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${groupReplyMode === 'MENTION_ONLY' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `2px solid ${groupReplyMode === 'MENTION_ONLY' ? '#38bdf8' : '#6b7280'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {groupReplyMode === 'MENTION_ONLY' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />}
              </div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: groupReplyMode === 'MENTION_ONLY' ? '#38bdf8' : '#fff' }}>
                🏷️ Mention & Keyword Triggers Only (Recommended)
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', paddingLeft: 24 }}>
              Sirf tab reply karega jab message me bot ka @mention, naam ya trigger words shamil hon.
            </p>
          </div>
        </div>

        {/* Trigger Keywords */}
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
            🔑 Trigger Keywords (Comma separated):
          </label>
          <input
            type="text"
            className="text-input"
            value={groupTriggerKeywords}
            onChange={(e) => setGroupTriggerKeywords(e.target.value)}
            placeholder="@bot, wasim, bot, bhai, help, kaha ho, suno"
            style={{ height: 38, fontSize: '0.85rem' }}
          />
        </div>

        {/* Anti-Spam & Quoting */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              ⏳ Anti-Spam Cooldown Delay:
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[3, 5, 10, 15, 30].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`chip-btn ${groupCooldownSeconds === sec ? 'active' : ''}`}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    background: groupCooldownSeconds === sec ? 'rgba(14, 165, 233, 0.25)' : undefined,
                    borderColor: groupCooldownSeconds === sec ? '#38bdf8' : undefined,
                    color: groupCooldownSeconds === sec ? '#38bdf8' : undefined,
                    fontWeight: 600,
                  }}
                  onClick={() => handleCooldownChange(sec)}
                >
                  {sec}s Delay
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              💬 WhatsApp Quoting:
            </label>
            <button
              type="button"
              onClick={handleQuoteToggle}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: groupQuoteOriginal ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${groupQuoteOriginal ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                color: groupQuoteOriginal ? '#38bdf8' : '#9ca3af',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
              }}
            >
              <Check size={14} style={{ opacity: groupQuoteOriginal ? 1 : 0.3 }} />
              <span>{groupQuoteOriginal ? 'Quote Sender Message (Clear Context)' : 'Normal Send (No Quote)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🧠 Section 3: Group Persona Prompt */}
      <div
        style={{
          padding: '20px',
          borderRadius: 14,
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
            🧠 Step 3: Group AI Persona & System Prompt
          </h3>
          <div className="preset-chips" style={{ margin: 0 }}>
            {GROUP_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="chip-btn"
                style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                onClick={() => setGroupSystemPrompt(p.prompt)}
              >
                <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <textarea
          className="textarea-input"
          rows={3}
          value={groupSystemPrompt}
          onChange={(e) => setGroupSystemPrompt(e.target.value)}
          placeholder="Instruction for group context and related responses..."
          style={{ fontSize: '0.84rem' }}
        />

        {/* Save Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={updating}
            style={{
              padding: '8px 20px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>Saved to Database!</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{updating ? 'Saving...' : 'Save All Group Settings'}</span>
              </>
            )}
          </button>
          {savedSuccess && (
            <span style={{ fontSize: '0.82rem', color: '#4ade80' }}>
              Group preferences updated in real-time.
            </span>
          )}
        </div>
      </div>

      {/* 🧪 Section 4: Live Interactive Group Simulator Test */}
      <div
        style={{
          padding: '20px',
          borderRadius: 14,
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} color="#38bdf8" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>
            🧪 Step 4: Live Group Auto-Reply Tester (Instant Verification)
          </h3>
        </div>

        {/* Quick Pick Target Chips */}
        {targetGroups.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#fde047', fontWeight: 700 }}>Quick Pick Target:</span>
            {targetGroups.map((tg, i) => (
              <button
                key={i}
                type="button"
                className="chip-btn"
                style={{
                  fontSize: '0.74rem',
                  padding: '3px 10px',
                  borderColor: testGroupName === tg.name ? '#facc15' : 'rgba(234, 179, 8, 0.3)',
                  color: testGroupName === tg.name ? '#fde047' : '#fef08a',
                  background: testGroupName === tg.name ? 'rgba(234, 179, 8, 0.25)' : undefined,
                  fontWeight: 600,
                }}
                onClick={() => setTestGroupName(tg.name)}
              >
                👥 {tg.name}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleTestGroupReply}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Group Name:
              </label>
              <input
                type="text"
                className="text-input"
                value={testGroupName}
                onChange={(e) => setTestGroupName(e.target.value)}
                placeholder="e.g. Wasim Tech Family"
                style={{ height: 38, fontSize: '0.84rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Group Member Name:
              </label>
              <input
                type="text"
                className="text-input"
                value={testSenderName}
                onChange={(e) => setTestSenderName(e.target.value)}
                placeholder="e.g. Faizan Ali"
                style={{ height: 38, fontSize: '0.84rem' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              Incoming Group Message:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="text-input"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="e.g. Kal match dekhne kahan chal rahe hain?"
                style={{ height: 40, fontSize: '0.88rem', flex: 1 }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={testingReply || !testMessage.trim()}
                style={{
                  height: 40,
                  padding: '0 20px',
                  fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, #0284c7, #6366f1)',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Play size={14} />
                <span>{testingReply ? 'Testing...' : 'Test Reply'}</span>
              </button>
            </div>
          </div>
        </form>

        {testResult && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: testResult.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${testResult.success ? '#22c55e' : '#ef4444'}`,
              marginTop: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: testResult.success ? '#4ade80' : '#f87171' }}>
                {testResult.success ? '✅ Related Group AI Reply Dispatched:' : '❌ Reply Not Sent:'}
              </span>
              {testResult.provider && (
                <span style={{ fontSize: '0.74rem', color: '#9ca3af' }}>AI Model: {testResult.provider}</span>
              )}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#fff', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8 }}>
              "{testResult.replyText || testResult.message || testResult.error}"
            </div>
          </div>
        )}
      </div>

      {/* 📜 Section 5: Recent Group Message Logs */}
      {groupLogs.length > 0 && (
        <div
          style={{
            padding: '20px',
            borderRadius: 14,
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} color="#38bdf8" />
              <span>Recent WhatsApp Group Messages Audit ({groupLogs.length})</span>
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {groupLogs.slice(0, 10).map((log, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: 600, marginBottom: 2 }}>
                    👥 {log.sender}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginBottom: 4 }}>
                    <strong>In:</strong> "{log.messageIn}"
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#4ade80' }}>
                    <strong>Out:</strong> "{log.messageOut}"
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
