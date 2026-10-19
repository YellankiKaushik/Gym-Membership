import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createBackend, ownerId, password } from '../helpers/apps-script.mjs';

const endpoint = 'https://script.google.com/macros/s/SYNTHETIC_SECURITY_BROWSER/exec';
const previous = { endpoint: process.env.VITE_APPS_SCRIPT_URL, lookup: process.env.VITE_MEMBER_LOOKUP_MODE };
let browser, server;
before(async () => {
  process.env.VITE_APPS_SCRIPT_URL = endpoint;
  process.env.VITE_MEMBER_LOOKUP_MODE = 'capability';
  server = await createServer({ server: { host: '127.0.0.1', port: 4192, strictPort: true }, logLevel: 'error' });
  await server.listen(); browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close(); await server?.close();
  for (const [key, value] of [['VITE_APPS_SCRIPT_URL', previous.endpoint], ['VITE_MEMBER_LOOKUP_MODE', previous.lookup]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

async function fixture() {
  const app = createBackend({ MEMBER_LOOKUP_MODE: 'capability', OWNER_STEP_UP_REQUIRED: 'true' }, { now: Date.now() });
  app.rows[1][1] = 'STAGING ONLY Protected Member';
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request();
    if (request.url().startsWith(endpoint)) {
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      requests.push({ url: request.url(), action: body?.action || 'lookup' });
      const result = body ? app.post(body) : app.get(Object.fromEntries(new URL(request.url()).searchParams));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) });
    } else if (request.url().startsWith('http://127.0.0.1:4192/')) await route.continue();
    else await route.abort();
  });
  await page.goto('http://127.0.0.1:4192');
  return { app, page, context, requests, errors };
}

test('capability UI rejects numeric enumeration before any backend call', async () => {
  const f = await fixture();
  try {
    await f.page.getByLabel('Membership access code', { exact: true }).fill('1');
    await f.page.getByRole('button', { name: 'Check Membership', exact: true }).click();
    await f.page.getByText('Enter the private access code provided by your gym.', { exact: true }).waitFor();
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test('member capability travels only in POST body, reveals no contact fields and can be revoked', async () => {
  const f = await fixture();
  try {
    const sessionToken = f.app.login().sessionToken;
    const stepUpToken = f.app.post({ action: 'reauthenticate', sessionToken, purpose: 'issueMemberLookup', memberId: '1', password }).stepUpToken;
    const { lookupToken } = f.app.post({ action: 'issueMemberLookup', memberId: '1', sessionToken, stepUpToken });
    await f.page.getByLabel('Membership access code', { exact: true }).fill(lookupToken);
    await f.page.getByRole('button', { name: 'Check Membership', exact: true }).click();
    await f.page.getByRole('region', { name: 'Membership result' }).waitFor();
    assert.ok(f.requests.some(r => r.action === 'lookupMember'));
    assert.ok(f.requests.every(r => !r.url.includes(lookupToken)));
    assert.ok(!(await f.page.locator('body').innerText()).includes('STAGING ONLY Protected Member'));
    f.app.context.revokeLookupForMember_('1');
    await f.page.getByRole('button', { name: 'Check Membership', exact: true }).click();
    await f.page.getByText('Could not load your membership. Please try again or contact the gym.', { exact: true }).waitFor();
    assert.equal(await f.page.getByRole('region', { name: 'Membership result' }).count(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test('delete confirmation reauthenticates on the server and clears the confirmation field', async () => {
  const f = await fixture();
  try {
    await f.page.getByRole('button', { name: 'Owner Dashboard', exact: true }).click();
    await f.page.getByLabel('Owner ID', { exact: true }).fill(ownerId);
    await f.page.getByLabel('Password', { exact: true }).fill(password);
    await f.page.getByRole('button', { name: 'Login', exact: true }).click();
    await f.page.getByRole('button', { name: 'Delete STAGING ONLY Protected Member', exact: true }).click();
    await f.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await f.page.getByText('Invalid credentials.', { exact: true }).waitFor();
    assert.equal(f.app.rows.length, 2);
    await f.page.getByLabel('Confirm your password', { exact: true }).fill(password);
    await f.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Your community starts here', exact: true }).waitFor();
    assert.equal(f.app.rows.length, 1);
    assert.equal(await f.page.getByLabel('Confirm your password', { exact: true }).count(), 0);
    assert.ok(f.requests.some(r => r.action === 'reauthenticate'));
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
