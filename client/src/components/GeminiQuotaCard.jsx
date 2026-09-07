import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Zap, Clock, ShieldCheck, RefreshCw, Activity, Cpu, AlertTriangle, KeyRound } from 'lucide-react';

export default function GeminiQuotaCard({ onOpenEnvModal }) {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/quota');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.data) {
        setQuota(data.data);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading Gemini quota:', err);
      setError('Unable to fetch quota status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
    // Auto-poll quota every 15 seconds
    const timer = setInterval(fetchQuota, 15000);
    return () => clearInterval(timer);
  }, [fetchQuota]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchQuota();
  };

  if (loading && !quota) {
    return (
      <div className="quota-card glass-panel loading-skeleton">
        <div className="quota-header">
          <div className="quota-title-wrap">
            <Sparkles className="icon-pulse text-gemini" size={22} />
            <span className="quota-title">Loading Gemini AI Quota...</span>
          </div>
        </div>
      </div>
    );
  }

  const remaining = quota?.remainingToday ?? 1500;
  const limit = quota?.dailyLimit ?? 1500;
  const used = quota?.usedToday ?? 0;
  const percentRemaining = quota?.percentRemaining ?? 100;
  const percentUsed = quota?.percentUsed ?? 0;
  const resetIn = quota?.resetIn ?? '--';
  const latency = quota?.latencyMs ? `${quota.latencyMs}ms` : 'Instant';
  const activeModel = quota?.activeModel || 'gemini-flash-lite-latest';
  const healthTier = quota?.healthTier || 'healthy';

  const getProgressColor = () => {
    if (percentRemaining > 40) return 'linear-gradient(90deg, #10b981, #06b6d4, #3b82f6)';
    if (percentRemaining > 15) return 'linear-gradient(90deg, #f59e0b, #eab308)';
    return 'linear-gradient(90deg, #ef4444, #dc2626)';
  };

  return (
    <div className="quota-card glass-panel" id="gemini-quota-dashboard">
      {/* Card Header */}
      <div className="quota-header">
        <div className="quota-title-wrap">
          <div className="gemini-icon-halo">
            <Sparkles size={20} className="text-gemini" />
          </div>
          <div>
            <div className="quota-title-row">
              <h3 className="quota-heading">Google Gemini AI Quota & Daily Limit</h3>
              <span className={`status-pill ${healthTier}`}>
                <span className="pulse-dot"></span>
                {healthTier === 'healthy' ? 'High Quota Available' : healthTier === 'warning' ? 'Moderate Quota' : 'Low Quota'}
              </span>
            </div>
            <p className="quota-subtitle">
              Live remaining requests & automatic multi-model failover protection
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onOpenEnvModal && (
            <button
              className="btn-secondary"
              onClick={onOpenEnvModal}
              style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Update Gemini API Key or Upload .env"
            >
              <KeyRound size={13} color="#25D366" />
              <span>Update Key</span>
            </button>
          )}
          <button
            className={`refresh-icon-btn ${refreshing ? 'spinning' : ''}`}
            onClick={handleManualRefresh}
            title="Refresh Quota Status"
            disabled={refreshing}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="quota-metrics-grid">
        {/* Remaining Requests Metric */}
        <div className="quota-metric-box highlight">
          <div className="metric-top">
            <span className="metric-label">Quota Remaining Today</span>
            <div className="metric-icon-bubble green">
              <Zap size={16} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-big-number">{remaining.toLocaleString()}</span>
            <span className="metric-total-sub">/ {limit.toLocaleString()} msgs</span>
          </div>
          <div className="metric-caption">
            <strong>{percentRemaining}%</strong> capacity available for replies
          </div>
        </div>

        {/* Daily Used Metric */}
        <div className="quota-metric-box">
          <div className="metric-top">
            <span className="metric-label">Used Today</span>
            <div className="metric-icon-bubble blue">
              <Activity size={16} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-big-number">{used.toLocaleString()}</span>
            <span className="metric-total-sub">replies sent</span>
          </div>
          <div className="metric-caption">
            {quota?.stats?.ignoredToday ?? 0} unlisted msgs ignored (saved quota)
          </div>
        </div>

        {/* Reset Countdown */}
        <div className="quota-metric-box">
          <div className="metric-top">
            <span className="metric-label">Daily Reset In</span>
            <div className="metric-icon-bubble purple">
              <Clock size={16} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-big-number text-purple">{resetIn}</span>
          </div>
          <div className="metric-caption">
            Resets to 1,500 daily at 00:00 UTC
          </div>
        </div>

        {/* Active Model & Engine */}
        <div className="quota-metric-box">
          <div className="metric-top">
            <span className="metric-label">Active AI Model</span>
            <div className="metric-icon-bubble emerald">
              <Cpu size={16} />
            </div>
          </div>
          <div className="metric-value-row">
            <span className="metric-model-name" title={activeModel}>{activeModel}</span>
          </div>
          <div className="metric-caption">
            Speed: <strong>{latency}</strong> • Rate limit: <strong>15 RPM</strong>
          </div>
        </div>
      </div>

      {/* Visual Capacity Bar */}
      <div className="quota-progress-section">
        <div className="progress-labels">
          <span className="progress-left">
            Daily Quota Consumption ({percentUsed}% used)
          </span>
          <span className="progress-right">
            <strong>{remaining}</strong> requests left before limit
          </span>
        </div>
        <div className="quota-progress-track">
          <div
            className="quota-progress-fill"
            style={{
              width: `${Math.min(100, Math.max(2, percentRemaining))}%`,
              background: getProgressColor(),
            }}
          ></div>
        </div>
      </div>

      {/* Multi-Model Failover Shield Footer */}
      <div className="failover-footer">
        <div className="failover-badge">
          <ShieldCheck size={16} className="text-emerald" />
          <span>Multi-Model Auto Failover Active:</span>
        </div>
        <div className="failover-tags">
          {(quota?.failoverModels || [
            'gemini-flash-lite-latest',
            'gemini-flash-latest',
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.7-flash',
            'gemini-3.8-flash',
          ]).map((m, idx) => (
            <span
              key={m}
              className={`failover-chip ${m === activeModel ? 'active-chip' : ''}`}
              title={m === activeModel ? 'Currently Active Model' : 'Auto-fallback backup'}
            >
              {idx === 0 ? '★ ' : ''}{m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
