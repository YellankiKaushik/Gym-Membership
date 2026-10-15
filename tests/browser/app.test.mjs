import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createBackend, password, ownerId } from '../helpers/apps-script.mjs';

const endpoint = 'https://script.google.com/macros/s/SYNTHETIC_BROWSER_ONLY/exec';
let browser, server, baseUrl;
const priorEndpoint = process.env.VITE_APPS_SCRIPT_URL;
before(async () => {
  process.env.VITE_APPS_SCRIPT_URL = endpoint;
  server = await createServer({ server: { host: '127.0.0.1', port: 4191, strictPort: true }, logLevel: 'error' });
  await server.listen();
  baseUrl = 'http://127.0.0.1:4191';
  browser = await chromium.launch({ headless: true });
  await mkdir('test-results/browser', { recursive: true });
});
after(async () => {
  await browser?.close(); await server?.close();
  if (priorEndpoint === undefined) delete process.env.VITE_APPS_SCRIPT_URL;
  else process.env.VITE_APPS_SCRIPT_URL = priorEndpoint;
});

async function fixture(width = 390) {
  const backend = createBackend({ MEMBER_ID_HIGH_WATER_MARK: '5' }, { now: Date.now() });
  const today = backend.context.todayDate_();
  const datePlus = days => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  backend.rows.splice(1);
  [7, 1, 0, -1, 8].forEach((days, i) => backend.rows.push([
    i === 0 ? '001' : String(i + 1), 'STAGING ONLY Member ' + (i + 1), i === 4 ? '0000000000' : '9876543210',
    25, 65, '1 Month', datePlus(-30), datePlus(days), false,
  ]));
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  // Only local frontend requests and this intercepted synthetic endpoint can run.
  await context.route('**/*', async route => {
    const request = route.request();
    if (request.url().startsWith(endpoint)) {
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      requests.push({ url: request.url(), body });
      const result = body ? backend.post(body) : backend.get(Object.fromEntries(new URL(request.url()).searchParams));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) });
    } else if (request.url().startsWith(baseUrl + '/')) await route.continue();
    else await route.abort();
  });
  await page.goto(baseUrl);
  await page.getByRole('heading', { name: 'Check your membership' }).waitFor();
  return { page, context, backend, errors, requests, today, datePlus };
}

async function login(page) {
  await page.getByRole('button', { name: 'Owner Dashboard', exact: true }).click();
  await page.getByLabel('Owner ID', { exact: true }).fill(ownerId);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('heading', { name: 'STAGING ONLY Member 1', exact: true }).waitFor();
}

async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width, JSON.stringify(dimensions));
}

async function settleMotion(page) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll('div[style]'))
    .every(element => !element.style.opacity || Number(element.style.opacity) >= 0.99));
}

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`responsive lookup, dashboard and every modal at ${width}px`, async () => {
    const f = await fixture(width);
    try {
      await noOverflow(f.page);
      await f.page.getByRole('button', { name: 'Check Status', exact: true }).click();
      await f.page.getByRole('alert').filter({ hasText: 'numeric Member ID' }).waitFor();
      await login(f.page);
      await noOverflow(f.page);
      await f.page.getByRole('button', { name: 'Expiring Soon', exact: true }).click();
      assert.equal(await f.page.locator('h3').count(), 3);
      await settleMotion(f.page);
      await f.page.screenshot({ path: `test-results/browser/dashboard-${width}.png`, fullPage: true });
      await f.page.getByRole('button', { name: 'All', exact: true }).click();
      for (const action of ['Add Member', 'Edit STAGING ONLY Member 1', 'Renew STAGING ONLY Member 1', 'Delete STAGING ONLY Member 1']) {
        await f.page.getByRole('button', { name: action, exact: true }).click();
        const dialog = f.page.getByRole('dialog');
        await dialog.waitFor();
        await noOverflow(f.page);
        const dimensions = await dialog.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
        assert.ok(dimensions.scroll <= dimensions.client, JSON.stringify(dimensions));
        if (action === 'Add Member') {
          assert.deepEqual(await f.page.getByLabel('Membership Type', { exact: true }).locator('option').allTextContents(), ['1 Month', '3 Months', '6 Months', '1 Year']);
          await f.page.screenshot({ path: `test-results/browser/add-${width}.png` });
          await f.page.getByRole('button', { name: 'Close member dialog', exact: true }).focus();
          await f.page.keyboard.press('Shift+Tab');
          assert.equal(await f.page.evaluate(() => document.activeElement?.textContent?.trim()), 'Add Member');
          await f.page.keyboard.press('Tab');
          assert.equal(await f.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close member dialog');
        }
        await f.page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
      }
      const smallButtons = await f.page.getByRole('button').evaluateAll(buttons => buttons.filter(button => button.getBoundingClientRect().height < 43).map(button => button.textContent));
      assert.deepEqual(smallButtons, []);
      assert.deepEqual(f.errors, []);
      assert.equal(f.backend.state.emails.length, 0);
    } finally { await f.context.close(); }
  });
}

