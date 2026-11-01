import React, { useState, useEffect, useMemo } from 'react';
import { Key, X, Eye, EyeOff, ExternalLink, Save, RefreshCw, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import useModalBack from '../hooks/useModalBack';
import { getSafeStorage, setSafeStorage } from '../utils/storage';
import { Badge } from './Badge';

export default function GeminiApiKeyModal({
  isOpen,
  onClose,
  settings = [],
  onRefresh,
  showMessage
}) {
  useModalBack(isOpen, onClose);

  // Single source of truth: Settings sheet 'GeminiApiKey' with fallback to localStorage
  const savedKeyFromProps = useMemo(() => {
    const s = Array.isArray(settings) ? settings.find(item => item['Setting Key'] === 'GeminiApiKey') : null;
    return s?.['Setting Value'] || getSafeStorage('nwm_gemini_api_key', '');
  }, [settings]);

  const [apiKeyInput, setApiKeyInput] = useState(savedKeyFromProps);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Sync when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(savedKeyFromProps || '');
      setFeedback(null);
      setShowKey(false);
    }
  }, [isOpen, savedKeyFromProps]);

  if (!isOpen) return null;

  const handleSaveKey = (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    const cleanKey = (apiKeyInput || '').trim();
    // Persist to local storage immediately
    setSafeStorage('nwm_gemini_api_key', cleanKey);
    const token = getSafeStorage('nwm_session_token');

    if (window.google?.script?.run?.upsertSetting && token) {
      window.google.script.run
        .withSuccessHandler((res) => {
          setIsSaving(false);
          const msg = cleanKey ? 'Gemini API Key saved and active!' : 'Gemini API Key cleared.';
          setFeedback({ text: msg, isError: false });
          showMessage?.(res?.message || msg);
          if (onRefresh) onRefresh();
          setTimeout(() => {
            onClose();
          }, 600);
        })
        .withFailureHandler((err) => {
          setIsSaving(false);
          const errText = 'Error saving key: ' + (err?.message || err);
          setFeedback({ text: errText, isError: true });
          showMessage?.(errText, true);
        })
        .upsertSetting('GeminiApiKey', cleanKey, token);
    } else {
      // Offline / Preview mode fallback
      setTimeout(() => {
        setIsSaving(false);
        const msg = cleanKey ? 'Gemini API Key saved (local preview)!' : 'Gemini API Key cleared (local preview).';
        setFeedback({ text: msg, isError: false });
        showMessage?.(msg);
        if (onRefresh) onRefresh();
        setTimeout(() => {
          onClose();
        }, 600);
      }, 400);
    }
  };

  const handleRemoveKey = () => {
    setApiKeyInput('');
    setIsSaving(true);
    setFeedback(null);

    setSafeStorage('nwm_gemini_api_key', '');
    const token = getSafeStorage('nwm_session_token');

    if (window.google?.script?.run?.upsertSetting && token) {
      window.google.script.run
        .withSuccessHandler(() => {
          setIsSaving(false);
          setFeedback({ text: 'Gemini API Key removed.', isError: false });
          showMessage?.('Gemini API Key removed.');
          if (onRefresh) onRefresh();
          setTimeout(() => {
            onClose();
          }, 600);
        })
        .withFailureHandler((err) => {
          setIsSaving(false);
          setFeedback({ text: 'Error clearing key: ' + err.message, isError: true });
        })
        .upsertSetting('GeminiApiKey', '', token);
    } else {
      setTimeout(() => {
        setIsSaving(false);
        setFeedback({ text: 'Gemini API Key removed (preview).', isError: false });
        showMessage?.('Gemini API Key removed (preview).');
        if (onRefresh) onRefresh();
        setTimeout(() => {
          onClose();
        }, 600);
      }, 400);
    }
  };

  const isConfigured = Boolean(savedKeyFromProps && savedKeyFromProps.trim());

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="w-full max-w-md rounded-2xl bg-surface-layer1 border border-border-subtle p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-wealth-emerald/15 border border-wealth-emerald/25 flex items-center justify-center text-wealth-emerald shrink-0">
              <Key size={16} />
            </div>
            <div>
              <h3 className="text-typ-body-sm font-bold text-text-primary">Google Gemini API Key</h3>
              <p className="text-[11px] text-text-muted">Single source of truth for portfolio AI</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-layer2 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-layer2/60 border border-border-subtle text-xs">
          <span className="text-text-secondary font-medium">Status</span>
          {isConfigured ? (
            <Badge variant="emerald" dot size="xs">Active &amp; Configured</Badge>
          ) : (
            <Badge variant="amber" dot size="xs">Not Configured (Offline Mode)</Badge>
          )}
        </div>

        {/* Informative Note */}
        <p className="text-xs text-text-muted leading-relaxed">
          Used across the app to power AI Portfolio Diagnostics, Smart Rebalancing, Zero-Tax Inflow Deployments, and Mutual Fund CAS Statement Parsing.
        </p>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
            feedback.isError 
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-400' 
              : 'bg-wealth-emerald/10 border-wealth-emerald/25 text-wealth-emerald'
          }`}>
            {feedback.isError ? (
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSaveKey} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary">
                API Key
              </label>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[11px] text-primary-accent hover:underline flex items-center gap-1 font-medium"
              >
                Get Free Key <ExternalLink size={11} />
              </a>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                autoFocus
                className="w-full bg-surface-layer2 border border-border-subtle focus:border-primary-accent/70 rounded-xl text-xs font-mono font-medium text-text-primary px-3 py-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-primary-accent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 rounded transition-colors"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <span className="text-[10px] text-text-muted block mt-1.5">
              Google Gemini Flash is 100% free forever (1,500 req/day). Stored in your private Google Sheet settings.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            {isConfigured ? (
              <button
                type="button"
                onClick={handleRemoveKey}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-secondary text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl bg-primary-accent hover:bg-primary-accent/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                <span>{isSaving ? 'Saving...' : 'Save Key'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
