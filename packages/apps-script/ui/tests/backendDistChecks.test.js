import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

function createAppsScriptSandbox({ ownerEmail = 'owner@example.com' } = {}) {
  const propsStore = {
    SPREADSHEET_ID: 'sheet-uat-123',
    OWNER_EMAIL: ownerEmail,
    DB_INITIALIZED: 'true',
  };
  const sheetsData = {
    Team: [
      ['Member Name', 'Google Account Emails', 'Role'],
      ['Admin', ownerEmail, 'admin'],
    ],
    _Sessions: [['Session Token', 'Email', 'Created At', 'Expires At', 'Last Active']],
    Assets: [
      ['Asset ID', 'Type', 'Name', 'Category', 'Owner', 'Status', 'Acquisition Date', 'Cost', 'Current Value', 'Institution/Location', 'Identifiers', 'Nominee', 'Nominee %', 'Details JSON'],
      ['uat-asset-1', 'Cash/FD', 'UAT Test Savings', 'Cash/FD', 'Admin', 'Active', '2026-01-01', 100000, 100000, 'HDFC', '', '', '', '{}'],
    ],
    Transactions: [['Txn ID', 'Date', 'Type', 'Amount', 'Category', 'Account/Card', 'Merchant/Description', 'Tags', 'Is Transfer', 'Split JSON', 'Beneficiary']],
    FamilyProfiles: [['Profile ID', 'Name', 'Relation', 'Ownership %', 'Notes']],
    Events: [['Event ID', 'Date', 'Type', 'Title', 'Amount', 'Status', 'Details JSON']],
    Safe: [['Document ID', 'Name', 'Category', 'Owner', 'Description', 'Files JSON', 'Date Added']],
    Settings: [['Setting Key', 'Setting Value']],
    MarketQuotes: [['Symbol', 'Type', 'Display Name', 'Live Price', 'Day Change %', 'Last Updated', 'Source', 'Details']],
    Audit: [['Audit ID', 'Timestamp', 'Action', 'User', 'Details']],
  };

  const makeSheet = (name) => {
    const rows = sheetsData[name];
    return {
      getName: () => name,
      getLastRow: () => rows.length,
      getLastColumn: () => (rows[0] ? rows[0].length : 0),
      getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
      getRange: (r, c, nr = 1, nc = 1) => ({
        getValues: () => rows.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
        setValues: () => {},
        setValue: () => {},
        setFormula: () => {},
        setFormulas: () => {},
        setNumberFormat: () => {},
        setFontWeight: () => ({ setBackground: () => {} }),
      }),
      appendRow: (row) => rows.push([...row]),
      deleteRow: (idx) => rows.splice(idx - 1, 1),
      setFrozenRows: () => {},
      hideSheet: () => {},
    };
  };

  const mockSs = {
    getName: () => 'Net Worth Manager Database UAT',
    getId: () => 'sheet-uat-123',
    getSheetByName: (name) => (sheetsData[name] ? makeSheet(name) : null),
    insertSheet: (name) => {
      sheetsData[name] = [[]];
      return makeSheet(name);
    },
    getSheets: () => Object.keys(sheetsData).map(makeSheet),
  };

  const sandbox = {
    console,
    Logger: { log: () => {} },
    Utilities: { getUuid: () => '1234-5678-90ab-cdef' },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in propsStore ? propsStore[k] : null),
        setProperty: (k, v) => { propsStore[k] = String(v); },
        deleteProperty: (k) => { delete propsStore[k]; },
      }),
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => '' }),
      getEffectiveUser: () => ({ getEmail: () => ownerEmail }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => null,
      openById: (id) => (id === 'sheet-uat-123' ? mockSs : null),
      create: () => mockSs,
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/AKfycbTest/exec' }),
    },
    MailApp: { sendEmail: () => {}, getRemainingDailyQuota: () => 50 },
    GmailApp: { sendEmail: () => {} },
    DriveApp: { getRootFolder: () => ({ getName: () => 'My Drive' }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) },
  };

  const codeGs = fs.readFileSync(path.join(repoRoot, 'packages/apps-script/Code.gs'), 'utf8');
  vm.runInNewContext(codeGs, sandbox, { filename: 'Code.gs' });
  return { sandbox, propsStore };
}

