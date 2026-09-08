import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Moon,
  Gift,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Zap,
  Users,
  Phone,
  HelpCircle,
  Send,
  MessageCircle,
  Repeat,
} from 'lucide-react';

export default function ScheduleManager() {
  const [schedules, setSchedules] = useState([]);
  const [whitelistContacts, setWhitelistContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [executionMode, setExecutionMode] = useState('AUTO_REPLY_ON_INCOMING'); // 'AUTO_REPLY_ON_INCOMING' | 'PROACTIVE_OUTBOUND_BROADCAST'
  const [type, setType] = useState('RECURRING_DAILY');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('20:00');
  const [specificDate, setSpecificDate] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [repeatInterval, setRepeatInterval] = useState('ONCE');
  const [autoReplyText, setAutoReplyText] = useState('');
  const [targetAudienceType, setTargetAudienceType] = useState('ALL'); // 'ALL' | 'SPECIFIC_NUMBERS'
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [customPhoneInput, setCustomPhoneInput] = useState('');

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/schedules');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setSchedules(data.data || []);
        setCurrentTime(data.currentTime || '');
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/whitelist');
      if (res.ok) {
        const data = await res.json();
        setWhitelistContacts(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchContacts();
    const interval = setInterval(() => {
      fetchSchedules();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchSchedules, fetchContacts]);

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch (err) {
      console.error('Failed to toggle schedule status:', err);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSchedules();
      }
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const toggleNumberSelection = (phoneNumber) => {
    if (selectedNumbers.includes(phoneNumber)) {
      setSelectedNumbers(selectedNumbers.filter((n) => n !== phoneNumber));
    } else {
      setSelectedNumbers([...selectedNumbers, phoneNumber]);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !autoReplyText.trim()) {
      alert('Please provide a title and message.');
      return;
    }

    // Combine selected contact numbers + any custom typed numbers
    let finalTargetNumbers = [];
    if (targetAudienceType === 'SPECIFIC_NUMBERS') {
      finalTargetNumbers = [...selectedNumbers];
      if (customPhoneInput.trim()) {
        const customNums = customPhoneInput
          .split(/[,;\s]+/)
          .map((n) => n.trim())
          .filter((n) => n.length >= 7);
        finalTargetNumbers = Array.from(new Set([...finalTargetNumbers, ...customNums]));
      }

      if (finalTargetNumbers.length === 0) {
        alert('Please select or type at least one target phone number.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        executionMode,
        autoReplyText,
        targetRelationship: 'ALL',
        targetPhoneNumbers: finalTargetNumbers,
        isActive: true,
      };

      if (executionMode === 'PROACTIVE_OUTBOUND_BROADCAST') {
        payload.scheduledDateTime = scheduledDateTime || null;
        payload.repeatInterval = repeatInterval;
        payload.startTime = startTime || '10:00';
        payload.specificDate = specificDate || null;
      } else {
        payload.type = type;
        payload.startTime = type !== 'SPECIFIC_DATE' ? startTime : null;
        payload.endTime = type !== 'SPECIFIC_DATE' ? endTime : null;
        payload.specificDate = type === 'SPECIFIC_DATE' ? specificDate : null;
      }

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save schedule');
      }

      // Reset form
      setTitle('');
      setAutoReplyText('');
      setScheduledDateTime('');
      setSelectedNumbers([]);
      setCustomPhoneInput('');
      setTargetAudienceType('ALL');
      setShowAddForm(false);
      fetchSchedules();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getScheduleIcon = (scheduleTitle = '', mode = '') => {
    if (mode === 'PROACTIVE_OUTBOUND_BROADCAST') return <Send size={16} style={{ color: '#a855f7' }} />;
    const t = scheduleTitle.toLowerCase();
    if (t.includes('gym') || t.includes('workout')) return <Dumbbell size={16} className="text-emerald" />;
    if (t.includes('sleep') || t.includes('night')) return <Moon size={16} className="text-purple" />;
    if (t.includes('birth') || t.includes('party')) return <Gift size={16} className="text-amber" />;
    return <Clock size={16} className="text-blue" />;
  };

  const activeNowCount = schedules.filter((s) => s.isActive && s.isCurrentlyActive).length;

  return (
    <div className="glass-card schedule-manager-card" id="schedule-manager-section">
      <div className="card-title-row">
        <div className="title-with-badge">
          <div className="schedule-icon-halo">
            <Calendar size={20} color="#38bdf8" />
          </div>
          <div>
            <div className="schedule-header-title-row">
              <h2 className="card-title" style={{ margin: 0 }}>
                Smart Schedules & Proactive Outbound Bot
              </h2>
              {activeNowCount > 0 ? (
                <span className="status-pill healthy">
                  <span className="pulse-dot"></span>
                  {activeNowCount} Schedule Active Now
                </span>
              ) : (
                <span className="status-pill neutral">
                  Current Time: {currentTime || 'Ready'}
                </span>
              )}
            </div>
            <p className="section-subtitle">
              Configure incoming auto-replies or schedule proactive direct WhatsApp messages (Birthday wishes, Office reminders)
            </p>
          </div>
        </div>

        <button
          className="btn-primary-sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={15} />
          <span>{showAddForm ? 'Cancel' : 'Add New Schedule'}</span>
        </button>
      </div>

      {/* Instructional Banner */}
      <div className="schedule-info-banner">
        <HelpCircle size={17} className="text-blue flex-shrink-0" />
        <div className="info-banner-text">
          <strong>2 Powerful Modes Available:</strong>
          <span>
            <strong>1. Proactive Direct Message:</strong> Date & Time match hote hi bot <em>khud se message send kar dega</em> bina user ke message ka wait kiye.
            <br />
            <strong>2. Incoming Auto-Reply:</strong> Jab koi specific hours (Gym, Sleep) me aapko message bhejega tab instant auto-reply deliver hoga.
          </span>
        </div>
      </div>

      {/* Add New Schedule Form Drawer */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="schedule-form-drawer">
          <h4 className="drawer-title">Create Smart Schedule / Proactive Message</h4>

          {/* Mode Selector */}
          <div style={{ marginBottom: 16 }}>
            <label className="field-label" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Select Schedule Execution Mode:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              <div
                onClick={() => setExecutionMode('PROACTIVE_OUTBOUND_BROADCAST')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: `1.5px solid ${executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
                  background: executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Send size={16} color="#a855f7" />
                  <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Proactive Direct Message</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Bot date & time match hote hi <strong>khud number par message send karega</strong> (Birthday, Office Task reminder).
                </p>
              </div>

              <div
                onClick={() => setExecutionMode('AUTO_REPLY_ON_INCOMING')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: `1.5px solid ${executionMode === 'AUTO_REPLY_ON_INCOMING' ? '#25D366' : 'rgba(255,255,255,0.1)'}`,
                  background: executionMode === 'AUTO_REPLY_ON_INCOMING' ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <MessageCircle size={16} color="#25D366" />
                  <strong style={{ fontSize: '0.9rem', color: '#fff' }}>Incoming Auto-Reply</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Jab koi is time me <strong>aapko message bhejega</strong> tab yeh custom reply jayega (Gym, Sleep mode).
                </p>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="field-label">Schedule / Event Title</label>
              <input
                type="text"
                className="text-input"
                placeholder={executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' ? 'e.g. Rahul Birthday Wish, Client Follow-up Reminder' : 'e.g. Gym Workout, Night Sleep Mode'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' ? (
              <div className="form-group">
                <label className="field-label">Repeat Interval</label>
                <select
                  className="select-input"
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(e.target.value)}
                >
                  <option value="ONCE">Once (Send at exact Date & Time only)</option>
                  <option value="DAILY">Daily (Send every day at this time)</option>
                  <option value="YEARLY">Yearly (Send on this date every year - Birthday)</option>
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="field-label">Schedule Type</label>
                <select
                  className="select-input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="RECURRING_DAILY">Daily Time Window (e.g. Gym, Sleep)</option>
                  <option value="SPECIFIC_DATE">Specific Date (MM-DD or YYYY-MM-DD)</option>
                </select>
              </div>
            )}
          </div>

          {/* Date / Time Inputs depending on mode */}
          {executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' ? (
            <div className="form-grid-2">
              <div className="form-group">
                <label className="field-label">Exact Date & Time (YYYY-MM-DDTHH:mm)</label>
                <input
                  type="datetime-local"
                  className="text-input"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  required={repeatInterval === 'ONCE'}
                />
              </div>
              <div className="form-group">
                <label className="field-label">Or Specific Daily Time (HH:mm)</label>
                <input
                  type="time"
                  className="text-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
          ) : type === 'SPECIFIC_DATE' ? (
            <div className="form-group">
              <label className="field-label">Date (MM-DD for yearly birthday, or YYYY-MM-DD)</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. 09-08 or 2026-09-08"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="form-grid-2">
              <div className="form-group">
                <label className="field-label">Start Time (24h format)</label>
                <input
                  type="time"
                  className="text-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="field-label">End Time (24h format)</label>
                <input
                  type="time"
                  className="text-input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Target Numbers & Audience Selection */}
          <div className="form-group schedule-audience-box">
            <label className="field-label">
              <Users size={14} className="text-blue" />
              Target Recipient Numbers (Kisko Message Bhejna Hai?)
            </label>

            <div className="radio-group-row">
              <label className="radio-label">
                <input
                  type="radio"
                  name="audience"
                  value="ALL"
                  checked={targetAudienceType === 'ALL'}
                  onChange={() => setTargetAudienceType('ALL')}
                />
                <span>Sabhi Whitelisted Contacts ({whitelistContacts.length})</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="audience"
                  value="SPECIFIC_NUMBERS"
                  checked={targetAudienceType === 'SPECIFIC_NUMBERS'}
                  onChange={() => setTargetAudienceType('SPECIFIC_NUMBERS')}
                />
                <span>Specific Selected Contacts Only</span>
              </label>
            </div>

            {targetAudienceType === 'SPECIFIC_NUMBERS' && (
              <div className="specific-numbers-picker">
                <p className="picker-hint">Aapke Whitelist Contacts me se select karein:</p>
                <div className="contacts-chips-grid">
                  {whitelistContacts.map((contact) => {
                    const isSelected = selectedNumbers.includes(contact.phoneNumber);
                    return (
                      <button
                        type="button"
                        key={contact._id}
                        className={`contact-select-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleNumberSelection(contact.phoneNumber)}
                      >
                        <Phone size={12} />
                        <strong>{contact.name || contact.relationship}</strong>
                        <span className="chip-phone">{contact.phoneNumber}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label className="field-label" style={{ fontSize: '0.78rem' }}>
                    Ya koi aur WhatsApp Number daalein (Comma separated):
                  </label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="+919876543210, +919123456789"
                    value={customPhoneInput}
                    onChange={(e) => setCustomPhoneInput(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="field-label">
              {executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' ? 'Direct WhatsApp Message to Send' : 'Predefined WhatsApp Auto-Reply Message'}
            </label>
            <textarea
              className="textarea-input"
              rows={3}
              placeholder={executionMode === 'PROACTIVE_OUTBOUND_BROADCAST' ? 'e.g. Happy Birthday bhai! 🎂 Wish you lots of happiness and success ❤️' : 'e.g. Bhai abhi main Gym me workout kar raha hoon. Free hoke reply karta hoon!'}
              value={autoReplyText}
              onChange={(e) => setAutoReplyText(e.target.value)}
              required
            />
          </div>

          <div className="drawer-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save & Schedule'}
            </button>
          </div>
        </form>
      )}

      {/* Schedules List */}
      <div className="schedules-list">
        {loading ? (
          <div className="empty-state">Loading smart schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="empty-state">No schedules added yet. Add one above!</div>
        ) : (
          schedules.map((schedule) => {
            const isProactive = schedule.executionMode === 'PROACTIVE_OUTBOUND_BROADCAST';
            const isLive = schedule.isActive && schedule.isCurrentlyActive;
            const targetCount = Array.isArray(schedule.targetPhoneNumbers) ? schedule.targetPhoneNumbers.length : 0;

            return (
              <div
                key={schedule._id}
                className={`schedule-item-card ${isLive ? 'active-schedule-glow' : ''}`}
                style={{
                  borderLeft: `4px solid ${isProactive ? '#a855f7' : '#25D366'}`,
                }}
              >
                <div className="schedule-item-top">
                  <div className="schedule-item-title-row">
                    <div className="schedule-mini-icon">
                      {getScheduleIcon(schedule.title, schedule.executionMode)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4 className="schedule-item-title" style={{ margin: 0 }}>{schedule.title}</h4>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 10,
                            background: isProactive ? 'rgba(168,85,247,0.18)' : 'rgba(37,211,102,0.18)',
                            color: isProactive ? '#c084fc' : '#4ade80',
                            border: `1px solid ${isProactive ? 'rgba(168,85,247,0.4)' : 'rgba(37,211,102,0.4)'}`,
                          }}
                        >
                          {isProactive ? '📤 PROACTIVE AUTO-SEND' : '📥 INCOMING AUTO-REPLY'}
                        </span>
                      </div>

                      <div className="schedule-timing-badge" style={{ marginTop: 4 }}>
                        <Clock size={12} />
                        <span>
                          {isProactive
                            ? schedule.scheduledDateTime
                              ? `At: ${schedule.scheduledDateTime.replace('T', ' ')}`
                              : `Daily at: ${schedule.startTime}`
                            : schedule.type === 'SPECIFIC_DATE'
                            ? `Date: ${schedule.specificDate}`
                            : `${schedule.startTime} - ${schedule.endTime}`}
                        </span>
                        <span className="schedule-target-tag">
                          <Users size={11} />
                          {targetCount > 0 ? `${targetCount} Target Numbers` : 'All Whitelist Contacts'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="schedule-actions-row">
                    {isProactive ? (
                      schedule.isExecuted ? (
                        <span className="status-pill healthy">
                          <CheckCircle2 size={12} />
                          Sent Successfully
                        </span>
                      ) : (
                        <span className="status-pill scheduled">
                          <Clock size={12} />
                          Scheduled
                        </span>
                      )
                    ) : isLive ? (
                      <span className="status-pill healthy" title="Matching current time right now">
                        <span className="pulse-dot"></span>
                        Active Right Now
                      </span>
                    ) : schedule.isActive ? (
                      <span className="status-pill scheduled">
                        Scheduled
                      </span>
                    ) : (
                      <span className="status-pill disabled">
                        Paused
                      </span>
                    )}

                    <button
                      className="icon-toggle-btn"
                      onClick={() => handleToggleActive(schedule._id, schedule.isActive)}
                      title={schedule.isActive ? 'Pause Schedule' : 'Activate Schedule'}
                    >
                      {schedule.isActive ? (
                        <ToggleRight size={22} className="text-emerald" />
                      ) : (
                        <ToggleLeft size={22} className="text-muted" />
                      )}
                    </button>

                    <button
                      className="icon-delete-btn"
                      onClick={() => handleDelete(schedule._id, schedule.title)}
                      title="Delete Schedule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {targetCount > 0 && (
                  <div className="schedule-numbers-preview">
                    <span className="numbers-preview-label">Applies only to:</span>
                    {schedule.targetPhoneNumbers.map((num) => (
                      <span key={num} className="number-mini-pill">
                        {num}
                      </span>
                    ))}
                  </div>
                )}

                {/* Auto Reply Preview */}
                <div className="schedule-reply-preview">
                  <span className="reply-preview-label">
                    <Zap size={12} className="text-amber" />
                    Auto-Reply Message:
                  </span>
                  <p className="reply-preview-text">"{schedule.autoReplyText}"</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
