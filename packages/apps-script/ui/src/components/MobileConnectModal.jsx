import React, { useState, useEffect, useMemo } from 'react';
import { QrCode, X, Smartphone, Copy, CheckCircle2, Globe, ExternalLink, AlertCircle, RotateCcw } from 'lucide-react';
import QRCode from 'qrcode';
import useModalBack from '../hooks/useModalBack';
import { getSafeStorage, setSafeStorage } from '../utils/storage';
import { isAppShell } from '../utils/securityUtils';

const CUSTOM_PORTAL_URL_KEY = 'nwm_custom_portal_url';

function isValidPairingUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function MobileConnectModal({
  isOpen,
  onClose,
  appUrl = '',
  portalUrl = '',
  showMessage
}) {
  useModalBack(isOpen, onClose);

  const defaultUrl = useMemo(() => {
    const saved = getSafeStorage(CUSTOM_PORTAL_URL_KEY, '');
    if (isValidPairingUrl(saved)) return saved;
    if (isValidPairingUrl(portalUrl)) return portalUrl;
    if (isValidPairingUrl(appUrl)) return appUrl;
    return '';
  }, [appUrl, portalUrl]);

  const [urlInput, setUrlInput] = useState(defaultUrl);
  const [qrSvg, setQrSvg] = useState('');
  const [qrError, setQrError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(defaultUrl);
      setCopied(false);
    }
  }, [isOpen, defaultUrl]);

  const trimmedUrl = (urlInput || '').trim();
  const isUrlValid = isValidPairingUrl(trimmedUrl);
  const deepLinkPayload = isUrlValid
    ? `nwm://connect?url=${encodeURIComponent(trimmedUrl)}`
    : '';

  useEffect(() => {
    if (!isOpen || !deepLinkPayload) {
      setQrSvg('');
      setQrError('');
      return;
    }

    let cancelled = false;
    QRCode.toString(deepLinkPayload, {
      type: 'svg',
      margin: 2,
      width: 220,
      color: {
        dark: '#0B0F17',
        light: '#FFFFFF'
      }
    })
      .then((svg) => {
        if (!cancelled) {
          setQrSvg(svg);
          setQrError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQrSvg('');
          setQrError(err?.message || 'Unable to generate QR code');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, deepLinkPayload]);

  if (!isOpen) return null;

  const handleSaveCustomUrl = (val) => {
    setUrlInput(val);
    const clean = val.trim();
    if (isValidPairingUrl(clean)) {
      setSafeStorage(CUSTOM_PORTAL_URL_KEY, clean);
    }
  };

  const handleCopyUrl = () => {
    if (!isUrlValid) return;
    navigator.clipboard?.writeText(trimmedUrl).then(() => {
      setCopied(true);
      showMessage?.('App URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleDisconnectMobileShell = () => {
    if (!window.confirm('Reset the configured instance URL in the mobile app? You will be returned to the setup screen.')) {
      return;
    }
    const payload = JSON.stringify({ type: 'NWM_RESET_INSTANCE_URL' });
    try {
      window.ReactNativeWebView?.postMessage(payload);
    } catch (e) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface-layer1 border border-border-subtle p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-wealth-emerald/15 border border-wealth-emerald/25 flex items-center justify-center text-wealth-emerald shrink-0">
              <QrCode size={16} />
            </div>
            <div>
              <h3 className="text-typ-body-sm font-bold text-text-primary">Connect Mobile App</h3>
              <p className="text-[11px] text-text-muted">Pair the Universal Android APK via QR or URL</p>
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

        {/* Preset Quick Select */}
        {(isValidPairingUrl(portalUrl) || isValidPairingUrl(appUrl)) && (
          <div className="flex flex-wrap gap-2">
            {isValidPairingUrl(portalUrl) && (
              <button
                type="button"
                onClick={() => handleSaveCustomUrl(portalUrl)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  trimmedUrl === portalUrl
                    ? 'bg-wealth-emerald/15 border-wealth-emerald/40 text-wealth-emerald'
                    : 'bg-surface-layer2 border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                Use Firebase Portal URL
              </button>
            )}
            {isValidPairingUrl(appUrl) && (
              <button
                type="button"
                onClick={() => handleSaveCustomUrl(appUrl)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  trimmedUrl === appUrl
                    ? 'bg-primary-accent/15 border-primary-accent/40 text-primary-accent'
                    : 'bg-surface-layer2 border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                Use Apps Script URL
              </button>
            )}
          </div>
        )}

        {/* URL Input */}
        <div>
          <label className="block text-[11px] font-semibold text-text-secondary mb-1.5">
            Instance URL (HTTPS)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => handleSaveCustomUrl(e.target.value)}
              placeholder="https://your-app.web.app or https://script.google.com/macros/s/.../exec"
              className="flex-1 bg-surface-layer2 border border-border-subtle focus:border-primary-accent/70 rounded-xl text-xs font-mono text-text-primary px-3 py-2 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              disabled={!isUrlValid}
              className="px-3 py-2 rounded-xl bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-primary text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
              title="Copy URL"
            >
              {copied ? <CheckCircle2 size={14} className="text-wealth-emerald" /> : <Copy size={14} />}
            </button>
          </div>
          {trimmedUrl && !isUrlValid && (
            <p className="text-[11px] text-liability-rose mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> Enter a valid HTTPS URL.
            </p>
          )}
        </div>

        {/* QR Code Preview */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-layer2/70 border border-border-subtle">
          {qrSvg ? (
            <div
              className="bg-white p-3 rounded-xl shadow-md"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="w-[220px] h-[220px] rounded-xl bg-surface-layer1 border border-dashed border-border-prominent flex flex-col items-center justify-center text-center p-4">
              <QrCode size={32} className="text-text-muted mb-2" />
              <p className="text-xs text-text-muted">
                {qrError || 'Enter your Firebase or Apps Script HTTPS URL above to generate a pairing QR code.'}
              </p>
            </div>
          )}
          <p className="text-[11px] text-text-muted text-center mt-3 leading-relaxed">
            Open the <strong>Net Worth Manager</strong> Android app and tap <strong>Scan QR Code</strong> on the setup screen.
          </p>
        </div>

        {/* PWA Hint & Disconnect */}
        <div className="space-y-2 pt-2 border-t border-border-subtle">
          <div className="flex items-start gap-2 text-[11px] text-text-muted">
            <Globe size={14} className="text-primary-accent shrink-0 mt-0.5" />
            <span>
              Prefer no APK? Open your deployment URL in Chrome/Safari and choose <strong>Add to Home Screen</strong>.
            </span>
          </div>

          {isAppShell() && (
            <button
              type="button"
              onClick={handleDisconnectMobileShell}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-liability-rose/10 hover:bg-liability-rose/20 border border-liability-rose/30 text-liability-rose text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Change Instance URL in Mobile App</span>
            </button>
          )}

          <a
            href="https://github.com/nozelrosario/net-worth-manager-releases/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 rounded-xl bg-surface-layer2 hover:bg-surface-layer3 border border-border-subtle text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Smartphone size={13} className="text-wealth-emerald" />
            <span>Download Universal Android APK</span>
            <ExternalLink size={11} className="text-text-muted" />
          </a>
        </div>
      </div>
    </div>
  );
}
