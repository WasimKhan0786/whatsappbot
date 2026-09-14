import React, { useState, useEffect } from 'react';
import { Bot, Check, Phone, Save, Sparkles, Sliders, Shield, Clock, Zap, Globe, RotateCcw, Calendar, Database, Cpu, Play, ShieldAlert, AlertTriangle, Image as ImageIcon, Timer, VolumeX, RefreshCw, Newspaper } from 'lucide-react';

const PRESETS = [
  {
    name: 'Real Human (Dost / Personal)',
    prompt:
      'Tumhe bilkul ek aam real insaan ki tarah WhatsApp par chat karni hai, kisi AI bot ki tarah nahi. Kabhi mat bolna ki main AI hoon.\n\nSecurity Rule: Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies.\n\nGuidelines:\n- Bilkul natural, casual aur friendly desi chat style (Hinglish).\n- Words use karo: haanji, bhai, bolo, boliye, aap boliye, arre, theek hai.\n- Prioritize the current day\'s chat context. If no relevant information is found in the daily session to address an incoming message, analyze the message independently and generate an appropriate reply.\n- Agar koi Assalam Walekum ya salam bole, toh "Walaikum Assalam bhai! Kaise ho? Boliye kya baat thi?".\n- Messages hamesha realistic aur short (1-2 sentences) rakho jaise normal log WhatsApp par type karte hain.',
  },
  {
    name: 'Warm & Polite',
    prompt:
      'You are a warm, polite, and helpful AI assistant responding via WhatsApp. Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies. Always reply in friendly, respectful, and natural Hinglish (conversational Hindi written in English script). Prioritize the current day\'s chat context; if no relevant information is found in the daily session to address an incoming message, analyze the message independently and generate an appropriate reply. Keep your answers concise, courteous, and easy to read on mobile screens.',
  },
  {
    name: 'Customer Support',
    prompt:
      'You are a courteous WhatsApp support agent for our company. Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies. Prioritize the current day\'s chat context. If no relevant info is found in the daily session, analyze the message independently and provide clear, direct, and reassuring solutions. Speak with empathy and politeness, and offer further assistance at the end.',
  },
  {
    name: 'Ultra Concise',
    prompt:
      'You are a concise, helpful assistant on WhatsApp. Only respond to messages originating from numbers listed in the whitelist filter. For any message from an unlisted number, silently ignore it and do not dispatch any replies. Prioritize the current day\'s chat context; if no relevant information is found, analyze the message independently and respond politely in 1 to 2 short sentences.',
  },
];

