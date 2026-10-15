import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { SOURCE_FILES, BACKEND_DIRECTORY, OUTPUT_FILE, buildAppsScriptBundle,
  generateAppsScriptBundle, checkBundleGlobals } from '../scripts/generate-apps-script.mjs';
import { createBackend, password, verifier } from './helpers/apps-script.mjs';

const bundle = await readFile(OUTPUT_FILE, 'utf8');
const canonical = source => source.replace(/\r\n?/g, '\n');

test('ready-to-paste artifact is current, deterministic and contains only the three allowlisted sources', async () => {
  assert.equal(bundle, await buildAppsScriptBundle());
  assert.equal(bundle, await buildAppsScriptBundle());
  assert.deepEqual(SOURCE_FILES, ['Bcrypt.gs', 'Auth.gs', 'Code.gs']);
  assert.ok(bundle.indexOf('BEGIN backend/Bcrypt.gs') < bundle.indexOf('BEGIN backend/Auth.gs'));
  assert.ok(bundle.indexOf('BEGIN backend/Auth.gs') < bundle.indexOf('BEGIN backend/Code.gs'));
  for (const name of SOURCE_FILES) {
    const source = canonical(await readFile(join(BACKEND_DIRECTORY, name), 'utf8'));
    const hash = createHash('sha256').update(source).digest('hex');
    assert.ok(bundle.includes(`BEGIN backend/${name} | SHA-256 ${hash}`));
    assert.ok(bundle.includes(source));
  }
});

test('generator detects stale output without modifying it and regenerates after a source update', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'fitzone-install-'));
  t.after(async () => {
    assert.ok(directory.startsWith(join(tmpdir(), 'fitzone-install-')));
    await rm(directory, { recursive: true, force: true });
  });
  const outputFile = join(directory, 'generated', 'FitZone_Complete.gs');
  for (const name of SOURCE_FILES) await writeFile(join(directory, name), await readFile(join(BACKEND_DIRECTORY, name)));
  await writeFile(join(directory, '.env.local'), 'VITE_APPS_SCRIPT_URL=DO_NOT_BUNDLE_SYNTHETIC_CONFIGURATION');
  await writeFile(join(directory, 'OldDraft.gs'), 'throw new Error("DO_NOT_INCLUDE_OLD_DRAFT")');
  await mkdir(join(directory, 'old-generated'));
  await writeFile(join(directory, 'old-generated', 'Previous.gs'), 'DO_NOT_INCLUDE_GENERATED_INPUT');
  const options = { backendDirectory: directory, outputFile };
  await assert.rejects(generateAppsScriptBundle({ ...options, check: true }), /missing or stale/);
  assert.equal((await generateAppsScriptBundle(options)).changed, true);
  assert.equal(await readFile(outputFile, 'utf8'), bundle);
  assert.equal((await generateAppsScriptBundle(options)).changed, false);
  const code = await readFile(join(directory, 'Code.gs'), 'utf8');
  await writeFile(join(directory, 'Code.gs'), code + '\n// Synthetic source revision\n');
  await assert.rejects(generateAppsScriptBundle({ ...options, check: true }), /missing or stale/);
  assert.equal(await readFile(outputFile, 'utf8'), bundle);
  await generateAppsScriptBundle(options);
  assert.notEqual(await readFile(outputFile, 'utf8'), bundle);
  await generateAppsScriptBundle({ ...options, check: true });
});

test('Windows and Unix source line endings generate identical installation bytes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'fitzone-install-'));
  t.after(async () => {
    assert.ok(directory.startsWith(join(tmpdir(), 'fitzone-install-')));
    await rm(directory, { recursive: true, force: true });
  });
  for (const name of SOURCE_FILES) {
    const source = canonical(await readFile(join(BACKEND_DIRECTORY, name), 'utf8'));
    await writeFile(join(directory, name), source.replaceAll('\n', '\r\n'));
  }
  assert.equal(await buildAppsScriptBundle(directory), bundle);
});

test('single script retains unique top-level entry points and rejects duplicate global declarations', () => {
  const names = checkBundleGlobals(bundle);
  for (const name of ['doGet', 'doPost', 'loginOwner_', 'validateOwnerSession_', 'addMember',
    'updateMember', 'renewMember', 'deleteMember', 'checkMembershipExpiries', 'runDailyExpiryNotifications',
    'previewSyntheticExpiryNotifications', 'resolveExpiryNotification', 'OWNER_AUTH', 'CONFIG']) assert.ok(names.has(name));
  assert.throws(() => checkBundleGlobals(bundle + '\nfunction doGet() {}'), /Duplicate Apps Script global: doGet/);
  assert.throws(() => checkBundleGlobals(bundle + '\nconst CONFIG = {};'), /already been declared/);
});

