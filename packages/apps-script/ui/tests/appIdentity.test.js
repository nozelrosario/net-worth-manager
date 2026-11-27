import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NWM_APP_ID,
  NWM_APP_VERSION,
  computeIdentitySignature,
  registerAppIdentity,
} from '../src/utils/appIdentity.js';

describe('Distribution: App Identity Registration', () => {
  it('computes deterministic NWM-prefixed base64 origin signature', () => {
    const sig = computeIdentitySignature('https://demo-app.web.app');
    assert.ok(sig.startsWith('NWM-'));
    const decoded = Buffer.from(sig.slice(4), 'base64').toString('utf8');
    assert.equal(decoded, `${NWM_APP_ID}:https://demo-app.web.app`);
  });

  it('registers window.__NWM_IDENTITY__ and posts verification message to parent and WebView', () => {
    const postedParent = [];
    const postedWebView = [];

    const mockWin = {
      location: { origin: 'https://my-finance.web.app' },
      google: { script: { run: {} } },
      parent: {
        postMessage: (msg, target) => postedParent.push({ msg, target }),
      },
      ReactNativeWebView: {
        postMessage: (msg) => postedWebView.push(msg),
      },
    };
    mockWin.parent.self = undefined; // ensure parent !== mockWin

    const identity = registerAppIdentity(mockWin);
    assert.equal(identity.app, NWM_APP_ID);
    assert.equal(identity.version, NWM_APP_VERSION);
    assert.equal(identity.origin, 'https://my-finance.web.app');
    assert.equal(identity.isAppsScript, true);
    assert.deepEqual(mockWin.__NWM_IDENTITY__, identity);

    assert.equal(postedParent.length, 1);
    assert.equal(postedWebView.length, 1);
    const parsed = JSON.parse(postedWebView[0]);
    assert.equal(parsed.type, 'NWM_IDENTITY_VERIFIED');
    assert.equal(parsed.signature, identity.signature);
  });
});