describe('Distribution Readiness: Source Hygiene & Backend Checks', () => {
  it('Code.gs OTP verification and dashboard loading execute without ReferenceError and authenticate owner', () => {
    const { sandbox, propsStore } = createAppsScriptSandbox({ ownerEmail: 'owner@example.com' });
    propsStore['OTP_owner@example.com'] = JSON.stringify({ code: '123456', expires: Date.now() + 60000 });

    const verifyRes = sandbox.verifyEmailCode('owner@example.com', '123456');
    assert.equal(verifyRes.status, 'success', verifyRes.message);
    assert.equal(verifyRes.isOwner, true);
    assert.equal(verifyRes.isAdmin, true);
    assert.ok(verifyRes.sessionToken.startsWith('vfm_sess_'));

    const dashRes = sandbox.getDashboardData(verifyRes.sessionToken);
    assert.equal(dashRes.status, 'success', dashRes.message);
    assert.equal(dashRes.userInfo.isAuthorized, true);
    assert.equal(dashRes.userInfo.userRole, 'admin');
    assert.equal(dashRes.assets.length, 1);
    assert.equal(dashRes.assets[0].Name, 'UAT Test Savings');
  });
  it('Code.gs contains no hardcoded personal email and exposes distribution helpers', () => {
    const codeGs = fs.readFileSync(path.join(repoRoot, 'packages/apps-script/Code.gs'), 'utf8');
    assert.equal(codeGs.includes('nozelrosario@gmail.com'), false, 'Personal email must not be hardcoded in Code.gs');
    assert.equal(codeGs.includes('Villa Owner'), false, 'Legacy domain text should be replaced');
    assert.ok(codeGs.includes('function resolveOwnerEmail('), 'resolveOwnerEmail helper missing');
    assert.ok(codeGs.includes('function doHealthCheck('), 'doHealthCheck endpoint missing');
    assert.ok(codeGs.includes('function sanitizeSheetCellValue('), 'sanitizeSheetCellValue helper missing');
  });

  it('web-portal/index.html has no hardcoded Apps Script URLs and registers identity & PWA', () => {
    const portalHtml = fs.readFileSync(path.join(repoRoot, 'packages/web-portal/index.html'), 'utf8');
    assert.equal(portalHtml.includes('AKfycbzGmUQhKj0d6'), false, 'PROD Apps Script URL must not be hardcoded');
    assert.equal(portalHtml.includes('AKfycbxhi-fQRH5x7'), false, 'UAT Apps Script URL must not be hardcoded');
    assert.ok(portalHtml.includes('__NWM_IDENTITY__'), 'Identity marker missing in web-portal');
    assert.ok(portalHtml.includes('/config.js'), 'External config.js reference missing');
    assert.ok(portalHtml.includes('/manifest.json'), 'PWA manifest link missing');
    assert.ok(portalHtml.includes('YOUR_DEPLOYMENT_ID'), 'Default placeholder URL guard missing');
    assert.ok(portalHtml.includes('endpoints.url'), 'Single-URL web portal config support missing');
  });

  it('promote-to-dist workflow packages a single-user web portal bundle without UAT templates', () => {
    const promoteYml = fs.readFileSync(path.join(repoRoot, '.github/workflows/promote-to-dist.yml'), 'utf8');
    assert.ok(promoteYml.includes('dist-portal-staging'), 'Staging directory for distribution portal missing');
    assert.ok(promoteYml.includes('delete baseHosting.target'), 'Single-site firebase.json target cleanup missing');
    assert.ok(promoteYml.includes('YOUR_DEPLOYMENT_ID'), 'Clean single-URL config.example.js generation missing');
  });

  it('mobile-app/App.js and app.config.js contain no hardcoded personal URLs or EAS IDs', () => {
    const appJs = fs.readFileSync(path.join(repoRoot, 'packages/mobile-app/App.js'), 'utf8');
    const appConfig = fs.readFileSync(path.join(repoRoot, 'packages/mobile-app/app.config.js'), 'utf8');
    assert.equal(appJs.includes('net-worth-manager-aff0b'), false, 'Hardcoded Firebase PROD URL must be removed');
    assert.equal(appJs.includes('net-worth-manager-uat'), false, 'Hardcoded Firebase UAT URL must be removed');
    assert.equal(appConfig.includes('f1189fd3-3878-4806-b9ae-d358674e80d2'), false, 'Hardcoded EAS projectId must be removed');
    assert.equal(appConfig.includes('nozelrosario'), false, 'Hardcoded owner must be removed');
  });

  it('example templates exist and personal configs are gitignored', () => {
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('packages/apps-script/.clasp.json'));
    assert.ok(gitignore.includes('packages/web-portal/.firebaserc'));
    assert.ok(gitignore.includes('packages/web-portal/config.js'));
    assert.ok(fs.existsSync(path.join(repoRoot, 'packages/apps-script/.clasp.json.example')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'packages/web-portal/.firebaserc.example')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'packages/web-portal/config.example.js')));
    assert.ok(fs.existsSync(path.join(repoRoot, '.env.example')));
  });
});
