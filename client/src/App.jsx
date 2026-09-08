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

      {/* Dashboard View Toolbar with Quick Collapse/Expand Controls */}
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
            Dashboard Sections
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

      <div key={allOpenVersion}>
        {/* 1. Google Gemini AI Quota & Daily Limit Monitor */}
        <CollapsibleSection
          title="Google Gemini AI Quota & Failover Limits"
          icon={Sparkles}
          storageKey="quota"
          defaultOpen={true}
          subtitle="Real-time daily API limit tracker & automatic fallback model routing"
        >
          <GeminiQuotaCard onOpenEnvModal={() => setIsEnvModalOpen(true)} />
        </CollapsibleSection>

        {/* 2. Live Agent Handoff & Auto-Pause Guard */}
        <CollapsibleSection
          title="Live Agent Handoff & Auto-Pause Guard"
          icon={ShieldAlert}
          storageKey="handoff"
          defaultOpen={true}
          subtitle="Keyword triggers & 3-attempt consecutive failure auto-handover management"
        >
          <LiveAgentHandoffCard onHandoffChanged={handleRefresh} />
        </CollapsibleSection>

        {/* 3. WhatsApp Web Direct QR Connect */}
        <CollapsibleSection
          title="WhatsApp Web Direct QR Connect"
          icon={QrCode}
          storageKey="qr"
          defaultOpen={true}
          subtitle="Baileys WebSocket direct link with auto-reconnect and persistent session"
        >
          <WhatsAppWebCard />
        </CollapsibleSection>

        {/* 4. VIP Whitelist Contacts & Relationship Roles Manager */}
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

        {/* 5. CRM Lead Auto-Tagging & Sentiment Dashboard */}
        <CollapsibleSection
          title="CRM Lead Auto-Tagging & Sentiment Dashboard"
          icon={Tag}
          storageKey="crm"
          defaultOpen={true}
          subtitle="Autonomous Gemini AI customer sentiment analysis and high-converting lead scoring"
        >
          <CrmLeadBoard contacts={contacts} onRefresh={fetchContacts} />
        </CollapsibleSection>

        {/* 6. Smart Schedules & Proactive Outbound Bot */}
        <CollapsibleSection
          title="Smart Schedules & Proactive Outbound Bot"
          icon={Calendar}
          storageKey="schedules"
          defaultOpen={true}
          subtitle="Predefined priority auto-replies and autonomous Date & Time direct WhatsApp messages"
        >
          <ScheduleManager />
        </CollapsibleSection>

        {/* 7. Main Grid: Controls & Message Feed */}
        <CollapsibleSection
          title="Bot Control & Live Message Audit Log"
          icon={Sliders}
          storageKey="controls"
          defaultOpen={true}
          subtitle="Master toggle, anti-ban protection shield, persona customization, and real-time feed"
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

        {/* 8. WhatsApp Cloud API Setup Guide */}
        <CollapsibleSection
          title="WhatsApp Cloud API Setup Guide & Credentials"
          icon={HelpCircle}
          storageKey="guide"
          defaultOpen={false}
          subtitle="Optional Meta Cloud API webhook verification credentials and endpoints"
        >
          <SetupGuide envStatus={envStatus} />
        </CollapsibleSection>
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