test('generated file preserves the byte-verified bcrypt algorithm and its upstream license', () => {
  const start = bundle.indexOf('// GENERATED FILE. DO NOT EDIT.');
  const end = bundle.indexOf('\n})(function () { throw new Error(', start);
  assert.equal(createHash('sha256').update(bundle.slice(start, end)).digest('hex'),
    'ed01b52b436504d8bb7086d93fee4bd8edbb22d8ed88e1b456e0c604f30e79c4');
  assert.match(bundle, /Redistribution and use in source and binary forms/);
  assert.match(bundle, /Copyright \(c\) 2025 Daniel Wirtz/);
});

test('bundle initializes in an Apps Script-like global context without Node, browser timers, crypto or imports', () => {
  const app = createBackend({}, { format: 'bundle' });
  assert.deepEqual(Array.from(vm.runInContext('[typeof require, typeof module, typeof exports, typeof setTimeout, typeof setInterval, typeof crypto, typeof fetch]', app.context)), Array(7).fill('undefined'));
  assert.equal(app.context.bcrypt.compareSync(password, verifier), true);
  assert.equal(app.context.bcrypt.compareSync('incorrect-synthetic-password', verifier), false);
  assert.equal(vm.runInContext('OWNER_AUTH.SESSION_MS', app.context), 30 * 60 * 1000);
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.state.emails.length, 0);
  const before = JSON.stringify([...app.properties]);
  assert.equal(app.context.previewSyntheticExpiryNotifications().preview.length, 3);
  assert.equal(JSON.stringify([...app.properties]), before);
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.emails.length, 0);
});

test('generated installation contains no configured password/verifier, private Sheet ID or deployment URL', () => {
  assert.doesNotMatch(bundle, /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
  assert.doesNotMatch(bundle, /https:\/\/(?:script\.google\.com\/macros|docs\.google\.com\/spreadsheets)/);
  assert.doesNotMatch(bundle, /DO_NOT_BUNDLE_SYNTHETIC_CONFIGURATION|DO_NOT_INCLUDE_OLD_DRAFT|DO_NOT_INCLUDE_GENERATED_INPUT/);
  assert.ok(!bundle.includes(password) && !bundle.includes(verifier) && !bundle.includes('SYNTHETIC-STAGING-BOOK'));
});

test('source and combined installations have equivalent authenticated CRUD, notification, lock and logout behavior', () => {
  const apps = ['source', 'bundle'].map(format => {
    const app = createBackend({ MEMBER_ID_HIGH_WATER_MARK: '3' }, { format });
    const sessionToken = app.login().sessionToken;
    app.send = body => app.post({ ...body, sessionToken });
    const results = [];
    results.push(app.get({ id: '001' }));
    for (const membershipType of ['1 Month', '3 Months', '6 Months', '1 Year']) {
      results.push(app.send({ action: 'addMember', member: { name: 'STAGING ONLY Example', phone: '0000000000',
        age: 25, weight: 65, membershipType, startDate: '2024-01-31' } }));
    }
    const member = app.send({ action: 'getAll' }).members[0];
    results.push(app.send({ action: 'updateMember', member: { ...member, name: 'STAGING ONLY Edited' } }));
    results.push(app.context.checkMembershipExpiries()); // Mock Gmail only.
    results.push(app.context.checkMembershipExpiries());
    app.state.lockAvailable = false;
    results.push(app.send({ action: 'deleteMember', memberId: '4' }));
    app.state.lockAvailable = true;
    results.push(app.send({ action: 'renewMember', memberId: '1', membershipType: '1 Month', startDate: '2026-10-16' }));
    results.push(app.send({ action: 'deleteMember', memberId: '7' }));
    results.push(app.send({ action: 'addMember', member: { name: 'STAGING ONLY Next', phone: '0000000001', age: 25,
      weight: 65, membershipType: '1 Month', startDate: '2026-10-15' } }));
    assert.equal(results.at(-1).memberId, '8');
    assert.equal(results[4].memberId, '7');
    assert.equal(app.rows[1][8], false); // Genuine renewal resets notification eligibility.
    assert.equal(app.properties.get('MEMBER_ID_HIGH_WATER_MARK'), '8');
    results.push(app.send({ action: 'getAll' }));
    results.push(app.send({ action: 'logout' }));
    results.push(app.send({ action: 'getAll' }));
    assert.equal(results.at(-1).code, 'UNAUTHORIZED');
    assert.equal(app.state.emails.length, 1);
    assert.ok(app.rows.every(row => row.length === 9));
    return { results, rows: app.rows, emails: app.state.emails };
  });
  assert.deepEqual(JSON.parse(JSON.stringify(apps[0])), JSON.parse(JSON.stringify(apps[1])));
});
