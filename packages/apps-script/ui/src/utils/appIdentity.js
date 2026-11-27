/**
 * App Identity Registration & Signature Helpers
 * Used by the Universal Mobile App (Layer 2 anti-phishing verification)
 * to confirm a loaded instance is genuinely Net Worth Manager.
 */

export const NWM_APP_ID = 'net-worth-manager';
export const NWM_APP_VERSION = '4.2.0';

/**
 * Computes a deterministic identity signature bound to the active origin.
 * Works across browser (`btoa`) and Node.js (`Buffer`) test environments.
 */
export function computeIdentitySignature(origin) {
  const safeOrigin = String(origin || '');
  const payload = `${NWM_APP_ID}:${safeOrigin}`;
  const encoded = typeof btoa === 'function'
    ? btoa(payload)
    : Buffer.from(payload, 'utf8').toString('base64');
  return `NWM-${encoded}`;
}

/**
 * Registers `window.__NWM_IDENTITY__` and notifies parent frames / ReactNativeWebView.
 */
export function registerAppIdentity(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return null;

  const origin = win.location?.origin || '';
  const identity = {
    app: NWM_APP_ID,
    version: NWM_APP_VERSION,
    origin,
    signature: computeIdentitySignature(origin),
    isAppsScript: Boolean(win.google?.script?.run)
  };

  win.__NWM_IDENTITY__ = identity;

  const message = JSON.stringify({
    type: 'NWM_IDENTITY_VERIFIED',
    ...identity
  });

  try {
    if (win.parent && win.parent !== win && typeof win.parent.postMessage === 'function') {
      win.parent.postMessage(message, '*');
    }
  } catch (e) {}

  try {
    if (win.ReactNativeWebView && typeof win.ReactNativeWebView.postMessage === 'function') {
      win.ReactNativeWebView.postMessage(message);
    }
  } catch (e) {}

  return identity;
}
