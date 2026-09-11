import React, { useState } from 'react';
import { Tag, Flame, AlertTriangle, Zap, Snowflake, Smile, Frown, HeartHandshake, HelpCircle, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const TAG_CONFIG = {
  HOT_LEAD: {
    label: 'HOT LEAD',
    icon: Flame,
    color: '#ff4d4d',
    bg: 'rgba(255, 77, 77, 0.15)',
    border: 'rgba(255, 77, 77, 0.4)',
  },
  HIGH_PRIORITY: {
    label: 'HIGH PRIORITY',
    icon: Zap,
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgba(234, 179, 8, 0.4)',
  },
  SUPPORT_COMPLAINT: {
    label: 'SUPPORT COMPLAINT',
    icon: AlertTriangle,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.2)',
    border: 'rgba(239, 68, 68, 0.5)',
  },
  COLD_LEAD: {
    label: 'COLD LEAD',
    icon: Snowflake,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.4)',
  },
  NEUTRAL: {
    label: 'NEUTRAL',
    icon: HelpCircle,
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.3)',
  },
};

const SENTIMENT_CONFIG = {
  HAPPY: { label: 'Happy', emoji: '😊', color: '#4ade80' },
  INTERESTED: { label: 'Interested', emoji: '😍', color: '#38bdf8' },
  NEUTRAL: { label: 'Neutral', emoji: '😐', color: '#94a3b8' },
  FRUSTRATED: { label: 'Frustrated', emoji: '😡', color: '#f87171' },
};

