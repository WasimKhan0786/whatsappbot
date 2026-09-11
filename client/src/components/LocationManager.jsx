import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Shield,
  Smartphone,
  Sliders,
  Send,
  Radio,
  Clock,
} from 'lucide-react';

export default function LocationManager() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingGps, setSyncingGps] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isWatchingGps, setIsWatchingGps] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Form states for manual edit
  const [manualAddress, setManualAddress] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [shareWithAll, setShareWithAll] = useState(true);
  const [isLiveTrackingActive, setIsLiveTrackingActive] = useState(true);
  const [generalDesc, setGeneralDesc] = useState('');

  const watchIdRef = useRef(null);

  // Fetch current location from server
  const fetchLocation = async () => {
    try {
      const res = await fetch('/api/location/current');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data) {
        setLocation(result.data);
        setManualAddress(result.data.address || '');
        setManualLat(result.data.latitude || '');
        setManualLng(result.data.longitude || '');
        setShareWithAll(result.data.shareWithAll ?? true);
        setIsLiveTrackingActive(result.data.isLiveTrackingActive ?? true);
        setGeneralDesc(result.data.generalLocationDescription || '');
      }
    } catch (err) {
      console.error('Failed to load location state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
    const interval = setInterval(fetchLocation, 20000); // Polling every 20s
    return () => clearInterval(interval);
  }, []);

  // Show temporary status toast
  const showToast = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage({ text: '', type: '' }), 4500);
  };

  // Sync GPS from current browser / device
  const syncDeviceGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    setSyncingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          const res = await fetch('/api/location/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy: Math.round(accuracy),
              updatedBy: 'phone_gps',
            }),
          });
          const data = await res.json();
          if (data.success) {
            setLocation(data.data);
            setManualAddress(data.data.address);
            setManualLat(data.data.latitude);
            setManualLng(data.data.longitude);
            showToast(`GPS Synced: ${data.data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}`);
          } else {
            showToast(data.message || 'Failed to update location', 'error');
          }
        } catch (err) {
          showToast(`Server sync error: ${err.message}`, 'error');
        } finally {
          setSyncingGps(false);
        }
      },
      (error) => {
        setSyncingGps(false);
        let msg = 'Unable to retrieve location';
        if (error.code === error.PERMISSION_DENIED) msg = 'Location permission denied in browser';
        else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location info unavailable';
        else if (error.code === error.TIMEOUT) msg = 'Location request timed out';
        showToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Toggle Continuous Live Watch
  const toggleContinuousWatch = () => {
    if (isWatchingGps) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsWatchingGps(false);
      showToast('Continuous live GPS tracking paused', 'info');
    } else {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
      }
      setIsWatchingGps(true);
      showToast('Continuous Live GPS started! Syncing updates in real time.', 'success');

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          try {
            const res = await fetch('/api/location/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude,
                longitude,
                accuracy: Math.round(accuracy),
                updatedBy: 'phone_gps',
              }),
            });
            const data = await res.json();
            if (data.success) {
              setLocation(data.data);
            }
          } catch (err) {
            console.warn('Live watch push error:', err);
          }
        },
        (err) => {
          console.warn('Live watch position error:', err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    }
  };

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Save Settings & Privacy Rules
  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/location/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLiveTrackingActive,
          shareWithAll,
          generalLocationDescription: generalDesc,
          address: manualAddress,
          latitude: manualLat ? parseFloat(manualLat) : undefined,
          longitude: manualLng ? parseFloat(manualLng) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLocation(data.data);
        showToast('Location settings & address saved successfully!');
      } else {
        showToast(data.message || 'Error saving settings', 'error');
      }
    } catch (err) {
      showToast(`Save error: ${err.message}`, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Format relative time
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const mapsUrl = location?.latitude && location?.longitude
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : null;

  return (
    <div className="location-manager-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Status Toast */}
      {statusMessage.text && (
        <div
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(37, 211, 102, 0.15)',
            color: statusMessage.type === 'error' ? '#ef4444' : '#25D366',
            border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(37, 211, 102, 0.3)'}`,
          }}
        >
          {statusMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Top Banner: Current Location Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.08) 0%, rgba(18, 140, 126, 0.12) 100%)',
          border: '1px solid rgba(37, 211, 102, 0.25)',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1, minWidth: '280px' }}>
          <div
            style={{
              background: '#25D366',
              color: '#0b141a',
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(37, 211, 102, 0.35)',
            }}
          >
            <MapPin size={24} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#e9edef' }}>
                {location?.name || "Wasim Khan's Location"}
              </h4>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 600,
                  background: isLiveTrackingActive ? 'rgba(37, 211, 102, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                  color: isLiveTrackingActive ? '#25D366' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isLiveTrackingActive ? '#25D366' : '#94a3b8',
                    boxShadow: isLiveTrackingActive ? '0 0 8px #25D366' : 'none',
                  }}
                />
                {isLiveTrackingActive ? 'Auto-Sharing Active' : 'Sharing Paused'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.92rem', color: '#aebac1', lineHeight: 1.4 }}>
              {location?.address || 'No address resolved yet'}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.78rem', color: '#8696a0' }}>
              <span>🌐 Lat: <strong>{location?.latitude?.toFixed(4) || '—'}</strong>, Lon: <strong>{location?.longitude?.toFixed(4) || '—'}</strong></span>
              <span>🎯 Accuracy: ±<strong>{location?.accuracy || 10}m</strong></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={12} /> Updated: <strong>{formatTimeAgo(location?.lastUpdated)}</strong>
              </span>
              <span style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>
                Source: {location?.updatedBy === 'phone_gps' ? '📱 Mobile GPS' : location?.updatedBy === 'whatsapp_pin' ? '💬 WhatsApp Pin' : '💻 Dashboard'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.08)',
                color: '#e9edef',
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <ExternalLink size={14} /> Open in Maps
            </a>
          )}

          <button
            type="button"
            onClick={syncDeviceGps}
            disabled={syncingGps}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: '#25D366',
              color: '#0b141a',
              fontWeight: 600,
              border: 'none',
              cursor: syncingGps ? 'not-allowed' : 'pointer',
            }}
          >
            <Smartphone size={14} className={syncingGps ? 'spin' : ''} />
            {syncingGps ? 'Syncing GPS...' : '📱 Sync GPS Now'}
          </button>

          <button
            type="button"
            onClick={toggleContinuousWatch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: isWatchingGps ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: isWatchingGps ? '#ef4444' : '#60a5fa',
              border: `1px solid ${isWatchingGps ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Radio size={14} className={isWatchingGps ? 'pulse' : ''} />
            {isWatchingGps ? 'Stop Live Watch' : 'Continuous Live GPS'}
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Panel 1: Privacy & Auto-Reply Rules */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '1.15rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <Shield size={18} style={{ color: '#25D366' }} />
            <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#e9edef' }}>
              Privacy & Auto-Reply Rules
            </h5>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Master Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.86rem', color: '#e9edef', fontWeight: 500, display: 'block' }}>
                  Enable Location Sharing
                </span>
                <span style={{ fontSize: '0.75rem', color: '#8696a0' }}>
                  Reply with location when someone asks "kaha ho?", "where are you?"
                </span>
              </div>
              <input
                type="checkbox"
                checked={isLiveTrackingActive}
                onChange={(e) => setIsLiveTrackingActive(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#25D366', cursor: 'pointer' }}
              />
            </label>

            {/* Audience Filter */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.86rem', color: '#e9edef', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}>
                Audience Access
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#aebac1', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="audience"
                    checked={shareWithAll === true}
                    onChange={() => setShareWithAll(true)}
                    style={{ accentColor: '#25D366' }}
                  />
                  <span>
                    <strong>Share with Everyone</strong> (Whitelisted Friends & Clients get exact GPS Pin)
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#aebac1', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="audience"
                    checked={shareWithAll === false}
                    onChange={() => setShareWithAll(false)}
                    style={{ accentColor: '#25D366' }}
                  />
                  <span>
                    <strong>Whitelisted Friends Only</strong> (Others receive general status message)
                  </span>
                </label>
              </div>
            </div>

            {/* General Location Description */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.75rem' }}>
              <label style={{ fontSize: '0.82rem', color: '#aebac1', display: 'block', marginBottom: '0.3rem' }}>
                General Fallback Status (For unknown contacts or when exact GPS is hidden):
              </label>
              <input
                type="text"
                value={generalDesc}
                onChange={(e) => setGeneralDesc(e.target.value)}
                placeholder="e.g. Currently at office / in meeting in Mumbai"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e9edef',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Manual Location / Landmark Override */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Sliders size={18} style={{ color: '#25D366' }} />
              <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#e9edef' }}>
                Manual Address / Coordinates Override
              </h5>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#8696a0', display: 'block', marginBottom: '0.2rem' }}>
                  Address / Landmark Name:
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="e.g. Connaught Place, New Delhi"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.7rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e9edef',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#8696a0', display: 'block', marginBottom: '0.2rem' }}>
                    Latitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    placeholder="28.6139"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#e9edef',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#8696a0', display: 'block', marginBottom: '0.2rem' }}>
                    Longitude:
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    placeholder="77.2090"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#e9edef',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.74rem', color: '#8696a0', lineHeight: 1.35 }}>
                💡 <strong>Pro-Tip:</strong> You can also send a <strong>WhatsApp Location Pin</strong> directly from your phone to the bot chat, and it will auto-update this location instantly!
              </p>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={savingSettings}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.1rem',
                borderRadius: '8px',
                background: '#25D366',
                color: '#0b141a',
                fontWeight: 600,
                fontSize: '0.84rem',
                border: 'none',
                cursor: savingSettings ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={14} />
              {savingSettings ? 'Saving...' : 'Save Location & Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
