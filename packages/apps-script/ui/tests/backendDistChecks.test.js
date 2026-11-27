import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

describe('Distribution Readiness: Source Hygiene & Backend Checks', () => {
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