export default function CrmLeadBoard({ contacts = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState('ALL');
  const [updatingId, setUpdatingId] = useState(null);

  // Filter contacts by active tag tab
  const filteredContacts = contacts.filter((c) => {
    const tag = c.crmTag || 'NEUTRAL';
    if (activeTab === 'ALL') return true;
    return tag === activeTab;
  });

  // Space optimization state (Show top 6 leads with 'See All' toggle)
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const LEADS_PER_PAGE = 6;
  const displayedContacts = isExpandedAll ? filteredContacts : filteredContacts.slice(0, LEADS_PER_PAGE);

  // Calculate quick stats
  const hotLeadsCount = contacts.filter((c) => c.crmTag === 'HOT_LEAD').length;
  const highPriorityCount = contacts.filter((c) => c.crmTag === 'HIGH_PRIORITY').length;
  const complaintsCount = contacts.filter((c) => c.crmTag === 'SUPPORT_COMPLAINT').length;

  const handleTagChange = async (contactId, newTag) => {
    setUpdatingId(contactId);
    try {
      const res = await fetch(`/api/whitelist/${contactId}/crm-tag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmTag: newTag }),
      });
      if (res.ok && onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Error updating CRM tag:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="glass-card" style={{ marginTop: 20 }}>
      <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag size={20} color="#ff4d4d" />
          CRM Lead Auto-Tagging & Sentiment Dashboard
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {hotLeadsCount > 0 && (
            <span className="badge" style={{ background: 'rgba(255,77,77,0.2)', color: '#ff4d4d', border: '1px solid rgba(255,77,77,0.4)', padding: '3px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
              🔥 {hotLeadsCount} Hot Leads
            </span>
          )}
          {complaintsCount > 0 && (
            <span className="badge" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', padding: '3px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
              🚨 {complaintsCount} Complaints
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Autonomous AI customer sentiment analysis and lead interest classification. Every incoming WhatsApp chat is automatically scored and tagged in real-time.
      </p>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          className={`chip-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, border: '1px solid var(--border-color)', background: activeTab === 'ALL' ? 'rgba(37,211,102,0.2)' : 'transparent', color: activeTab === 'ALL' ? '#25D366' : 'var(--text-color)' }}
        >
          All Contacts ({contacts.length})
        </button>
        <button
          type="button"
          className={`chip-btn ${activeTab === 'HOT_LEAD' ? 'active' : ''}`}
          onClick={() => setActiveTab('HOT_LEAD')}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, border: '1px solid rgba(255,77,77,0.4)', background: activeTab === 'HOT_LEAD' ? 'rgba(255,77,77,0.25)' : 'transparent', color: '#ff4d4d' }}
        >
          🔥 Hot Leads ({hotLeadsCount})
        </button>
        <button
          type="button"
          className={`chip-btn ${activeTab === 'HIGH_PRIORITY' ? 'active' : ''}`}
          onClick={() => setActiveTab('HIGH_PRIORITY')}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, border: '1px solid rgba(234,179,8,0.4)', background: activeTab === 'HIGH_PRIORITY' ? 'rgba(234,179,8,0.25)' : 'transparent', color: '#eab308' }}
        >
          ⚡ High Priority ({highPriorityCount})
        </button>
        <button
          type="button"
          className={`chip-btn ${activeTab === 'SUPPORT_COMPLAINT' ? 'active' : ''}`}
          onClick={() => setActiveTab('SUPPORT_COMPLAINT')}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, border: '1px solid rgba(239,68,68,0.4)', background: activeTab === 'SUPPORT_COMPLAINT' ? 'rgba(239,68,68,0.25)' : 'transparent', color: '#ef4444' }}
        >
          🚨 Complaints ({complaintsCount})
        </button>
        <button
          type="button"
          className={`chip-btn ${activeTab === 'COLD_LEAD' ? 'active' : ''}`}
          onClick={() => setActiveTab('COLD_LEAD')}
          style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, border: '1px solid rgba(56,189,248,0.4)', background: activeTab === 'COLD_LEAD' ? 'rgba(56,189,248,0.25)' : 'transparent', color: '#38bdf8' }}
        >
          ❄️ Cold Leads ({contacts.filter((c) => c.crmTag === 'COLD_LEAD').length})
        </button>
      </div>

      {/* Leads Grid */}
      {filteredContacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
          <Filter size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No contacts matched the selected CRM tag filter.</p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {displayedContacts.map((c) => {
              const tagKey = c.crmTag || 'NEUTRAL';
              const tagCfg = TAG_CONFIG[tagKey] || TAG_CONFIG.NEUTRAL;
              const TagIcon = tagCfg.icon;

              const sentKey = c.sentimentScore || 'NEUTRAL';
              const sentCfg = SENTIMENT_CONFIG[sentKey] || SENTIMENT_CONFIG.NEUTRAL;

              return (
                <div
                  key={c._id || c.phoneNumber}
                  style={{
                    background: 'rgba(18, 24, 38, 0.6)',
                    border: `1px solid ${tagCfg.border}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <div>
                    {/* Top Badges Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: tagCfg.bg,
                          color: tagCfg.color,
                          border: `1px solid ${tagCfg.border}`,
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                        }}
                      >
                        <TagIcon size={13} />
                        {tagCfg.label}
                      </span>

                      <span style={{ fontSize: '0.75rem', color: sentCfg.color, fontWeight: 600 }}>
                        {sentCfg.emoji} {sentCfg.label}
                      </span>
                    </div>

                    {/* Contact Name & Phone */}
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                      {c.name || c.relationship || 'WhatsApp Client'}
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {c.phoneNumber}
                    </div>

                    {/* Intent Summary */}
                    {c.intentSummary && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 10px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: 6,
                          fontSize: '0.78rem',
                          color: '#cbd5e1',
                          lineHeight: '1.35',
                          borderLeft: `2px solid ${tagCfg.color}`,
                        }}
                      >
                        <strong>AI Intent:</strong> {c.intentSummary}
                      </div>
                    )}
                  </div>

                  {/* Manual Tag Selector */}
                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tag Override:</span>
                    <select
                      value={tagKey}
                      onChange={(e) => handleTagChange(c._id, e.target.value)}
                      disabled={updatingId === c._id}
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        color: tagCfg.color,
                        border: `1px solid ${tagCfg.border}`,
                        borderRadius: 6,
                        fontSize: '0.74rem',
                        padding: '3px 6px',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="HOT_LEAD" style={{ background: '#121826', color: '#ff4d4d' }}>🔥 HOT LEAD</option>
                      <option value="HIGH_PRIORITY" style={{ background: '#121826', color: '#eab308' }}>⚡ HIGH PRIORITY</option>
                      <option value="SUPPORT_COMPLAINT" style={{ background: '#121826', color: '#ef4444' }}>🚨 SUPPORT COMPLAINT</option>
                      <option value="COLD_LEAD" style={{ background: '#121826', color: '#38bdf8' }}>❄️ COLD LEAD</option>
                      <option value="NEUTRAL" style={{ background: '#121826', color: '#94a3b8' }}>⚪ NEUTRAL</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Space Optimization Expander */}
          {filteredContacts.length > LEADS_PER_PAGE && (
            <div className="space-optimizer-bar">
              <button
                type="button"
                onClick={() => setIsExpandedAll(!isExpandedAll)}
                className={`see-all-btn ${isExpandedAll ? 'expanded' : ''}`}
              >
                {isExpandedAll ? (
                  <>
                    <ChevronUp size={15} />
                    <span>Show Fewer Leads (Collapse to {LEADS_PER_PAGE})</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={15} />
                    <span>See All Leads ({filteredContacts.length} Total)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