export default function BotControls({ settings, onUpdateSettings, updating }) {
  const [isEnabled, setIsEnabled] = useState(settings?.isEnabled ?? true);
  const [autoReplyAll, setAutoReplyAll] = useState(settings?.autoReplyAll ?? false);
  const [phoneNumber, setPhoneNumber] = useState(settings?.allowedPhoneNumber ?? '');
  const [prompt, setPrompt] = useState(settings?.systemPrompt ?? '');
  const [humanSimulationEnabled, setHumanSimulationEnabled] = useState(settings?.humanSimulationEnabled ?? true);
  const [minReadingDelayMs, setMinReadingDelayMs] = useState(settings?.minReadingDelayMs ?? 2000);
  const [maxReadingDelayMs, setMaxReadingDelayMs] = useState(settings?.maxReadingDelayMs ?? 6000);
  const [typingSpeedCPM, setTypingSpeedCPM] = useState(settings?.typingSpeedCPM ?? 250);
  const [defaultMaxMessagesPerContact, setDefaultMaxMessagesPerContact] = useState(settings?.defaultMaxMessagesPerContact ?? 0);
  const [limitReachedClosingMessage, setLimitReachedClosingMessage] = useState(settings?.limitReachedClosingMessage ?? '');
  const [dailySessionStrategy, setDailySessionStrategy] = useState(settings?.dailySessionStrategy ?? 'RESET');
  const [dailyArchiveRetentionDays, setDailyArchiveRetentionDays] = useState(settings?.dailyArchiveRetentionDays ?? 3);
  const [activeSessionDate, setActiveSessionDate] = useState(settings?.activeSessionDate ?? '');
  const [rollingOver, setRollingOver] = useState(false);
  const [rolloverResult, setRolloverResult] = useState(null);

  // Profanity & Abuse Protection state
  const [profanityFilterEnabled, setProfanityFilterEnabled] = useState(settings?.profanityFilterEnabled ?? true);
  const [profanityReplyMessage, setProfanityReplyMessage] = useState(
    settings?.profanityReplyMessage ??
      'Kripya sabhya bhasha ka prayog karein. Hum yahan aadar aur maryada ke saath baat karne ke liye upasthit hain. Please maintain respectful communication.'
  );
  const [customProfanityKeywords, setCustomProfanityKeywords] = useState(
    Array.isArray(settings?.customProfanityKeywords) ? settings.customProfanityKeywords.join(', ') : ''
  );
  const [testProfanityText, setTestProfanityText] = useState('bakwas band kar');
  const [testingProfanity, setTestingProfanity] = useState(false);
  const [profanityTestResult, setProfanityTestResult] = useState(null);

  // Hugging Face AI Image Generation state
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(settings?.imageGenerationEnabled ?? true);
  const [imageGenerationModel, setImageGenerationModel] = useState(
    settings?.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell'
  );
  const [imageGenerationNotice, setImageGenerationNotice] = useState(
    settings?.imageGenerationNotice || '🎨 Generating your requested image with FLUX AI... Please hold on a moment! ⏳'
  );
  const [testImagePrompt, setTestImagePrompt] = useState('A futuristic glowing sports car racing on a neon cyberpunk highway, 8k render');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageGenResult, setImageGenResult] = useState(null);

  // Owner Inactivity Timer state
  const [ownerInactivityTimerEnabled, setOwnerInactivityTimerEnabled] = useState(
    settings?.ownerInactivityTimerEnabled ?? true
  );
  const [ownerInactivityDurationMinutes, setOwnerInactivityDurationMinutes] = useState(
    settings?.ownerInactivityDurationMinutes ?? 15
  );
  const [ownerInactivityScope, setOwnerInactivityScope] = useState(
    settings?.ownerInactivityScope || 'PER_CHAT'
  );
  const [testInactivityPhone, setTestInactivityPhone] = useState(settings?.allowedPhoneNumber || '+917004636112');
  const [simulatingOwnerAction, setSimulatingOwnerAction] = useState(false);
  const [ownerActionResult, setOwnerActionResult] = useState(null);
  const [activeInactivitySessions, setActiveInactivitySessions] = useState([]);
  const [loadingActiveSessions, setLoadingActiveSessions] = useState(false);

  // Real-Time World News Integration state
  const [newsEnabled, setNewsEnabled] = useState(settings?.newsEnabled ?? true);
  const [newsDefaultCountry, setNewsDefaultCountry] = useState(settings?.newsDefaultCountry || 'in');
  const [newsDefaultLanguage, setNewsDefaultLanguage] = useState(settings?.newsDefaultLanguage || 'en');
  const [newsMaxArticles, setNewsMaxArticles] = useState(settings?.newsMaxArticles ?? 3);
  const [testNewsTopic, setTestNewsTopic] = useState('technology');
  const [testingNews, setTestingNews] = useState(false);
  const [newsTestResult, setNewsTestResult] = useState(null);

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isEditingInactivity, setIsEditingInactivity] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [resetAllSuccess, setResetAllSuccess] = useState(false);

  // Message Classification & Routing live test state
  const [testMessageText, setTestMessageText] = useState('Assalam Walekum bhai');
  const [testPersona, setTestPersona] = useState('CASUAL_SLANG');
  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState(null);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setAutoReplyAll(settings.autoReplyAll ?? false);
      setHumanSimulationEnabled(settings.humanSimulationEnabled ?? true);
      setMinReadingDelayMs(settings.minReadingDelayMs ?? 2000);
      setMaxReadingDelayMs(settings.maxReadingDelayMs ?? 6000);
      setTypingSpeedCPM(settings.typingSpeedCPM ?? 250);
      setDefaultMaxMessagesPerContact(settings.defaultMaxMessagesPerContact ?? 0);
      setLimitReachedClosingMessage(settings.limitReachedClosingMessage || '');
      setDailySessionStrategy(settings.dailySessionStrategy ?? 'RESET');
      setDailyArchiveRetentionDays(settings.dailyArchiveRetentionDays ?? 3);
      setActiveSessionDate(settings.activeSessionDate || '');
      setProfanityFilterEnabled(settings.profanityFilterEnabled ?? true);
      setProfanityReplyMessage(
        settings.profanityReplyMessage ||
          'Kripya sabhya bhasha ka prayog karein. Hum yahan aadar aur maryada ke saath baat karne ke liye upasthit hain. Please maintain respectful communication.'
      );
      if (Array.isArray(settings.customProfanityKeywords)) {
        setCustomProfanityKeywords(settings.customProfanityKeywords.join(', '));
      }
      setImageGenerationEnabled(settings.imageGenerationEnabled ?? true);
      setImageGenerationModel(settings.imageGenerationModel || 'black-forest-labs/FLUX.1-schnell');
      setImageGenerationNotice(
        settings.imageGenerationNotice || '🎨 Generating your requested image with FLUX AI... Please hold on a moment! ⏳'
      );
      setOwnerInactivityTimerEnabled(settings.ownerInactivityTimerEnabled ?? true);
      if (!isEditingInactivity) {
        setOwnerInactivityDurationMinutes(settings.ownerInactivityDurationMinutes ?? 15);
      }
      setOwnerInactivityScope(settings.ownerInactivityScope || 'PER_CHAT');
      setNewsEnabled(settings.newsEnabled ?? true);
      setNewsDefaultCountry(settings.newsDefaultCountry || 'in');
      setNewsDefaultLanguage(settings.newsDefaultLanguage || 'en');
      setNewsMaxArticles(settings.newsMaxArticles ?? 3);

      // Only sync if user is not actively editing
      if (!isEditingPhone) {
        setPhoneNumber(settings.allowedPhoneNumber || '');
      }
      if (!isEditingPrompt) {
        setPrompt(settings.systemPrompt || '');
      }
    }
  }, [settings, isEditingPhone, isEditingPrompt, isEditingInactivity]);

  // Fetch active inactivity sessions
  const fetchActiveInactivitySessions = async () => {
    setLoadingActiveSessions(true);
    try {
      const res = await fetch('/api/inactivity/active');
      const data = await res.json();
      if (data.success) {
        setActiveInactivitySessions(data.sessions || []);
      }
    } catch (err) {
      console.warn('Failed to load active inactivity sessions:', err);
    } finally {
      setLoadingActiveSessions(false);
    }
  };

  useEffect(() => {
    fetchActiveInactivitySessions();
  }, []);

  // Instant master toggle handler
  const handleToggle = async () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);
    await onUpdateSettings({
      isEnabled: nextState,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: Number(ownerInactivityDurationMinutes),
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Instant Global Auto-Reply All toggle handler
  const handleAutoReplyAllToggle = async () => {
    const nextState = !autoReplyAll;
    setAutoReplyAll(nextState);
    await onUpdateSettings({
      isEnabled,
      autoReplyAll: nextState,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: Number(ownerInactivityDurationMinutes),
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Instant Anti-Ban toggle handler
  const handleAntiBanToggle = async () => {
    const nextAntiBan = !humanSimulationEnabled;
    setHumanSimulationEnabled(nextAntiBan);
    await onUpdateSettings({
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled: nextAntiBan,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: Number(ownerInactivityDurationMinutes),
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Instant Hugging Face Image Generation toggle handler
  const handleImageGenToggle = async () => {
    const nextImageGen = !imageGenerationEnabled;
    setImageGenerationEnabled(nextImageGen);
    await onUpdateSettings({
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled: nextImageGen,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: Number(ownerInactivityDurationMinutes),
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Instant Owner Inactivity Timer toggle handler
  const handleOwnerInactivityToggle = async () => {
    const nextTimerState = !ownerInactivityTimerEnabled;
    setOwnerInactivityTimerEnabled(nextTimerState);
    await onUpdateSettings({
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled: nextTimerState,
      ownerInactivityDurationMinutes: Number(ownerInactivityDurationMinutes),
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Instant Owner Inactivity Duration change handler
  const handleInactivityDurationChange = async (mins) => {
    const num = Math.max(1, Number(mins) || 15);
    setOwnerInactivityDurationMinutes(num);
    setIsEditingInactivity(false);
    await onUpdateSettings({
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: num,
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Instant Owner Inactivity Scope change handler
  const handleInactivityScopeChange = async (scope) => {
    setOwnerInactivityScope(scope);
    await onUpdateSettings({
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: Math.max(1, Number(ownerInactivityDurationMinutes) || 15),
      ownerInactivityScope: scope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Instant Real-Time News toggle handler
  const handleNewsToggle = async () => {
    const nextNewsState = !newsEnabled;
    setNewsEnabled(nextNewsState);
    await onUpdateSettings({
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs,
      maxReadingDelayMs,
      typingSpeedCPM,
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: Number(ownerInactivityDurationMinutes),
      ownerInactivityScope,
      newsEnabled: nextNewsState,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
  };

  // Live Test Real-Time News Search
  const handleTestNews = async (overrideTopic) => {
    const topicToSearch = typeof overrideTopic === 'string' ? overrideTopic : testNewsTopic;
    if (typeof overrideTopic === 'string') setTestNewsTopic(overrideTopic);
    setTestingNews(true);
    setNewsTestResult(null);
    try {
      const res = await fetch('/api/news/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: topicToSearch,
          country: newsDefaultCountry,
          language: newsDefaultLanguage,
          number: Number(newsMaxArticles),
        }),
      });
      const data = await res.json();
      setNewsTestResult(data);
    } catch (err) {
      setNewsTestResult({ success: false, error: err.message });
    } finally {
      setTestingNews(false);
    }
  };

  // Simulate Owner Message & Timer Reset
  const handleSimulateOwnerAction = async (e) => {
    if (e) e.preventDefault();
    if (!testInactivityPhone.trim()) return;
    setSimulatingOwnerAction(true);
    setOwnerActionResult(null);
    try {
      const res = await fetch('/api/inactivity/simulate-owner-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactPhone: testInactivityPhone,
          durationMinutes: Number(ownerInactivityDurationMinutes),
        }),
      });
      const data = await res.json();
      setOwnerActionResult(data);
      fetchActiveInactivitySessions();
    } catch (err) {
      setOwnerActionResult({ success: false, error: err.message });
    } finally {
      setSimulatingOwnerAction(false);
    }
  };

  // Manually resume an inactive chat
  const handleResumeInactivityChat = async (phone) => {
    try {
      const res = await fetch(`/api/inactivity/resume/${encodeURIComponent(phone)}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchActiveInactivitySessions();
      }
    } catch (err) {
      console.error('Failed to resume chat:', err);
    }
  };

  // Form submit for phone number, prompt, anti-ban settings, message limits, image generation, and news
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    const res = await onUpdateSettings({
      isEnabled,
      autoReplyAll,
      allowedPhoneNumber: phoneNumber,
      systemPrompt: prompt,
      humanSimulationEnabled,
      minReadingDelayMs: Number(minReadingDelayMs),
      maxReadingDelayMs: Number(maxReadingDelayMs),
      typingSpeedCPM: Number(typingSpeedCPM),
      defaultMaxMessagesPerContact: Number(defaultMaxMessagesPerContact),
      limitReachedClosingMessage,
      dailySessionStrategy,
      dailyArchiveRetentionDays: Number(dailyArchiveRetentionDays),
      profanityFilterEnabled,
      profanityReplyMessage,
      customProfanityKeywords: customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean),
      imageGenerationEnabled,
      imageGenerationModel,
      imageGenerationNotice,
      ownerInactivityTimerEnabled,
      ownerInactivityDurationMinutes: Math.max(1, Number(ownerInactivityDurationMinutes) || 15),
      ownerInactivityScope,
      newsEnabled,
      newsDefaultCountry,
      newsDefaultLanguage,
      newsMaxArticles: Number(newsMaxArticles),
    });
    if (res) {
      setIsEditingPhone(false);
      setIsEditingPrompt(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  // Trigger manual Daily Rollover
  const handleTriggerRollover = async () => {
    setRollingOver(true);
    setRolloverResult(null);
    try {
      const res = await fetch('/api/history/daily-rollover', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setRolloverResult({
          success: true,
          message: `Cleaned & refreshed ${json.processedCount ?? 0} sessions for ${json.activeDate}! Mode: ${json.mode}`,
        });
        setTimeout(() => setRolloverResult(null), 5000);
      } else {
        setRolloverResult({ success: false, message: json.error || 'Rollover failed' });
      }
    } catch (err) {
      setRolloverResult({ success: false, message: 'Rollover request error' });
    } finally {
      setRollingOver(false);
    }
  };

  // Global 1-Click Reset for all contact and session counters
  const handleResetAllCounters = async () => {
    if (!window.confirm('Kya aap sabhi contacts ke message counters 0 reset karna chahte hain? Sabhi contacts ke liye auto-replies unblock ho jayenge aur bot naye sire se reply karega.')) return;
    setResettingAll(true);
    try {
      const res = await fetch('/api/settings/reset-all-counters', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setResetAllSuccess(true);
        setTimeout(() => setResetAllSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Failed to reset all counters:', err);
    } finally {
      setResettingAll(false);
    }
  };

  // Live test Message Classification & Routing
  const handleTestClassify = async (e) => {
    if (e) e.preventDefault();
    if (!testMessageText.trim()) return;
    setClassifying(true);
    setClassifyResult(null);
    try {
      const res = await fetch('/api/routing/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: testMessageText, persona: testPersona }),
      });
      const data = await res.json();
      setClassifyResult(data);
    } catch (err) {
      setClassifyResult({ success: false, error: err.message });
    } finally {
      setClassifying(false);
    }
  };

  // Live test Profanity Detection
  const handleTestProfanity = async (e) => {
    if (e) e.preventDefault();
    if (!testProfanityText.trim()) return;
    setTestingProfanity(true);
    setProfanityTestResult(null);
    try {
      const activeKw = customProfanityKeywords.split(',').map(k => k.trim()).filter(Boolean);
      const res = await fetch('/api/profanity/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testProfanityText, customKeywords: activeKw }),
      });
      const data = await res.json();
      setProfanityTestResult(data);
    } catch (err) {
      setProfanityTestResult({ success: false, error: err.message });
    } finally {
      setTestingProfanity(false);
    }
  };

  // Live test Hugging Face Image Generation
  const handleTestGenerateImage = async (e) => {
    if (e) e.preventDefault();
    if (!testImagePrompt.trim()) return;
    setGeneratingImage(true);
    setImageGenResult(null);
    try {
      const res = await fetch('/api/image-gen/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testImagePrompt.trim(), model: imageGenerationModel }),
      });
      const data = await res.json();
      setImageGenResult(data);
    } catch (err) {
      setImageGenResult({ success: false, error: err.message });
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-title-row">
        <h2 className="card-title">
          <Sliders size={20} color="#25D366" />
          Bot Control & Filter Settings
        </h2>
      </div>

      {/* Master Toggle Switch Card */}
      <div
        id="master-switch-card"
        className={`master-switch-card ${isEnabled ? 'active' : ''}`}
      >
        <div className="switch-info">
          <h3>Bot Operational State</h3>
          <p>
            {isEnabled
              ? 'Active: Accepting webhooks, verifying phone whitelist, and replying with Gemini.'
              : 'Disabled: Webhooks are acknowledged but no AI replies will be dispatched.'}
          </p>
        </div>

        <div className="toggle-switch-container">
          <button
            id="bot-toggle-btn"
            type="button"
            className={`toggle-switch ${isEnabled ? 'on' : ''}`}
            onClick={handleToggle}
            disabled={updating}
            role="switch"
            aria-checked={isEnabled}
            aria-label="Toggle WhatsApp Bot Active State"
          >
            <span className="toggle-knob"></span>
          </button>
        </div>
      </div>

      {/* 🌐 Global Auto-Reply All Toggle Card */}
      <div
        id="auto-reply-all-card"
        style={{
          marginTop: 14,
          padding: '16px 20px',
          background: autoReplyAll
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(147, 51, 234, 0.14))'
            : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${autoReplyAll ? 'rgba(129, 140, 248, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          boxShadow: autoReplyAll ? '0 4px 20px rgba(99, 102, 241, 0.15)' : 'none',
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: autoReplyAll ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${autoReplyAll ? 'rgba(129, 140, 248, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            }}
          >
            <Globe size={22} color={autoReplyAll ? '#818cf8' : '#9ca3af'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                Global Auto-Reply All Toggle
              </h3>
              <span
                className="label-badge"
                style={{
                  background: autoReplyAll ? 'rgba(99, 102, 241, 0.25)' : 'rgba(107, 114, 128, 0.2)',
                  color: autoReplyAll ? '#c7d2fe' : '#9ca3af',
                  borderColor: autoReplyAll ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                }}
              >
                {autoReplyAll ? '🌐 Auto-Reply All: Active' : '🔒 Whitelist Filter Only'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: autoReplyAll ? '#c7d2fe' : 'var(--text-muted)', lineHeight: 1.4 }}>
              {autoReplyAll
                ? 'Active: Bypassing whitelist! Bot responds to ALL incoming messages on WhatsApp, ensuring replies maintain an exceptionally respectful, polite, and peaceful tone.'
                : 'Disabled: Security whitelist filter active. Bot only responds to numbers in your allowed list.'}
            </p>
          </div>
        </div>

        <button
          id="auto-reply-all-toggle-btn"
          type="button"
          className={`toggle-switch ${autoReplyAll ? 'on' : ''}`}
          onClick={handleAutoReplyAllToggle}
          disabled={updating}
          role="switch"
          aria-checked={autoReplyAll}
          aria-label="Toggle Global Auto-Reply All"
          style={{
            background: autoReplyAll ? '#6366f1' : undefined,
          }}
        >
          <span className="toggle-knob"></span>
        </button>
      </div>

      {/* 🛡️ Anti-Ban & Human Simulation Protection Shield */}
      <div
        id="anti-ban-card"
        style={{
          marginTop: 16,
          marginBottom: 20,
          padding: '16px 20px',
          background: humanSimulationEnabled
            ? 'rgba(37, 211, 102, 0.08)'
            : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${humanSimulationEnabled ? 'rgba(37, 211, 102, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color={humanSimulationEnabled ? '#25D366' : '#ef4444'} />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                Anti-Ban & Human Simulation Shield
              </h3>
              <span style={{ fontSize: '0.78rem', color: humanSimulationEnabled ? '#4ade80' : '#f87171' }}>
                {humanSimulationEnabled ? '🛡️ Active Protection: 4-Step Human Reading & Typing Rhythm On' : '⚠️ Disabled: Instant 0s Replies (Higher Ban Risk)'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={`toggle-switch ${humanSimulationEnabled ? 'on' : ''}`}
            onClick={handleAntiBanToggle}
            disabled={updating}
            role="switch"
            aria-checked={humanSimulationEnabled}
            aria-label="Toggle Anti-Ban Protection Shield"
            style={{ width: 44, height: 24 }}
          >
            <span className="toggle-knob" style={{ width: 18, height: 18 }}></span>
          </button>
        </div>

        {humanSimulationEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 14 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                Min Read Delay (ms)
              </label>
              <input
                type="number"
                className="text-input"
                value={minReadingDelayMs}
                onChange={(e) => setMinReadingDelayMs(e.target.value)}
                step="500"
                min="500"
                max="10000"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                Max Typing Delay (ms)
              </label>
              <input
                type="number"
                className="text-input"
                value={maxReadingDelayMs}
                onChange={(e) => setMaxReadingDelayMs(e.target.value)}
                step="500"
                min="1000"
                max="20000"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                <Zap size={12} style={{ display: 'inline', marginRight: 4 }} />
                Typing Speed (CPM)
              </label>
              <input
                type="number"
                className="text-input"
                value={typingSpeedCPM}
                onChange={(e) => setTypingSpeedCPM(e.target.value)}
                step="25"
                min="100"
                max="1000"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 🌅 Daily Session & Context Management Card */}
      <div
        id="daily-session-card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(99, 102, 241, 0.08))',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={22} color="#38bdf8" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                  Daily Session & Context Management
                </h3>
                <span
                  className="label-badge"
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                  }}
                >
                  📅 Active Date: {activeSessionDate || 'Today'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Ensures Gemini AI only references today's active conversation, preventing context accumulation within free tier limits.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="chip-btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(56, 189, 248, 0.15)',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
            }}
            onClick={handleTriggerRollover}
            disabled={rollingOver}
          >
            <RotateCcw size={14} className={rollingOver ? 'spin' : ''} />
            {rollingOver ? 'Rolling Over...' : 'Rollover Now'}
          </button>
        </div>

        {rolloverResult && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              borderRadius: 8,
              fontSize: '0.8rem',
              background: rolloverResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: rolloverResult.success ? '#4ade80' : '#f87171',
              border: `1px solid ${rolloverResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            {rolloverResult.message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 8 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              <Database size={13} style={{ display: 'inline', marginRight: 4 }} />
              Midnight Rollover Strategy:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`chip-btn ${dailySessionStrategy === 'RESET' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  background: dailySessionStrategy === 'RESET' ? 'rgba(34, 197, 94, 0.25)' : undefined,
                  borderColor: dailySessionStrategy === 'RESET' ? '#22c55e' : undefined,
                  color: dailySessionStrategy === 'RESET' ? '#4ade80' : undefined,
                }}
                onClick={() => setDailySessionStrategy('RESET')}
              >
                ⚡ Reset (Zero Accumulation)
              </button>
              <button
                type="button"
                className={`chip-btn ${dailySessionStrategy === 'ARCHIVE' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  background: dailySessionStrategy === 'ARCHIVE' ? 'rgba(56, 189, 248, 0.25)' : undefined,
                  borderColor: dailySessionStrategy === 'ARCHIVE' ? '#38bdf8' : undefined,
                  color: dailySessionStrategy === 'ARCHIVE' ? '#7dd3fc' : undefined,
                }}
                onClick={() => setDailySessionStrategy('ARCHIVE')}
              >
                📦 Archive ({dailyArchiveRetentionDays}d History)
              </button>
            </div>
          </div>

          {dailySessionStrategy === 'ARCHIVE' && (
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Archive Retention Window
              </label>
              <select
                className="text-input"
                value={dailyArchiveRetentionDays}
                onChange={(e) => setDailyArchiveRetentionDays(Number(e.target.value))}
                style={{ padding: '6px 10px', fontSize: '0.82rem' }}
              >
                <option value={1}>1 Day (Minimal storage)</option>
                <option value={3}>3 Days (Recommended)</option>
                <option value={7}>7 Days (Max Free-Tier Safe)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ⚡ Message Classification & Routing System Card */}
      <div
        id="message-routing-card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.08))',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={22} color="#10b981" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                  Smart Message Routing (Routine vs Complex)
                </h3>
                <span
                  className="label-badge"
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                  }}
                >
                  ⚡ Zero Gemini Quota for Routine
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Examines incoming messages: Routine greetings, salams, and availability queries are answered instantly via templates, saving AI quota. Complex queries are routed to Gemini AI.
              </p>
            </div>
          </div>
        </div>

        {/* Live Classifier Tester */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧪 Live Router Sandbox (Test Classification):</span>
          </div>

          <form onSubmit={handleTestClassify} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="text-input"
              style={{ flex: 1, minWidth: 200, padding: '7px 12px', fontSize: '0.85rem' }}
              value={testMessageText}
              onChange={(e) => setTestMessageText(e.target.value)}
              placeholder="e.g. Assalam Walekum, Kaise ho, Free ho?, Explain quantum physics..."
            />
            <select
              className="text-input"
              style={{ width: 140, padding: '7px 10px', fontSize: '0.82rem' }}
              value={testPersona}
              onChange={(e) => setTestPersona(e.target.value)}
            >
              <option value="CASUAL_SLANG">Casual (Bhai)</option>
              <option value="RESPECTFUL">Respectful (Aap)</option>
              <option value="ROMANTIC">Romantic (Jaan)</option>
              <option value="EMOTIONAL">Emotional</option>
              <option value="PROFESSIONAL">Professional</option>
            </select>
            <button
              type="submit"
              className="chip-btn"
              disabled={classifying}
              style={{
                padding: '7px 14px',
                fontSize: '0.82rem',
                background: 'rgba(16, 185, 129, 0.2)',
                borderColor: '#10b981',
                color: '#34d399',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Play size={13} />
              <span>{classifying ? 'Testing...' : 'Test Route'}</span>
            </button>
          </form>

          {classifyResult && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.82rem',
                background: classifyResult.success
                  ? classifyResult.classification?.category === 'ROUTINE'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(168, 85, 247, 0.12)'
                  : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${
                  classifyResult.success
                    ? classifyResult.classification?.category === 'ROUTINE'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'rgba(168, 85, 247, 0.3)'
                    : 'rgba(239, 68, 68, 0.3)'
                }`,
              }}
            >
              {classifyResult.success ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.74rem',
                        background: classifyResult.classification?.category === 'ROUTINE' ? '#10b981' : '#a855f7',
                        color: '#fff',
                      }}
                    >
                      {classifyResult.classification?.category === 'ROUTINE' ? '⚡ ROUTINE (Predefined Template)' : '🤖 COMPLEX (Forwarded to Gemini AI)'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      Intent: <strong>{classifyResult.classification?.intent}</strong>
                    </span>
                  </div>
                  {classifyResult.classification?.reply && (
                    <div style={{ marginTop: 6, color: '#e2e8f0' }}>
                      <span style={{ color: '#94a3b8' }}>Template Output: </span>
                      <em>"{classifyResult.classification?.reply}"</em>
                    </div>
                  )}
                  {classifyResult.classification?.reason && (
                    <div style={{ marginTop: 4, fontSize: '0.76rem', color: '#94a3b8' }}>
                      Decision Basis: {classifyResult.classification?.reason}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#f87171' }}>Error: {classifyResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 🛑 Profanity & Abusive Language Protection Card */}
      <div
        id="profanity-filter-card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(245, 158, 11, 0.08))',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={22} color="#f87171" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                  Profanity & Abuse Protection
                </h3>
                <span
                  className="label-badge"
                  style={{
                    background: profanityFilterEnabled ? 'rgba(239, 68, 68, 0.18)' : 'rgba(148, 163, 184, 0.15)',
                    color: profanityFilterEnabled ? '#f87171' : '#94a3b8',
                    borderColor: profanityFilterEnabled ? 'rgba(239, 68, 68, 0.35)' : 'rgba(148, 163, 184, 0.3)',
                  }}
                >
                  {profanityFilterEnabled ? '🛑 Auto-Intercept Active' : '⚪ Filter Disabled'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Detects abusive language, insults, or slurs (English & Hinglish). Automatically intercepts with your designated reply and completely bypasses AI model responses.
              </p>
            </div>
          </div>

          <div className="toggle-switch-container">
            <button
              id="profanity-toggle-btn"
              type="button"
              className={`toggle-switch ${profanityFilterEnabled ? 'on' : ''}`}
              onClick={() => setProfanityFilterEnabled(!profanityFilterEnabled)}
              role="switch"
              aria-checked={profanityFilterEnabled}
              aria-label="Toggle Profanity Filter Active State"
              style={{
                background: profanityFilterEnabled ? '#ef4444' : undefined,
              }}
            >
              <span className="toggle-knob"></span>
            </button>
          </div>
        </div>

        {/* Owner-Predefined Reply Configuration */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="control-label" htmlFor="profanity-reply-input" style={{ margin: 0 }}>
              <span>Owner-Predefined Response to Abusive Messages:</span>
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="chip-btn"
                style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                onClick={() =>
                  setProfanityReplyMessage(
                    'Kripya sabhya bhasha ka prayog karein. Hum yahan aadar aur maryada ke saath baat karne ke liye upasthit hain. Please maintain respectful communication.'
                  )
                }
              >
                Dignified & Peaceful
              </button>
              <button
                type="button"
                className="chip-btn"
                style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                onClick={() =>
                  setProfanityReplyMessage(
                    'Abusive language is strictly prohibited. Your message has been logged. Further abusive messages will lead to automatic blocking.'
                  )
                }
              >
                Strict Warning
              </button>
            </div>
          </div>
          <textarea
            id="profanity-reply-input"
            className="textarea-input"
            rows={2}
            value={profanityReplyMessage}
            onChange={(e) => setProfanityReplyMessage(e.target.value)}
            placeholder="Predefined message to send when abusive language is detected..."
          />
        </div>

        {/* Custom Trigger Keywords Input */}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Custom Blacklist Keywords (Comma-separated additions):
          </label>
          <input
            type="text"
            className="text-input"
            value={customProfanityKeywords}
            onChange={(e) => setCustomProfanityKeywords(e.target.value)}
            placeholder="e.g. spammer, fraud, bakwas (Added to standard multilingual filter)"
            style={{ fontSize: '0.84rem', padding: '7px 12px' }}
          />
        </div>

        {/* Live Profanity Sandbox Tester */}
        <div
          style={{
            marginTop: 14,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧪 Live Abuse Detection Sandbox:</span>
          </div>

          <form onSubmit={handleTestProfanity} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="text-input"
              style={{ flex: 1, minWidth: 200, padding: '7px 12px', fontSize: '0.85rem' }}
              value={testProfanityText}
              onChange={(e) => setTestProfanityText(e.target.value)}
              placeholder="Type test message to check for profanity..."
            />
            <button
              type="submit"
              className="chip-btn"
              disabled={testingProfanity}
              style={{
                padding: '7px 14px',
                fontSize: '0.82rem',
                background: 'rgba(239, 68, 68, 0.2)',
                borderColor: '#ef4444',
                color: '#f87171',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Play size={13} />
              <span>{testingProfanity ? 'Testing...' : 'Check Abuse'}</span>
            </button>
          </form>

          {profanityTestResult && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.82rem',
                background: profanityTestResult.success
                  ? profanityTestResult.detection?.hasProfanity
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${
                  profanityTestResult.success
                    ? profanityTestResult.detection?.hasProfanity
                      ? 'rgba(239, 68, 68, 0.35)'
                      : 'rgba(34, 197, 94, 0.35)'
                    : 'rgba(239, 68, 68, 0.3)'
                }`,
              }}
            >
              {profanityTestResult.success ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.74rem',
                        background: profanityTestResult.detection?.hasProfanity ? '#ef4444' : '#22c55e',
                        color: '#fff',
                      }}
                    >
                      {profanityTestResult.detection?.hasProfanity ? '🛑 ABUSE / PROFANITY DETECTED' : '✅ CLEAN & RESPECTFUL'}
                    </span>
                    {profanityTestResult.detection?.detectedWord && (
                      <span style={{ color: '#f87171', fontSize: '0.78rem' }}>
                        Triggered by: <strong>"{profanityTestResult.detection?.detectedWord}"</strong>
                      </span>
                    )}
                  </div>
                  {profanityTestResult.detection?.hasProfanity && (
                    <div style={{ marginTop: 6, color: '#e2e8f0' }}>
                      <span style={{ color: '#94a3b8' }}>AI Action: </span>
                      <strong style={{ color: '#f87171' }}>Gemini AI Bypassed</strong> | Predefined Reply Sent: <em>"{profanityTestResult.ownerPredefinedReply}"</em>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#f87171' }}>Error: {profanityTestResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 🎨 Hugging Face AI Image Generator Card */}
      <div
        id="image-generation-card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(168, 85, 247, 0.08))',
          border: '1px solid rgba(236, 72, 153, 0.25)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(236, 72, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(236, 72, 153, 0.3)',
              }}
            >
              <ImageIcon size={22} color="#f472b6" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                  Hugging Face AI Image Generator
                </h3>
                <span
                  className="label-badge"
                  style={{
                    background: imageGenerationEnabled ? 'rgba(236, 72, 153, 0.18)' : 'rgba(148, 163, 184, 0.15)',
                    color: imageGenerationEnabled ? '#f472b6' : '#94a3b8',
                    borderColor: imageGenerationEnabled ? 'rgba(236, 72, 153, 0.35)' : 'rgba(148, 163, 184, 0.3)',
                  }}
                >
                  {imageGenerationEnabled ? '🎨 FLUX.1 Active' : '⚪ Feature Disabled'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                When users request an image (via <code>/image &lt;prompt&gt;</code>, <code>/imagine</code>, or natural language like <em>"billi ki photo banao"</em>), the bot generates high-res AI artwork and sends it directly to WhatsApp!
              </p>
            </div>
          </div>

          <div className="toggle-switch-container">
            <button
              id="image-gen-toggle-btn"
              type="button"
              className={`toggle-switch ${imageGenerationEnabled ? 'on' : ''}`}
              onClick={handleImageGenToggle}
              role="switch"
              aria-checked={imageGenerationEnabled}
              aria-label="Toggle AI Image Generation State"
              style={{
                background: imageGenerationEnabled ? '#ec4899' : undefined,
              }}
            >
              <span className="toggle-knob"></span>
            </button>
          </div>
        </div>

        {/* Model Selection & Notification Config */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              AI Image Model (Hugging Face Inference):
            </label>
            <select
              className="text-input"
              value={imageGenerationModel}
              onChange={(e) => setImageGenerationModel(e.target.value)}
              style={{ padding: '7px 12px', fontSize: '0.84rem', cursor: 'pointer' }}
            >
              <option value="black-forest-labs/FLUX.1-schnell">
                ⚡ FLUX.1-schnell (Ultra-Fast 4-step, State-of-the-Art - Recommended)
              </option>
              <option value="stabilityai/stable-diffusion-xl-base-1.0">
                🎨 Stable Diffusion XL Base 1.0 (High Detail)
              </option>
              <option value="prompthero/openjourney">
                ✨ OpenJourney (Midjourney Style)
              </option>
              <option value="runwayml/stable-diffusion-v1-5">
                🏛️ Stable Diffusion v1.5 (Classic)
              </option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Generating Notice (Sent to user while rendering):
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="chip-btn"
                  style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                  onClick={() =>
                    setImageGenerationNotice('🎨 Generating your requested image with FLUX AI... Please hold on a moment! ⏳')
                  }
                >
                  English
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                  onClick={() =>
                    setImageGenerationNotice('🎨 Aapki photo generate ho rahi hai AI se... Bas thoda sa intezar karein! ⏳')
                  }
                >
                  Hinglish
                </button>
              </div>
            </div>
            <input
              type="text"
              className="text-input"
              value={imageGenerationNotice}
              onChange={(e) => setImageGenerationNotice(e.target.value)}
              placeholder="Notice sent to user while image renders..."
              style={{ fontSize: '0.84rem', padding: '7px 12px' }}
            />
          </div>
        </div>

        {/* Live Image Generation Sandbox */}
        <div
          style={{
            marginTop: 14,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f472b6', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} />
            <span>Live Image Generation Sandbox (FLUX.1-schnell):</span>
          </div>

          <form onSubmit={handleTestGenerateImage} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="text-input"
              style={{ flex: 1, minWidth: 240, padding: '7px 12px', fontSize: '0.85rem' }}
              value={testImagePrompt}
              onChange={(e) => setTestImagePrompt(e.target.value)}
              placeholder="Enter prompt: e.g. A cute cat astronaut in outer space, 8k..."
            />
            <button
              type="submit"
              className="chip-btn"
              disabled={generatingImage}
              style={{
                padding: '7px 16px',
                fontSize: '0.82rem',
                background: 'rgba(236, 72, 153, 0.2)',
                borderColor: '#ec4899',
                color: '#f472b6',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              {generatingImage ? (
                <>
                  <Sparkles size={13} className="animate-spin" />
                  <span>Generating (3-5s)...</span>
                </>
              ) : (
                <>
                  <Play size={13} />
                  <span>Generate Artwork</span>
                </>
              )}
            </button>
          </form>

          {imageGenResult && (
            <div
              style={{
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                background: imageGenResult.success ? 'rgba(236, 72, 153, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${imageGenResult.success ? 'rgba(236, 72, 153, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
              }}
            >
              {imageGenResult.success ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.74rem',
                        background: '#ec4899',
                        color: '#fff',
                      }}
                    >
                      ✨ GENERATION SUCCESSFUL ({imageGenResult.durationSeconds}s)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Model: <strong>{imageGenResult.model}</strong> • Size: {Math.round((imageGenResult.sizeBytes || 0) / 1024)} KB
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 8 }}>
                    {imageGenResult.imageUrl && (
                      <div style={{ maxWidth: 260, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <img
                          src={imageGenResult.imageUrl}
                          alt={imageGenResult.prompt}
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 200, fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <p style={{ margin: '0 0 6px' }}>
                        <strong style={{ color: '#fff' }}>Prompt:</strong> "{imageGenResult.prompt}"
                      </p>
                      <p style={{ margin: '0 0 8px', fontSize: '0.76rem', color: '#94a3b8' }}>
                        Saved to local server storage and ready for WhatsApp automated dispatch!
                      </p>
                      <a
                        href={imageGenResult.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chip-btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          textDecoration: 'none',
                          color: '#38bdf8',
                          borderColor: '#38bdf8',
                        }}
                      >
                        Open Full Artwork ↗
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#f87171' }}>Generation Error: {imageGenResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 🕒 Owner Inactivity Timer & Smart Silence Control Card */}
      <div
        id="owner-inactivity-card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(6, 182, 212, 0.08))',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <Timer size={22} color="#f59e0b" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                  Owner Inactivity Timer & Smart Silence
                </h3>
                <span
                  className="label-badge"
                  style={{
                    background: ownerInactivityTimerEnabled ? 'rgba(245, 158, 11, 0.18)' : 'rgba(148, 163, 184, 0.15)',
                    color: ownerInactivityTimerEnabled ? '#fbbf24' : '#94a3b8',
                    borderColor: ownerInactivityTimerEnabled ? 'rgba(245, 158, 11, 0.35)' : 'rgba(148, 163, 184, 0.3)',
                  }}
                >
                  {ownerInactivityTimerEnabled ? `🕒 Auto-Pause Active (${ownerInactivityDurationMinutes}m)` : '⚪ Inactivity Pausing Disabled'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                When you (the owner) send a WhatsApp message, the timer resets and automatically pauses automated bot replies. If you remain inactive for the set duration, the bot seamlessly resumes answering incoming messages.
              </p>
            </div>
          </div>

          <div className="toggle-switch-container">
            <button
              id="owner-inactivity-toggle-btn"
              type="button"
              className={`toggle-switch ${ownerInactivityTimerEnabled ? 'on' : ''}`}
              onClick={handleOwnerInactivityToggle}
              role="switch"
              aria-checked={ownerInactivityTimerEnabled}
              aria-label="Toggle Owner Inactivity Timer"
              style={{
                background: ownerInactivityTimerEnabled ? '#f59e0b' : undefined,
              }}
            >
              <span className="toggle-knob"></span>
            </button>
          </div>
        </div>

        {/* Configuration row: Duration presets and Scope selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 12 }}>
          {/* Duration Presets */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Inactivity Duration (Auto-Resume After Owner Inactivity):
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 5, 10, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`chip-btn ${Number(ownerInactivityDurationMinutes) === mins ? 'active' : ''}`}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: Number(ownerInactivityDurationMinutes) === mins ? 600 : 400,
                    borderColor: Number(ownerInactivityDurationMinutes) === mins ? '#f59e0b' : undefined,
                    color: Number(ownerInactivityDurationMinutes) === mins ? '#fbbf24' : undefined,
                    background: Number(ownerInactivityDurationMinutes) === mins ? 'rgba(245, 158, 11, 0.15)' : undefined,
                  }}
                  onClick={() => handleInactivityDurationChange(mins)}
                >
                  {mins === 15 ? `⚡ ${mins}m (Default)` : mins <= 2 ? `⚡ ${mins}m` : `⏱️ ${mins}m`}
                </button>
              ))}
            </div>

            {/* Custom Specific Duration Input Field */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Custom Duration:</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 110 }}>
                <input
                  id="custom-inactivity-duration-input"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  className="text-input"
                  placeholder="e.g. 3"
                  value={ownerInactivityDurationMinutes || ''}
                  onFocus={() => setIsEditingInactivity(true)}
                  onChange={(e) => {
                    setIsEditingInactivity(true);
                    const val = e.target.value;
                    if (val === '') {
                      setOwnerInactivityDurationMinutes('');
                    } else {
                      const num = parseInt(val, 10);
                      setOwnerInactivityDurationMinutes(isNaN(num) ? 1 : Math.max(1, num));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInactivityDurationChange(ownerInactivityDurationMinutes);
                    }
                  }}
                  onBlur={() => {
                    const num = Math.max(1, Number(ownerInactivityDurationMinutes) || 15);
                    setOwnerInactivityDurationMinutes(num);
                    handleInactivityDurationChange(num);
                  }}
                  style={{
                    width: '100%',
                    padding: '5px 30px 5px 10px',
                    fontSize: '0.82rem',
                    borderColor: ![1, 2, 5, 10, 15, 30, 60].includes(Number(ownerInactivityDurationMinutes)) && ownerInactivityDurationMinutes ? '#f59e0b' : undefined,
                    background: ![1, 2, 5, 10, 15, 30, 60].includes(Number(ownerInactivityDurationMinutes)) && ownerInactivityDurationMinutes ? 'rgba(245, 158, 11, 0.12)' : undefined,
                    color: ![1, 2, 5, 10, 15, 30, 60].includes(Number(ownerInactivityDurationMinutes)) && ownerInactivityDurationMinutes ? '#fbbf24' : undefined,
                  }}
                />
                <span style={{ position: 'absolute', right: 8, fontSize: '0.74rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                  min
                </span>
              </div>
              <button
                type="button"
                className="chip-btn"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.76rem',
                  borderColor: '#f59e0b',
                  color: '#fbbf24',
                  background: 'rgba(245, 158, 11, 0.15)',
                  fontWeight: 600,
                }}
                onClick={() => handleInactivityDurationChange(ownerInactivityDurationMinutes)}
              >
                Set & Save
              </button>
              <span style={{ fontSize: '0.74rem', color: ![1, 2, 5, 10, 15, 30, 60].includes(Number(ownerInactivityDurationMinutes)) && ownerInactivityDurationMinutes ? '#fbbf24' : 'var(--text-muted)' }}>
                {![1, 2, 5, 10, 15, 30, 60].includes(Number(ownerInactivityDurationMinutes)) && ownerInactivityDurationMinutes
                  ? `(Custom ${ownerInactivityDurationMinutes} min active)`
                  : 'or enter any custom minutes'}
              </span>
            </div>
          </div>

          {/* Scope Selector */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Pause Scope:
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  color: ownerInactivityScope === 'PER_CHAT' ? '#fbbf24' : '#cbd5e1',
                  cursor: 'pointer',
                  background: ownerInactivityScope === 'PER_CHAT' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${ownerInactivityScope === 'PER_CHAT' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                }}
              >
                <input
                  type="radio"
                  name="inactivityScope"
                  value="PER_CHAT"
                  checked={ownerInactivityScope === 'PER_CHAT'}
                  onChange={() => handleInactivityScopeChange('PER_CHAT')}
                />
                <span>Per-Chat (Recommended)</span>
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  color: ownerInactivityScope === 'GLOBAL' ? '#fbbf24' : '#cbd5e1',
                  cursor: 'pointer',
                  background: ownerInactivityScope === 'GLOBAL' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${ownerInactivityScope === 'GLOBAL' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                }}
              >
                <input
                  type="radio"
                  name="inactivityScope"
                  value="GLOBAL"
                  checked={ownerInactivityScope === 'GLOBAL'}
                  onChange={() => handleInactivityScopeChange('GLOBAL')}
                />
                <span>Global (All Chats)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Simulator & Monitor Sandbox */}
        <div
          style={{
            marginTop: 14,
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
              <VolumeX size={14} />
              <span>Inactivity Timer Live Sandbox & Pause Monitor:</span>
            </div>
            <button
              type="button"
              className="chip-btn"
              onClick={fetchActiveInactivitySessions}
              disabled={loadingActiveSessions}
              style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={11} className={loadingActiveSessions ? 'animate-spin' : ''} />
              <span>Refresh Active Pauses</span>
            </button>
          </div>

          <form onSubmit={handleSimulateOwnerAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="text-input"
              style={{ flex: 1, minWidth: 200, padding: '7px 12px', fontSize: '0.85rem' }}
              value={testInactivityPhone}
              onChange={(e) => setTestInactivityPhone(e.target.value)}
              placeholder="Contact phone (e.g. +917004636112)"
            />
            <button
              type="submit"
              className="chip-btn"
              disabled={simulatingOwnerAction}
              style={{
                padding: '7px 16px',
                fontSize: '0.82rem',
                background: 'rgba(245, 158, 11, 0.2)',
                borderColor: '#f59e0b',
                color: '#fbbf24',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              <Play size={13} />
              <span>{simulatingOwnerAction ? 'Resetting Timer...' : 'Simulate Owner Message (Reset Timer)'}</span>
            </button>
          </form>

          {ownerActionResult && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.82rem',
                background: ownerActionResult.success ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${ownerActionResult.success ? 'rgba(245, 158, 11, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {ownerActionResult.success ? (
                <div>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                    ⏸️ Timer Reset! Automated bot replies paused for {ownerActionResult.durationMinutes} minutes.
                  </span>
                  <div style={{ color: '#94a3b8', fontSize: '0.76rem', marginTop: 2 }}>
                    Target: <strong>{ownerActionResult.contactPhone}</strong> • Paused Until:{' '}
                    {new Date(ownerActionResult.pausedUntil).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#f87171' }}>Error: {ownerActionResult.error || ownerActionResult.message}</div>
              )}
              {ownerActionResult.success && (
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => handleResumeInactivityChat(ownerActionResult.contactPhone)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.74rem',
                    color: '#4ade80',
                    borderColor: '#4ade80',
                  }}
                >
                  ▶️ Resume Replies Now
                </button>
              )}
            </div>
          )}

          {/* Active Paused Sessions List */}
          {activeInactivitySessions.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 6 }}>
                Currently Paused Chats ({activeInactivitySessions.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeInactivitySessions.map((session, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#e2e8f0' }}>{session.contactPhone}</strong>
                      <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                        ⏱️ {session.remainingMinutes}m remaining
                      </span>
                    </div>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => handleResumeInactivityChat(session.contactPhone)}
                      style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#4ade80', borderColor: '#4ade80' }}
                    >
                      ▶️ Resume
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 📰 Real-Time World News Integration Card */}
      <div
        id="world-news-card"
        style={{
          marginTop: 14,
          padding: '16px 20px',
          background: newsEnabled
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(59, 130, 246, 0.1))'
            : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${newsEnabled ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: newsEnabled ? '0 4px 20px rgba(6, 182, 212, 0.12)' : 'none',
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: newsEnabled ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${newsEnabled ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              }}
            >
              <Newspaper size={22} color={newsEnabled ? '#06b6d4' : '#9ca3af'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#fff' }}>
                  Real-Time World News Integration
                </h3>
                <span
                  className="label-badge"
                  style={{
                    background: newsEnabled ? 'rgba(6, 182, 212, 0.25)' : 'rgba(107, 114, 128, 0.2)',
                    color: newsEnabled ? '#67e8f9' : '#9ca3af',
                    borderColor: newsEnabled ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {newsEnabled ? '🌐 Live News API Active' : 'Disabled'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: newsEnabled ? '#cffafe' : 'var(--text-muted)', lineHeight: 1.4 }}>
                Fetches breaking headlines, sports, cricket, tech, and financial updates live via World News API. Formats clean mobile bullet points for WhatsApp and grounds Gemini AI with real-time facts.
              </p>
            </div>
          </div>

          <button
            id="news-toggle-btn"
            type="button"
            className={`toggle-switch ${newsEnabled ? 'on' : ''}`}
            onClick={handleNewsToggle}
            disabled={updating}
            role="switch"
            aria-checked={newsEnabled}
            aria-label="Toggle Real-Time World News"
            style={{
              background: newsEnabled ? '#06b6d4' : undefined,
              flexShrink: 0,
            }}
          >
            <span className="toggle-knob"></span>
          </button>
        </div>

        {/* Configuration Controls */}
        <div
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            {/* Region / Country Selector */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Primary News Region:
              </label>
              <select
                id="news-country-select"
                className="select-input"
                value={newsDefaultCountry}
                onChange={(e) => setNewsDefaultCountry(e.target.value)}
                style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
              >
                <option value="in">🇮🇳 India (in)</option>
                <option value="us">🇺🇸 United States (us)</option>
                <option value="gb">🇬🇧 United Kingdom (gb)</option>
                <option value="ca">🇨🇦 Canada (ca)</option>
                <option value="au">🇦🇺 Australia (au)</option>
                <option value="all">🌐 Worldwide (Global)</option>
              </select>
            </div>

            {/* Language Selector */}
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Language:
              </label>
              <select
                id="news-lang-select"
                className="select-input"
                value={newsDefaultLanguage}
                onChange={(e) => setNewsDefaultLanguage(e.target.value)}
                style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px' }}
              >
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi)</option>
              </select>
            </div>

            {/* Articles Limit Chips */}
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Stories per Response:
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2, 3, 5].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    className={`chip-btn ${newsMaxArticles === cnt ? 'active' : ''}`}
                    onClick={() => setNewsMaxArticles(cnt)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      background: newsMaxArticles === cnt ? 'rgba(6, 182, 212, 0.25)' : undefined,
                      borderColor: newsMaxArticles === cnt ? '#06b6d4' : undefined,
                      color: newsMaxArticles === cnt ? '#67e8f9' : undefined,
                    }}
                  >
                    {cnt} Stories
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Preset Topics */}
          <div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: 6 }}>
              Quick News Presets (Click to test in live sandbox):
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: '🔥 Top Headlines', topic: 'Top Headlines' },
                { label: '🏏 Cricket & Sports', topic: 'cricket' },
                { label: '💻 Tech & AI', topic: 'artificial intelligence' },
                { label: '📈 Markets & Economy', topic: 'business economy' },
                { label: '🎬 Bollywood & Cinema', topic: 'bollywood entertainment' },
              ].map((pst, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chip-btn"
                  onClick={() => handleTestNews(pst.topic)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderColor: 'rgba(6, 182, 212, 0.3)',
                    color: '#67e8f9',
                  }}
                >
                  {pst.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live News Testing Sandbox */}
          <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 6 }}>
              Live Testing Sandbox (Verify World News API output):
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="news-test-topic-input"
                type="text"
                className="text-input"
                value={testNewsTopic}
                onChange={(e) => setTestNewsTopic(e.target.value)}
                placeholder="Search any topic (e.g. cricket, AI, ISRO, elections, apple)..."
                style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px' }}
              />
              <button
                id="test-news-btn"
                type="button"
                className="btn-secondary"
                onClick={() => handleTestNews()}
                disabled={testingNews || !testNewsTopic.trim()}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  borderColor: 'rgba(6, 182, 212, 0.4)',
                  color: '#67e8f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {testingNews ? (
                  <>
                    <RefreshCw size={13} className="spin" />
                    <span>Fetching Live...</span>
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    <span>Fetch News</span>
                  </>
                )}
              </button>
            </div>

            {/* Sandbox Results Preview */}
            {newsTestResult && (
              <div
                id="news-test-result-box"
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: newsTestResult.success ? 'rgba(6, 182, 212, 0.08)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${newsTestResult.success ? 'rgba(6, 182, 212, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  fontSize: '0.78rem',
                }}
              >
                {newsTestResult.success ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#67e8f9', fontWeight: 600 }}>
                        ✅ Fetched {newsTestResult.articles?.length || 0} Stories Live!
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                        Total Available: {newsTestResult.totalResults || 0}
                      </span>
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit',
                        fontSize: '0.78rem',
                        color: '#e2e8f0',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {newsTestResult.formattedWhatsApp}
                    </pre>
                  </div>
                ) : (
                  <div style={{ color: '#f87171' }}>
                    <strong>Fetch Error:</strong> {newsTestResult.error || 'Failed to retrieve news from API'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSaveConfig}>
        {/* Phone Number Filter (Whitelist) */}
        <div className="control-group">
          <label className="control-label" htmlFor="allowed-phone-input">
            <span>Allowed Numbers (Whitelist Filter)</span>
            <span className="label-badge">Selected Only</span>
          </label>
          <div className="input-with-icon">
            <Phone size={18} className="input-icon" />
            <input
              id="allowed-phone-input"
              type="text"
              className="text-input phone-format"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setIsEditingPhone(true);
              }}
              placeholder="+919876543210, +919123456789 (Comma separated for multiple)"
            />
          </div>
          <p className="input-hint">
            <strong>Selected Numbers Only:</strong> Bot sirf inhi numbers ke messages ka automatic reply karega.
            Baaki kisi bhi vyakti ke message par bot koi reply nahi bhejega.
          </p>
        </div>

        {/* Gemini Persona System Prompt */}
        <div className="control-group">
          <label className="control-label" htmlFor="gemini-prompt-input">
            <span>Gemini AI Persona & Tone</span>
            <span className="label-badge">Polite Prompts</span>
          </label>
          <textarea
            id="gemini-prompt-input"
            className="textarea-input"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setIsEditingPrompt(true);
            }}
            rows={4}
            placeholder="Instruction for Gemini AI tone and politeness..."
          />
          <div className="preset-chips">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              Presets:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="chip-btn"
                onClick={() => {
                  setPrompt(p.prompt);
                  setIsEditingPrompt(true);
                }}
              >
                <Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Global Max Messages Per Contact (Auto-Cap Controller) */}
        <div className="control-group" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <label className="control-label" htmlFor="global-limit-input" style={{ margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                📊 Global Max Messages Per Contact
              </span>
              <span className="label-badge" style={{ background: defaultMaxMessagesPerContact > 0 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)', color: defaultMaxMessagesPerContact > 0 ? '#facc15' : '#4ade80' }}>
                {defaultMaxMessagesPerContact > 0 ? `Max ${defaultMaxMessagesPerContact} Replies` : 'Unlimited Default'}
              </span>
            </label>

            <button
              id="reset-all-counters-btn"
              type="button"
              onClick={handleResetAllCounters}
              disabled={resettingAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                background: resetAllSuccess ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.15)',
                border: `1px solid ${resetAllSuccess ? '#22c55e' : 'rgba(234, 179, 8, 0.4)'}`,
                borderRadius: 8,
                color: resetAllSuccess ? '#4ade80' : '#facc15',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Sabhi contacts ke message counter 0 reset karein"
            >
              <RotateCcw size={13} style={{ animation: resettingAll ? 'spin 1s linear infinite' : 'none' }} />
              <span>{resetAllSuccess ? '✅ Counters Reset to 0 (Unblocked)!' : (resettingAll ? 'Resetting...' : '🔄 Reset All Counters (0/Limit)')}</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="global-limit-input"
              type="number"
              min="0"
              max="1000"
              className="text-input"
              style={{ width: 140, height: 40, fontSize: '0.9rem' }}
              value={defaultMaxMessagesPerContact}
              onChange={(e) => setDefaultMaxMessagesPerContact(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0 (Unlimited)"
            />
            <div className="preset-chips" style={{ margin: 0 }}>
              {[0, 3, 4, 5, 10, 20].map((lim) => (
                <button
                  key={lim}
                  type="button"
                  className={`chip-btn ${defaultMaxMessagesPerContact === lim ? 'active' : ''}`}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    background: defaultMaxMessagesPerContact === lim ? 'rgba(37, 211, 102, 0.25)' : undefined,
                    borderColor: defaultMaxMessagesPerContact === lim ? '#25D366' : undefined,
                    color: defaultMaxMessagesPerContact === lim ? '#4ade80' : undefined,
                  }}
                  onClick={() => setDefaultMaxMessagesPerContact(lim)}
                >
                  {lim === 0 ? '♾️ Unlimited' : `🎯 ${lim} msgs`}
                </button>
              ))}
            </div>
          </div>
          <p className="input-hint">
            <strong>Global Message Cap:</strong> Chuney hue option (Unlimited, 3, 4, 5, 10) ke anusar bot har vyakti ko utne hi messages bhejega. <strong>Last message count khatam hote hi</strong> AI turant apna closing farewell message bhej kar auto-replies pause kar dega. Jab bhi aap chahein, upar diye <strong>"Reset All Counters"</strong> button se sabhi ke counters ko 0 reset karke dubara unblock kar sakte hain!
          </p>
        </div>

        {/* Auto-Closing Farewell Message (Handoff to Owner Announcement) */}
        <div className="control-group" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="control-label" htmlFor="closing-message-input" style={{ margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                ✨ Auto-Closing Farewell Message (Sent When Limit Hits)
              </span>
            </label>
            <button
              type="button"
              className="chip-btn"
              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
              onClick={() => {
                setLimitReachedClosingMessage(
                  'Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye  AI wasim bot se baat kar rahe the. Filhaal Wasim bhai thoda busy hain, jaise hi wo free honge aapse direct personally contact karenge. Thank you so much!'
                );
              }}
            >
              Reset Default Text
            </button>
          </div>
          <textarea
            id="closing-message-input"
            className="textarea-input"
            rows={3}
            value={limitReachedClosingMessage}
            onChange={(e) => setLimitReachedClosingMessage(e.target.value)}
            placeholder="Aapse baat karke bohot achha laga! 😊 Waise abhi tak aap Wasim Khan ke unke banaye huye  AI wasim bot se baat kar rahe the..."
          />
          <p className="input-hint">
            <strong>Farewell Note:</strong> Jaise hi koi contact apni last message limit par pahuchega, bot final reply bhejne ke theek 1.5s baad yeh closing message bhej kar shant ho jayega.
          </p>
        </div>

        {/* Save Button & Feedback */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            id="save-settings-btn"
            type="submit"
            className="btn-primary"
            disabled={updating}
          >
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>Saved to MongoDB!</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{updating ? 'Saving...' : 'Save Settings'}</span>
              </>
            )}
          </button>
          {savedSuccess && (
            <span style={{ fontSize: '0.82rem', color: '#4ade80' }}>
              Database updated in real-time.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
