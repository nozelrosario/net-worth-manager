/**
 * Container-Aware Storage Routing Utility
 * Net Worth Manager
 *
 * Directs sensitive session tokens to sessionStorage in desktop/web browsers
 * (ephemeral tab-scope, auto-purges on tab close) and localStorage in the Mobile App Shell.
 * If "Remember Me" is activated on web browsers, localStorage is used for persistent access.
 */

import { isAppShell, getRememberMePreference } from './securityUtils.js';

let memoryStorage = {};

// Helper to determine target storage engine for a given key
const getStorageEngine = (key) => {
  if (typeof window === 'undefined') return null;

  // Sensitive auth tokens follow container-aware rules
  if (key === 'nwm_session_token') {
    if (isAppShell()) {
      return window.localStorage;
    }
    // Web browser: check remember-me preference
    if (getRememberMePreference()) {
      return window.localStorage;
    }
    // Ephemeral tab session
    return window.sessionStorage || window.localStorage;
  }

  // General app preferences (dark mode, debug mode, pin config)
  return window.localStorage;
};

export const getSafeStorage = (key, defaultValue = '') => {
  try {
    const engine = getStorageEngine(key);
    if (engine) {
      const val = engine.getItem(key);
      if (val !== null) return val;
    }

    // Fallback checks for session token across storage mechanisms
    if (key === 'nwm_session_token') {
      try {
        const sessionVal = window.sessionStorage?.getItem(key);
        if (sessionVal !== null) return sessionVal;
      } catch (e) {}
      try {
        const localVal = window.localStorage?.getItem(key);
        if (localVal !== null) return localVal;
      } catch (e) {}
    }
  } catch (e) {
    // Storage access blocked or quota exceeded
  }
  return memoryStorage[key] !== undefined ? memoryStorage[key] : defaultValue;
};

export const setSafeStorage = (key, value) => {
  memoryStorage[key] = value;
  try {
    const engine = getStorageEngine(key);
    if (engine) {
      engine.setItem(key, value);
    }

    // If saving session token in browser without remember me, purge lingering localStorage token
    if (key === 'nwm_session_token') {
      if (!isAppShell() && !getRememberMePreference()) {
        try {
          window.localStorage?.removeItem(key);
        } catch (e) {}
      }
    }
  } catch (e) {
    // Ignore
  }
};

export const removeSafeStorage = (key) => {
  delete memoryStorage[key];
  try {
    window.sessionStorage?.removeItem(key);
  } catch (e) {}
  try {
    window.localStorage?.removeItem(key);
  } catch (e) {}
};

// Check if current session storage is ephemeral (sessionStorage tab scope)
export const isSessionEphemeral = () => {
  return !isAppShell() && !getRememberMePreference();
};