test('owner performs add, edit, refresh, renew, confirmed delete and manual WhatsApp preparation', async () => {
  const f = await fixture();
  try {
    await login(f.page);
    const storage = await f.page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
    assert.ok(!storage.includes('sessionToken') && !storage.includes(password));
    await f.page.getByRole('button', { name: 'Add Member', exact: true }).click();
    await f.page.getByLabel('Name', { exact: true }).fill('STAGING ONLY Added');
    await f.page.getByLabel('Phone', { exact: true }).fill('+91 98765 43210');
    await f.page.getByLabel('Weight (kg)', { exact: true }).fill('65.5');
    await f.page.getByLabel('Membership Type', { exact: true }).selectOption('1 Month');
    await f.page.getByLabel('Start Date', { exact: true }).fill(f.today);
    await f.page.getByRole('dialog').getByRole('button', { name: 'Add Member', exact: true }).click();
    await f.page.getByRole('heading', { name: 'STAGING ONLY Added', exact: true }).waitFor();
    assert.equal(f.backend.rows.at(-1)[0], '6');
    assert.equal(f.backend.rows.at(-1)[4], 65.5);
    await f.page.getByRole('button', { name: 'Edit STAGING ONLY Added', exact: true }).click();
    await f.page.getByLabel('Name', { exact: true }).fill('STAGING ONLY Updated');
    await f.page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await f.page.getByRole('heading', { name: 'STAGING ONLY Updated', exact: true }).waitFor();
    // External edit between opening and saving must not be lost.
    await f.page.getByRole('button', { name: 'Edit STAGING ONLY Updated', exact: true }).click();
    f.backend.rows.at(-1)[1] = 'STAGING ONLY Sheet Edit';
    await f.page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await f.page.getByRole('alert').filter({ hasText: 'changed in Sheets' }).waitFor();
    await f.page.getByRole('button', { name: 'Close member dialog', exact: true }).click();
    await f.page.getByRole('button', { name: 'Refresh members', exact: true }).click();
    await f.page.getByRole('heading', { name: 'STAGING ONLY Sheet Edit', exact: true }).waitFor();
    await f.page.getByRole('button', { name: 'Renew STAGING ONLY Member 1', exact: true }).click();
    assert.equal(await f.page.getByLabel('New Start Date', { exact: true }).inputValue(), f.datePlus(8));
    await f.page.getByLabel('New Membership Type', { exact: true }).selectOption('1 Year');
    await f.page.getByRole('button', { name: 'Renew Membership', exact: true }).click();
    await f.page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(f.backend.rows[1][5], '1 Year');
    const link = f.page.getByRole('link', { name: 'WhatsApp reminder for STAGING ONLY Member 2' });
    assert.match(await link.getAttribute('href'), /^https:\/\/wa\.me\/919876543210\?text=/);
    assert.match(new URL(await link.getAttribute('href')).searchParams.get('text'), /STAGING ONLY Member 2/);
    // Do not follow WhatsApp links or send messages.
    await f.page.getByRole('button', { name: 'Delete STAGING ONLY Sheet Edit', exact: true }).click();
    await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.ok(f.backend.rows.find(row => row[0] === '6'));
    await f.page.getByRole('button', { name: 'Delete STAGING ONLY Sheet Edit', exact: true }).click();
    await f.page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await f.page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.ok(!f.backend.rows.find(row => row[0] === '6'));
    assert.equal(f.backend.properties.get('MEMBER_ID_HIGH_WATER_MARK'), '6');
    assert.equal(f.backend.state.emails.length, 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test('public lookup exposes only membership details; server denies unauthorized reads and logout replay', async () => {
  const f = await fixture();
  try {
    await f.page.getByLabel('Member ID', { exact: true }).fill('001');
    await f.page.getByRole('button', { name: 'Check Status', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Member #1', exact: true }).waitFor();
    const publicText = await f.page.locator('body').textContent();
    assert.ok(!publicText.includes('9876543210') && !publicText.includes('STAGING ONLY Member 1'));
    const denied = await f.page.evaluate(async url => (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'getAll' }) })).json(), endpoint);
    assert.equal(denied.code, 'UNAUTHORIZED');
    await login(f.page);
    const session = f.requests.find(request => request.body?.action === 'getAll').body.sessionToken;
    await f.page.getByRole('button', { name: 'Logout', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Owner Login', exact: true }).waitFor();
    assert.equal(f.backend.post({ action: 'getAll', sessionToken: session }).code, 'UNAUTHORIZED');
    await f.page.reload();
    await f.page.getByRole('button', { name: 'Owner Dashboard', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Owner Login', exact: true }).waitFor();
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});

test('server session expiration clears owner data after a protected refresh', async () => {
  const f = await fixture();
  try {
    await login(f.page);
    f.backend.advance(30 * 60 * 1000);
    await f.page.getByRole('button', { name: 'Refresh members', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Owner Login', exact: true }).waitFor();
    assert.equal(await f.page.getByRole('heading', { name: 'STAGING ONLY Member 1', exact: true }).count(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
