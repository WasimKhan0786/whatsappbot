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

export default function App() {
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [envStatus, setEnvStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedStatTab, setSelectedStatTab] = useState('ALL');

  // Handle stat card click to open details modal
  const handleStatCardClick = (filterKey) => {
    setSelectedStatTab(filterKey);
    setIsEventModalOpen(true);
  };

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
    await Promise.all([fetchSettings(), fetchLogs()]);
    setRefreshing(false);
  };

  // Initial load and periodic refresh
  useEffect(() => {
    handleRefresh();
    // Periodically update logs every 6 seconds
    const interval = setInterval(() => {
      fetchLogs();
      fetchSettings();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchSettings, fetchLogs]);

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

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        isEnabled={settings?.isEnabled ?? true}
        serverOnline={serverOnline}
        onRefresh={handleRefresh}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        refreshing={refreshing}
      />

      {/* Metric Cards Bar */}
      <StatsBar stats={stats} onCardClick={handleStatCardClick} />

      {/* Google Gemini AI Quota & Daily Limit Monitor */}
      <GeminiQuotaCard />

      {/* WhatsApp Web Direct QR Connect (No Meta Account Required) */}
      <WhatsAppWebCard />

      {/* VIP Whitelist Contacts & Relationship Roles Manager */}
      <WhitelistManager onContactsUpdated={fetchSettings} />

      {/* Smart Schedules & Event Auto-Replies (Gym, Sleep, Birthday) */}
      <ScheduleManager />

      {/* Main Grid: Controls on left, Live Log Feed on right */}
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

      {/* WhatsApp Cloud API Setup Guide */}
      <SetupGuide envStatus={envStatus} />

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
    </div>
  );
}
