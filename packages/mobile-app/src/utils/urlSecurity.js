/**
 * Three-Layer URL Security & Anti-Phishing Validation
 *
 * Layer 1: Domain Allowlist (pre-connection)
 * Layer 2: App Identity Handshake (post-connection)
 * Layer 3: Navigation Guard (runtime WebView requests)
 */

const NWM_APP_ID = 'net-worth-manager';

const FIREBASE_HOST_RE = /^[a-z0-9-]+\.(web\.app|firebaseapp\.com)$/i;
const APPS_SCRIPT_PATH_RE = /^\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/;
const GOOGLEUSERCONTENT_HOST_RE = /^[a-z0-9-]+\.googleusercontent\.com$/i;
const IPV4_LITERAL_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Extracts a target HTTPS URL from either a raw URL or an `nwm://connect?url=...` QR/deep-link URI.
 */
function parseConnectionInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  if (/^nwm:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname === 'connect' || parsed.pathname === '//connect' || parsed.pathname === '/connect') {
        const targetUrl = parsed.searchParams.get('url');
        return targetUrl ? targetUrl.trim() : '';
      }
    } catch {
      return '';
    }
    return '';
  }

  return trimmed;
}

/**
 * Layer 1: Validates that the user-supplied instance URL uses HTTPS and belongs to
 * an allowed Google-controlled hosting domain (unless custom domain override is explicitly enabled).
 */
function validateAppUrl(rawInput, options = {}) {
  const { allowCustomDomain = false } = options;
  const extracted = parseConnectionInput(rawInput);

  if (!extracted) {
    return { valid: false, reason: 'EMPTY_URL', message: 'Please enter your Net Worth Manager URL.' };
  }

  let parsed;
  try {
    parsed = new URL(extracted);
  } catch {
    return { valid: false, reason: 'INVALID_URL', message: 'Please enter a valid URL starting with https://.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'HTTPS_REQUIRED', message: 'Only secure HTTPS URLs are allowed.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'CREDENTIALS_IN_URL', message: 'URLs cannot contain embedded credentials.' };
  }

  const host = parsed.hostname.toLowerCase();

  if (FIREBASE_HOST_RE.test(host)) {
    return {
      valid: true,
      url: parsed.toString(),
      origin: parsed.origin,
      provider: 'firebase',
      isCustomDomain: false,
    };
  }

  if (host === 'script.google.com' && APPS_SCRIPT_PATH_RE.test(parsed.pathname)) {
    return {
      valid: true,
      url: parsed.toString(),
      origin: parsed.origin,
      provider: 'apps-script',
      isCustomDomain: false,
    };
  }

  if (allowCustomDomain) {
    const isLocalOrIp =
      host === 'localhost' ||
      host.endsWith('.local') ||
      IPV4_LITERAL_RE.test(host) ||
      host.includes(':') ||
      !host.includes('.');
    if (isLocalOrIp) {
      return {
        valid: false,
        reason: 'INVALID_CUSTOM_DOMAIN',
        message: 'Custom domains must be a valid public HTTPS hostname.',
      };
    }
    return {
      valid: true,
      url: parsed.toString(),
      origin: parsed.origin,
      provider: 'custom',
      isCustomDomain: true,
    };
  }

  return {
    valid: false,
    reason: 'DOMAIN_NOT_ALLOWED',
    message:
      'URL not allowed. Only Firebase Hosting (*.web.app / *.firebaseapp.com) or Google Apps Script (script.google.com/macros/s/.../exec) URLs are accepted.',
  };
}

/**
 * Computes the expected Layer 2 identity signature bound to an origin.
 */
function computeIdentitySignature(origin) {
  const safeOrigin = String(origin || '');
  const payload = `${NWM_APP_ID}:${safeOrigin}`;
  const encoded =
    typeof btoa === 'function'
      ? btoa(payload)
      : Buffer.from(payload, 'utf8').toString('base64');
  return `NWM-${encoded}`;
}

/**
 * Layer 2: Verifies that a post-load identity payload genuinely identifies Net Worth Manager
 * and matches the configured URL origin or Google Apps Script sandbox origin.
 */
function verifyIdentityPayload(payload, configuredUrl) {
  if (!payload || typeof payload !== 'object') {
    return { verified: false, reason: 'MISSING_PAYLOAD' };
  }

  if (payload.app !== NWM_APP_ID || !payload.version || !payload.signature || !payload.origin) {
    return { verified: false, reason: 'INVALID_FIELDS' };
  }

  const expectedSig = computeIdentitySignature(payload.origin);
  if (payload.signature !== expectedSig) {
    return { verified: false, reason: 'SIGNATURE_MISMATCH' };
  }

  let configuredOrigin = '';
  try {
    configuredOrigin = new URL(configuredUrl).origin;
  } catch {
    return { verified: false, reason: 'INVALID_CONFIGURED_URL' };
  }

  if (payload.origin === configuredOrigin) {
    return { verified: true, reason: 'ORIGIN_MATCH', version: payload.version };
  }

  try {
    const payloadParsed = new URL(payload.origin);
    if (
      payloadParsed.protocol === 'https:' &&
      GOOGLEUSERCONTENT_HOST_RE.test(payloadParsed.hostname) &&
      payload.isAppsScript === true
    ) {
      return { verified: true, reason: 'APPS_SCRIPT_SANDBOX_MATCH', version: payload.version };
    }
  } catch {
    return { verified: false, reason: 'INVALID_PAYLOAD_ORIGIN' };
  }

  return { verified: false, reason: 'ORIGIN_MISMATCH' };
}

/**
 * Layer 3: Guard every WebView navigation request to prevent redirect phishing or XSS exits.
 */
function isNavigationAllowed(requestUrl, configuredUrl) {
  if (!requestUrl || typeof requestUrl !== 'string') return false;

  if (requestUrl === 'about:blank' || requestUrl.startsWith('blob:')) {
    return true;
  }

  let parsedReq;
  let parsedCfg;
  try {
    parsedReq = new URL(requestUrl);
    parsedCfg = new URL(configuredUrl);
  } catch {
    return false;
  }

  if (parsedReq.protocol !== 'https:') {
    return false;
  }

  if (parsedReq.origin === parsedCfg.origin) {
    return true;
  }

  const host = parsedReq.hostname.toLowerCase();
  if (
    host === 'accounts.google.com' ||
    host === 'script.google.com' ||
    GOOGLEUSERCONTENT_HOST_RE.test(host)
  ) {
    return true;
  }

  return false;
}

module.exports = {
  NWM_APP_ID,
  parseConnectionInput,
  validateAppUrl,
  computeIdentitySignature,
  verifyIdentityPayload,
  isNavigationAllowed,
};
