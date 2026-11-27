const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  NWM_APP_ID,
  parseConnectionInput,
  validateAppUrl,
  computeIdentitySignature,
  verifyIdentityPayload,
  isNavigationAllowed,
} = require('../src/utils/urlSecurity.js');

describe('Mobile App Three-Layer URL Security', () => {
  describe('QR / Deep Link Parsing', () => {
    it('extracts HTTPS URL from nwm://connect deep link', () => {
      const target = 'https://my-networth.web.app/';
      const deepLink = `nwm://connect?url=${encodeURIComponent(target)}`;
      assert.equal(parseConnectionInput(deepLink), target);
    });

    it('passes through raw HTTPS URLs trimmed', () => {
      assert.equal(parseConnectionInput('  https://demo.web.app  '), 'https://demo.web.app');
    });

    it('returns empty string for invalid nwm:// routes', () => {
      assert.equal(parseConnectionInput('nwm://other?url=https://demo.web.app'), '');
    });
  });

  describe('Layer 1: Domain Allowlist', () => {
    it('accepts Firebase web.app and firebaseapp.com URLs', () => {
      const r1 = validateAppUrl('https://my-finance-123.web.app/');
      assert.equal(r1.valid, true);
      assert.equal(r1.provider, 'firebase');

      const r2 = validateAppUrl('https://my-finance-123.firebaseapp.com/?env=uat');
      assert.equal(r2.valid, true);
      assert.equal(r2.provider, 'firebase');
    });

    it('accepts Google Apps Script /macros/s/<id>/exec URLs', () => {
      const r = validateAppUrl('https://script.google.com/macros/s/AKfycb123_abc-XYZ/exec');
      assert.equal(r.valid, true);
      assert.equal(r.provider, 'apps-script');
    });

    it('rejects arbitrary phishing domains, HTTP URLs, credentials, and non-exec Apps Script paths', () => {
      assert.equal(validateAppUrl('http://my-app.web.app').valid, false);
      assert.equal(validateAppUrl('https://net-worth-phishing.com').valid, false);
      assert.equal(validateAppUrl('https://web.app.evil.com').valid, false);
      assert.equal(validateAppUrl('https://user:pass@my-app.web.app').valid, false);
      assert.equal(validateAppUrl('https://script.google.com/home').valid, false);
    });

    it('supports custom domain only when explicitly opted in and blocks local/IP targets', () => {
      assert.equal(validateAppUrl('https://finance.example.com').valid, false);

      const customOk = validateAppUrl('https://finance.example.com', { allowCustomDomain: true });
      assert.equal(customOk.valid, true);
      assert.equal(customOk.isCustomDomain, true);

      assert.equal(validateAppUrl('https://localhost:3000', { allowCustomDomain: true }).valid, false);
      assert.equal(validateAppUrl('https://127.0.0.1', { allowCustomDomain: true }).valid, false);
    });
  });

  describe('Layer 2: App Identity Handshake', () => {
    it('verifies valid origin-matched identity payload', () => {
      const configured = 'https://my-app.web.app/';
      const origin = 'https://my-app.web.app';
      const payload = {
        app: NWM_APP_ID,
        version: '4.2.0',
        origin,
        signature: computeIdentitySignature(origin),
      };
      const res = verifyIdentityPayload(payload, configured);
      assert.equal(res.verified, true);
      assert.equal(res.reason, 'ORIGIN_MATCH');
    });

    it('verifies valid Google Apps Script sandbox googleusercontent origin', () => {
      const configured = 'https://script.google.com/macros/s/AKfycbTest123/exec';
      const sandboxOrigin = 'https://n-abc123def-0lu-script.googleusercontent.com';
      const payload = {
        app: NWM_APP_ID,
        version: '4.2.0',
        origin: sandboxOrigin,
        signature: computeIdentitySignature(sandboxOrigin),
        isAppsScript: true,
      };
      const res = verifyIdentityPayload(payload, configured);
      assert.equal(res.verified, true);
      assert.equal(res.reason, 'APPS_SCRIPT_SANDBOX_MATCH');
    });

    it('rejects forged signature or mismatched origin', () => {
      const configured = 'https://my-app.web.app/';
      assert.equal(
        verifyIdentityPayload(
          {
            app: NWM_APP_ID,
            version: '4.2.0',
            origin: 'https://my-app.web.app',
            signature: 'NWM-forged',
          },
          configured
        ).verified,
        false
      );

      assert.equal(
        verifyIdentityPayload(
          {
            app: NWM_APP_ID,
            version: '4.2.0',
            origin: 'https://evil-clone.web.app',
            signature: computeIdentitySignature('https://evil-clone.web.app'),
          },
          configured
        ).verified,
        false
      );
    });
  });

  describe('Layer 3: Navigation Guard', () => {
    const configured = 'https://my-app.web.app/';

    it('allows configured origin, Google auth, Apps Script, and googleusercontent sandbox', () => {
      assert.equal(isNavigationAllowed('https://my-app.web.app/dashboard', configured), true);
      assert.equal(isNavigationAllowed('https://accounts.google.com/signin', configured), true);
      assert.equal(isNavigationAllowed('https://script.google.com/macros/s/abc/exec', configured), true);
      assert.equal(isNavigationAllowed('https://n-abc-script.googleusercontent.com/userCodeAppPanel', configured), true);
      assert.equal(isNavigationAllowed('about:blank', configured), true);
    });

    it('blocks external domains, HTTP downgrades, and javascript URIs', () => {
      assert.equal(isNavigationAllowed('https://evil.com/phish', configured), false);
      assert.equal(isNavigationAllowed('https://accounts.google.com.evil.com/login', configured), false);
      assert.equal(isNavigationAllowed('http://my-app.web.app/', configured), false);
      assert.equal(isNavigationAllowed('javascript:alert(1)', configured), false);
    });
  });
});
