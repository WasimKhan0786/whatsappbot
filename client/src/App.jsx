import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import BotControls from './components/BotControls';
import MessageLogs from './components/MessageLogs';
import SimulatorModal from './components/SimulatorModal';
import SetupGuide from './components/SetupGuide';
import WhatsAppWebCard from './components/WhatsAppWebCard';
import WhitelistManager from './components/WhitelistManager';
import GeminiQuotaCard from './components/GeminiQuotaCard';
import EventDetailsModal from './components/EventDetailsModal';
import ScheduleManager from './components/ScheduleManager';
import EnvConfigModal from './components/EnvConfigModal';
import LiveAgentHandoffCard from './components/LiveAgentHandoffCard';
import CrmLeadBoard from './components/CrmLeadBoard';
import LocationManager from './components/LocationManager';
import CollapsibleSection from './components/CollapsibleSection';
import {
  Sparkles,
  ShieldAlert,
  QrCode,
  Users,
  Tag,
  Calendar,
  Sliders,
  MessageSquare,
  HelpCircle,
  Eye,
  EyeOff,
  Layers,
  MapPin,
} from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [envStatus, setEnvStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [selectedStatTab, setSelectedStatTab] = useState('ALL');
  const [activeStudioTab, setActiveStudioTab] = useState('HUB');

  // Master Collapse/Expand All toggle key
  const [allOpenVersion, setAllOpenVersion] = useState(0);

  // Handle stat card click to open details modal
  const handleStatCardClick = (filterKey) => {
    setSelectedStatTab(filterKey);
    setIsEventModalOpen(true);
  };

  // Fetch whitelist contacts
  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/whitelist');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setContacts(data.data || []);
    } catch (err) {
      console.error('Failed to load whitelist contacts for CRM:', err);
    }
  }, []);

  // Fetch settings & statistics
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings(data.settings);
      setStats(data.stats);
      setEnvStatus(data.envStatus);
      setServerOnline(true);
      return data;
    } catch (err) {
      console.error('Failed to load settings:', err);
      setServerOnline(false);
      return null;
    }
  }, []);

  // Fetch message logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // Combined refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSettings(), fetchLogs(), fetchContacts()]);
    setRefreshing(false);
  };

  // Initial load and periodic refresh
  useEffect(() => {
    handleRefresh();
    const interval = setInterval(() => {
      fetchLogs();
      fetchSettings();
      fetchContacts();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchSettings, fetchLogs, fetchContacts]);

  // Update settings handler
  const handleUpdateSettings = async (newSettings) => {
    setUpdating(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings(data.settings);
      return true;
    } catch (err) {
      console.error('Failed to update settings:', err);
      alert('Error updating settings: ' + err.message);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  // Clear all logs handler
  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all message logs from MongoDB?')) {
      return;
    }
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
      fetchSettings();
    } catch (err) {
      console.error('Failed to clear logs:', err);
      alert('Failed to clear logs: ' + err.message);
    }
  };

  // Global Expand / Collapse All handler
  const setAllSections = (open) => {
    const keys = ['quota', 'handoff', 'qr', 'whitelist', 'crm', 'schedules', 'controls', 'guide'];
    keys.forEach((k) => localStorage.setItem(`panel_${k}`, String(open)));
    setAllOpenVersion((v) => v + 1);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        isEnabled={settings?.isEnabled ?? true}
        serverOnline={serverOnline}
        onRefresh={handleRefresh}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenEnvModal={() => setIsEnvModalOpen(true)}
        refreshing={refreshing}
      />

      {/* Metric Cards Bar */}
      <StatsBar stats={stats} onCardClick={handleStatCardClick} />

      {/* Studio Navigation Bar */}
      <div className="studio-nav-wrapper">
        <div className="studio-nav-bar">
          <button
            type="button"
            className={`studio-nav-tab ${activeStudioTab === 'HUB' ? 'active' : ''}`}
            onClick={() => setActiveStudioTab('HUB')}
          >
            <Sliders size={15} />
            <span>Studio Hub & Feed</span>
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${activeStudioTab === 'WHITELIST' ? 'active' : ''}`}
            onClick={() => setActiveStudioTab('WHITELIST')}
          >
            <Users size={15} />
            <span>VIP Whitelist</span>
            {contacts.length > 0 && <span className="nav-badge">{contacts.length}</span>}
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${activeStudioTab === 'CRM' ? 'active' : ''}`}
            onClick={() => setActiveStudioTab('CRM')}
          >
            <Tag size={15} />
            <span>CRM Leads</span>
            {contacts.filter((c) => c.crmTag === 'HOT_LEAD').length > 0 && (
              <span className="nav-badge" style={{ background: '#ff4d4d', color: '#fff' }}>
                🔥 {contacts.filter((c) => c.crmTag === 'HOT_LEAD').length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${activeStudioTab === 'LOCATION' ? 'active' : ''}`}
            onClick={() => setActiveStudioTab('LOCATION')}
          >
            <MapPin size={15} />
            <span>GPS Studio</span>
            <span className="nav-badge" style={{ background: 'rgba(37,211,102,0.2)', color: '#25D366' }}>Live</span>
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${activeStudioTab === 'SCHEDULES' ? 'active' : ''}`}
            onClick={() => setActiveStudioTab('SCHEDULES')}
          >
            <Calendar size={15} />
            <span>Smart Schedules</span>
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${activeStudioTab === 'QR' ? 'active' : ''}`}
            onClick={() => setActiveStudioTab('QR')}
          >
            <QrCode size={15} />
            <span>WhatsApp Connect</span>
          </button>

          <button
            type="button"
            className={`studio-nav-tab ${activeStudioTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveStudioTab('ALL')}
          >
            <Layers size={15} />
            <span>All Modules</span>
          </button>
        </div>
      </div>

      {/* Expand/Collapse Bar when viewing All Modules */}
      {activeStudioTab === 'ALL' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            padding: '8px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={15} color="#25D366" />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>
              All Studio Sections
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="chip-btn"
              onClick={() => setAllSections(true)}
              style={{ fontSize: '0.74rem', padding: '4px 10px' }}
            >
              <Eye size={12} style={{ marginRight: 4 }} />
              Expand All
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => setAllSections(false)}
              style={{ fontSize: '0.74rem', padding: '4px 10px' }}
            >
              <EyeOff size={12} style={{ marginRight: 4 }} />
              Collapse All
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Module Content View */}
      <div key={allOpenVersion}>
        {/* Module 1: Studio Hub & Feed */}
        {(activeStudioTab === 'HUB' || activeStudioTab === 'ALL') && (
          <>
            <CollapsibleSection
              title="Bot Control & Live Message Audit Log"
              icon={Sliders}
              storageKey="controls"
              defaultOpen={true}
              subtitle="Master toggle, anti-ban protection shield, persona customization, and real-time message feed"
            >
              <main className="dashboard-grid">
                <BotControls
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  updating={updating}
                />

                <MessageLogs
                  logs={logs}
                  onClearLogs={handleClearLogs}
                  loadingLogs={loadingLogs}
                />
              </main>
            </CollapsibleSection>

            <CollapsibleSection
              title="Google Gemini AI Quota & Failover Limits"
              icon={Sparkles}
              storageKey="quota"
              defaultOpen={true}
              subtitle="Real-time daily API limit tracker & automatic fallback model routing"
            >
              <GeminiQuotaCard onOpenEnvModal={() => setIsEnvModalOpen(true)} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Live Agent Handoff & Auto-Pause Guard"
              icon={ShieldAlert}
              storageKey="handoff"
              defaultOpen={true}
              subtitle="Keyword triggers & 3-attempt consecutive failure auto-handover management"
            >
              <LiveAgentHandoffCard onHandoffChanged={handleRefresh} />
            </CollapsibleSection>
          </>
        )}

        {/* Module 2: VIP Whitelist Contacts & Personas */}
        {(activeStudioTab === 'WHITELIST' || activeStudioTab === 'ALL') && (
          <CollapsibleSection
            title="VIP Whitelist Contacts & Access Control"
            icon={Users}
            storageKey="whitelist"
            defaultOpen={true}
            badge={
              contacts.length > 0 ? (
                <span style={{ fontSize: '0.73rem', background: 'rgba(37,211,102,0.15)', color: '#25D366', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                  {contacts.length} Contacts
                </span>
              ) : null
            }
            subtitle="Restrict automated AI replies exclusively to whitelisted numbers"
          >
            <WhitelistManager onContactsUpdated={handleRefresh} />
          </CollapsibleSection>
        )}

        {/* Module 3: CRM Leads & Sentiment */}
        {(activeStudioTab === 'CRM' || activeStudioTab === 'ALL') && (
          <CollapsibleSection
            title="CRM Lead Auto-Tagging & Sentiment Dashboard"
            icon={Tag}
            storageKey="crm"
            defaultOpen={true}
            subtitle="Autonomous Gemini AI customer sentiment analysis and high-converting lead scoring"
          >
            <CrmLeadBoard contacts={contacts} onRefresh={fetchContacts} />
          </CollapsibleSection>
        )}

        {/* Module 4: GPS & Live Location */}
        {(activeStudioTab === 'LOCATION' || activeStudioTab === 'ALL') && (
          <CollapsibleSection
            title="Real-Time GPS Location Tracking & Auto-Sharing"
            icon={MapPin}
            storageKey="location"
            defaultOpen={true}
            subtitle="Live phone GPS tracking, native WhatsApp map pins, and smart 'kaha ho' intent auto-replies"
          >
            <LocationManager />
          </CollapsibleSection>
        )}

        {/* Module 5: Smart Schedules & Outbound */}
        {(activeStudioTab === 'SCHEDULES' || activeStudioTab === 'ALL') && (
          <CollapsibleSection
            title="Smart Schedules & Proactive Outbound Bot"
            icon={Calendar}
            storageKey="schedules"
            defaultOpen={true}
            subtitle="Predefined priority auto-replies and autonomous Date & Time direct WhatsApp messages"
          >
            <ScheduleManager />
          </CollapsibleSection>
        )}

        {/* Module 6: WhatsApp Connect & Setup */}
        {(activeStudioTab === 'QR' || activeStudioTab === 'ALL') && (
          <>
            <CollapsibleSection
              title="WhatsApp Web Direct QR Connect"
              icon={QrCode}
              storageKey="qr"
              defaultOpen={true}
              subtitle="Baileys WebSocket direct link with auto-reconnect and persistent session"
            >
              <WhatsAppWebCard />
            </CollapsibleSection>

            <CollapsibleSection
              title="WhatsApp Cloud API Setup Guide & Credentials"
              icon={HelpCircle}
              storageKey="guide"
              defaultOpen={false}
              subtitle="Optional Meta Cloud API webhook verification credentials and endpoints"
            >
              <SetupGuide envStatus={envStatus} />
            </CollapsibleSection>
          </>
        )}
      </div>

      {/* Webhook & Gemini Simulator Modal */}
      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        allowedPhoneNumber={settings?.allowedPhoneNumber}
        onSimulationSuccess={() => {
          fetchLogs();
          fetchSettings();
        }}
      />

      {/* Event Details & Audit Log Modal (Opened when clicking stat cards) */}
      <EventDetailsModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        initialTab={selectedStatTab}
        logs={logs}
        onClearLogs={handleClearLogs}
        stats={stats}
      />

      {/* Dynamic .env Upload & Gemini API Key Management Modal */}
      <EnvConfigModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        onSuccess={() => {
          fetchSettings();
        }}
      />
    </div>
  );
}
