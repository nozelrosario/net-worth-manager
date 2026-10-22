/**
 * Security Cryptography & Session Protection Utilities
 * Net Worth Manager - Container-Aware Dual-Tier Security Architecture
 */

// Helper to check if running in mobile app shell
export const isAppShell = () => {
  if (typeof window === 'undefined') return false;
  // React Native WebView injects window.ReactNativeWebView
  if (window.ReactNativeWebView !== undefined) return true;
  // User agent detection for NetWorthManagerApp
  const ua = window.navigator?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (ua && /NetWorthManagerApp/i.test(ua)) return true;
  // Query param bypass for simulator/preview testing
  if (window.location?.search && /[?&]app_shell=1/i.test(window.location.search)) return true;
  return false;
};

const PIN_STORAGE_KEY = 'nwm_security_pin_config';
const REMEMBER_ME_KEY = 'nwm_remember_me';
const BROWSER_IDLE_TIMEOUT_KEY = 'nwm_browser_idle_timeout';

// Generate cryptographic random salt
export const generateSalt = () => {
  if (window.crypto && window.crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    window.crypto.getRandomValues(buffer);
    return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback pseudorandom generator if crypto unavailable
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Cryptographic Salted SHA-256 Hashing: Hash = SHA-256(DeviceSalt || PIN)
export const hashPin = async (pin, salt) => {
  const normalizedPin = String(pin).trim();
  const normalizedSalt = String(salt || '');
  const data = new TextEncoder().encode(normalizedSalt + normalizedPin);

  if (window.crypto?.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Pure JS fallback in case Web Crypto is missing in legacy context
  let hash = 0;
  const str = normalizedSalt + normalizedPin;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
};

// Retrieve PIN configuration
export const getPinConfig = () => {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse PIN configuration:', e);
    return null;
  }
};

// Save PIN configuration
export const savePinConfig = async (pin, autoLockTimeout = 0) => {
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  const config = {
    isEnabled: true,
    salt,
    hash,
    autoLockTimeout: Number(autoLockTimeout) || 0,
    failedAttempts: 0,
    lockoutUntil: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(config));
    return config;
  } catch (e) {
    console.error('Failed to save PIN configuration:', e);
    return null;
  }
};

// Update PIN configuration fields
export const updatePinConfig = (updates) => {
  try {
    const existing = getPinConfig() || {};
    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to update PIN config:', e);
    return null;
  }
};

// Completely clear PIN config (e.g. on OTP reset or forgot PIN)
export const clearPinConfig = () => {
  try {
    localStorage.removeItem(PIN_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear PIN config:', e);
  }
};

// Check if PIN is configured and enabled
export const isPinConfigured = () => {
  const config = getPinConfig();
  return Boolean(config && config.isEnabled && config.hash && config.salt);
};

// Get remaining lockout time in seconds (0 if not locked out)
export const getRemainingLockoutTime = () => {
  const config = getPinConfig();
  if (!config || !config.lockoutUntil) return 0;
  const now = Date.now();
  if (config.lockoutUntil > now) {
    return Math.ceil((config.lockoutUntil - now) / 1000);
  }
  return 0;
};

// Verify user-entered PIN with attempt tracking and 30s lockout
export const verifyPin = async (pin) => {
  const config = getPinConfig();
  if (!config || !config.isEnabled) {
    return { success: true, reason: 'PIN_NOT_CONFIGURED' };
  }

  const now = Date.now();
  // Check if locked out
  if (config.lockoutUntil && config.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((config.lockoutUntil - now) / 1000);
    return {
      success: false,
      lockedOut: true,
      remainingSeconds,
      reason: 'LOCKOUT_ACTIVE'
    };
  }

  const computedHash = await hashPin(pin, config.salt);
  if (computedHash === config.hash) {
    // Reset failed attempts on success
    updatePinConfig({ failedAttempts: 0, lockoutUntil: 0 });
    return { success: true };
  } else {
    const failedAttempts = (config.failedAttempts || 0) + 1;
    let lockoutUntil = 0;
    let lockedOut = false;
    let remainingSeconds = 0;

    if (failedAttempts >= 5) {
      // 30-second progressive lockout
      remainingSeconds = 30;
      lockoutUntil = now + 30000;
      lockedOut = true;
    }

    updatePinConfig({ failedAttempts, lockoutUntil });
    return {
      success: false,
      lockedOut,
      remainingSeconds,
      attemptsLeft: Math.max(0, 5 - failedAttempts),
      reason: lockedOut ? 'MAX_ATTEMPTS_REACHED' : 'INVALID_PIN'
    };
  }
};

// Remember Me preference for desktop/web browser
export const getRememberMePreference = () => {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  } catch (e) {
    return false;
  }
};

export const setRememberMePreference = (enabled) => {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Failed to save remember me preference:', e);
  }
};

// Browser Inactivity Idle Timeout (in minutes, default 15)
export const getBrowserIdleTimeoutMinutes = () => {
  try {
    const val = localStorage.getItem(BROWSER_IDLE_TIMEOUT_KEY);
    return val ? parseInt(val, 10) : 15;
  } catch (e) {
    return 15;
  }
};

export const setBrowserIdleTimeoutMinutes = (minutes) => {
  try {
    localStorage.setItem(BROWSER_IDLE_TIMEOUT_KEY, String(minutes));
  } catch (e) {
    console.error('Failed to set browser idle timeout:', e);
  }
};

// Consolidated Security Settings
export const getSecuritySettings = () => {
  const pinConfig = getPinConfig();
  return {
    isAppShell: isAppShell(),
    isPinEnabled: Boolean(pinConfig?.isEnabled),
    autoLockTimeout: pinConfig?.autoLockTimeout ?? 0,
    hasPinSet: Boolean(pinConfig?.hash),
    rememberMe: getRememberMePreference(),
    idleLockoutMinutes: getBrowserIdleTimeoutMinutes()
  };
};
