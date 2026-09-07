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
  const [type, setType] = useState('RECURRING_DAILY');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('20:00');
  const [specificDate, setSpecificDate] = useState('');
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
      alert('Please provide a title and auto-reply message.');
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
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type,
          startTime: type !== 'SPECIFIC_DATE' ? startTime : null,
          endTime: type !== 'SPECIFIC_DATE' ? endTime : null,
          specificDate: type === 'SPECIFIC_DATE' ? specificDate : null,
          autoReplyText,
          targetRelationship: 'ALL',
          targetPhoneNumbers: finalTargetNumbers,
          isActive: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save schedule');
      }

      // Reset form
      setTitle('');
      setAutoReplyText('');
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

  const getScheduleIcon = (scheduleTitle = '') => {
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
                Smart Schedules & Event Auto-Replies
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
              Prioritize predefined replies (Gym, Sleep, Birthday) before calling Gemini AI
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

      {/* Instructional Banner explaining how WhatsApp replies work */}
      <div className="schedule-info-banner">
        <HelpCircle size={17} className="text-blue flex-shrink-0" />
        <div className="info-banner-text">
          <strong>Kaise WhatsApp Pe Message Jayega?</strong>
          <span>
            Jab koi contact is time ke dauran aapko WhatsApp par message bhejega, bot automatically unko{' '}
            <strong>"typing..."</strong> dikha kar yeh custom auto-reply bhej dega (Gemini AI ko bypass karke). Baaki time par Gemini AI unse live polite chat karega.
          </span>
        </div>
      </div>

      {/* Add New Schedule Form Drawer */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="schedule-form-drawer">
          <h4 className="drawer-title">Create Smart Schedule</h4>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="field-label">Schedule Title</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. Gym Workout, Birthday Wishes, Night Sleep"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Schedule Type</label>
              <select
                className="select-input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="RECURRING_DAILY">Daily Time Window (e.g. Gym, Sleep)</option>
                <option value="SPECIFIC_DATE">Specific Date / Birthday (MM-DD or YYYY-MM-DD)</option>
              </select>
            </div>
          </div>

          {type === 'SPECIFIC_DATE' ? (
            <div className="form-group">
              <label className="field-label">Date (MM-DD for yearly birthday, or YYYY-MM-DD)</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. 09-07 or 2026-09-07"
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
              Target Numbers (Kin Numbers Par Yeh Reply Lagana Hai?)
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
                <span>Sabhi Whitelisted Contacts (All Allowed Numbers)</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="audience"
                  value="SPECIFIC_NUMBERS"
                  checked={targetAudienceType === 'SPECIFIC_NUMBERS'}
                  onChange={() => setTargetAudienceType('SPECIFIC_NUMBERS')}
                />
                <span>Specific Numbers Only (Select Selected Contacts)</span>
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
                    Ya koi aur Number daalein (Comma separated):
                  </label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="+918797871221, +918318741186"
                    value={customPhoneInput}
                    onChange={(e) => setCustomPhoneInput(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="field-label">Predefined WhatsApp Auto-Reply Message</label>
            <textarea
              className="textarea-input"
              rows={3}
              placeholder="e.g. Bhai abhi main Gym me workout kar raha hoon (6:00 PM - 8:00 PM). Free hoke aapse baat karta hoon!"
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
              {submitting ? 'Saving...' : 'Save Schedule'}
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
            const isLive = schedule.isActive && schedule.isCurrentlyActive;
            const targetCount = Array.isArray(schedule.targetPhoneNumbers) ? schedule.targetPhoneNumbers.length : 0;

            return (
              <div
                key={schedule._id}
                className={`schedule-item-card ${isLive ? 'active-schedule-glow' : ''}`}
              >
                <div className="schedule-item-top">
                  <div className="schedule-item-title-row">
                    <div className="schedule-mini-icon">
                      {getScheduleIcon(schedule.title)}
                    </div>
                    <div>
                      <h4 className="schedule-item-title">{schedule.title}</h4>
                      <div className="schedule-timing-badge">
                        <Clock size={12} />
                        <span>
                          {schedule.type === 'SPECIFIC_DATE'
                            ? `Date: ${schedule.specificDate}`
                            : `${schedule.startTime} - ${schedule.endTime}`}
                        </span>
                        <span className="schedule-target-tag">
                          <Users size={11} />
                          {targetCount > 0 ? `${targetCount} Specific Numbers` : 'All Whitelist Contacts'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="schedule-actions-row">
                    {isLive ? (
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
                        <ToggleRight size={26} className="text-emerald" />
                      ) : (
                        <ToggleLeft size={26} className="text-muted" />
                      )}
                    </button>

                    <button
                      className="delete-contact-btn"
                      onClick={() => handleDelete(schedule._id, schedule.title)}
                      title="Delete Schedule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Specific numbers chip preview if configured */}
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
