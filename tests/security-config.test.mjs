import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deploymentConfig } from '../scripts/deployment-config.mjs';
import { deploymentFingerprint } from '../scripts/deployment-fingerprint.mjs';
import { publicImageUrl, publicHttpsUrl } from '../src/utils/publicUrls.ts';

const production = 'https://script.google.com/macros/s/SYNTHETIC_PRODUCTION_REFERENCE/exec';
const staging = 'https://script.google.com/macros/s/SYNTHETIC_STAGING_ONLY/exec';
const preview = { VERCEL_ENV: 'preview', FITZONE_PREVIEW_APPS_SCRIPT_URL: staging, FITZONE_PREVIEW_SYNTHETIC: '1',
  FITZONE_PRODUCTION_ENDPOINT_SHA256: createHash('sha256').update(production).digest('hex') };

test('fingerprint helper emits only deterministic hashes and rejects malformed private input', () => {
  assert.equal(deploymentFingerprint(production), preview.FITZONE_PRODUCTION_ENDPOINT_SHA256);
  assert.throws(() => deploymentFingerprint(production + '\n'));
  assert.throws(() => deploymentFingerprint('not-a-key', true));
});

test('public branding rejects executable, insecure and credential-bearing URL schemes', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,example', 'http://example.invalid/photo.jpg', '//other.example.invalid/a', '/\\other.example.invalid/a', 'https://user:secret@example.invalid/photo.jpg']) {
    assert.equal(publicImageUrl(value), '');
  }
  assert.equal(publicImageUrl('/gym/photo.jpg'), '/gym/photo.jpg');
  assert.equal(publicImageUrl('https://example.invalid/photo.jpg'), 'https://example.invalid/photo.jpg');
  assert.equal(publicHttpsUrl('javascript:alert(1)'), '');
});

test('preview cannot inherit production configuration and fails without isolation attestation', () => {
  for (const deployment of [{ VERCEL_ENV: 'preview' }, { ...preview, FITZONE_PREVIEW_SYNTHETIC: '' },
    { ...preview, FITZONE_PRODUCTION_ENDPOINT_SHA256: '' }, { ...preview, FITZONE_PREVIEW_APPS_SCRIPT_URL: production }]) {
    assert.throws(() => deploymentConfig({ VITE_APPS_SCRIPT_URL: production }, deployment), /Preview blocked/);
  }
  assert.equal(deploymentConfig({ VITE_APPS_SCRIPT_URL: production }, preview).apiUrl, staging);
  assert.equal(deploymentConfig({ VITE_APPS_SCRIPT_URL: production }, { VERCEL_ENV: 'production' }).apiUrl, production);
});

test('deployment errors never echo private endpoint values; malformed URLs rejected', () => {
  for (const value of [production + '?secret=SYNTHETIC', production.replace('/exec', '/dev'), production + ' ', 'javascript:alert(1)']) {
    assert.throws(() => deploymentConfig({ VITE_APPS_SCRIPT_URL: value }, {}), error => !error.message.includes(value));
  }
  assert.throws(() => deploymentConfig({}, { VERCEL_ENV: 'production' }));
});

test('hosting denies framing independently of broader report-only content policy', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const headers = Object.fromEntries(config.headers.find(rule => rule.source === '/(.*)').headers.map(h => [h.key, h.value]));
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  for (const policy of [headers['Content-Security-Policy'], headers['Content-Security-Policy-Report-Only']]) {
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|\*/);
  }
  assert.match(headers['Content-Security-Policy-Report-Only'], /https:\/\/script\.google\.com https:\/\/script\.googleusercontent\.com/);
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
});

test('workflows keep actions pinned and credentials scoped; no implicit deployment or unsafe PR target', () => {
  for (const file of ['authentication-checks', 'security']) {
    const workflow = readFileSync(`.github/workflows/${file}.yml`, 'utf8');
    for (const [, sha] of workflow.matchAll(/uses:\s+[^\s]+@([^\s]+)/g)) assert.match(sha, /^[a-f0-9]{40}$/);
    assert.match(workflow, /persist-credentials: false/);
    assert.doesNotMatch(workflow, /pull_request_target|vercel deploy|vercel --prod/);
  }
  assert.match(readFileSync('.github/workflows/security.yml', 'utf8'), /npm audit --omit=dev --audit-level=low/);
  assert.match(readFileSync('.github/dependabot.yml', 'utf8'), /package-ecosystem: github-actions/);
});
