import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import vm from 'node:vm';
import { createBackend, ownerId, verifier } from './helpers/apps-script.mjs';

const head = readFileSync(new URL('../backend/testing/PrototypeHeadChecks.gs', import.meta.url), 'utf8');

test('existing frontend wire contract works with migrations off and no operation IDs or versions', () => {
  const app = createBackend({ EXPIRY_EMAIL_ENABLED: 'false' });
  const session = app.login();
  assert.deepEqual(session.securityPolicy, { authMode: 'legacy', stepUpRequired: false, historyEnabled: false, lookupMode: 'legacy' });
  const send = payload => app.post({ ...payload, sessionToken: session.sessionToken });
  const member = { name: 'STAGING ONLY Legacy', phone: '0000000001', age: 25, weight: 65, membershipType: '1 Month', startDate: '2026-01-31' };
  const added = send({ action: 'addMember', member });
  assert.equal(added.success, true);
  assert.equal(app.get({ action: 'lookup', id: added.memberId }).success, true);
  assert.equal(send({ action: 'updateMember', member: { ...member, id: added.memberId, age: 26 } }).success, true);
  assert.equal(send({ action: 'renewMember', memberId: added.memberId, membershipType: '1 Month', startDate: '2026-03-01' }).newEndDate, '2026-04-01');
  assert.equal(send({ action: 'deleteMember', memberId: added.memberId }).success, true);
  assert.equal(send({ action: 'addMember', member }).memberId, String(Number(added.memberId) + 1));
  assert.equal(send({ action: 'logout' }).success, true);
  assert.equal(send({ action: 'getAll' }).code, 'UNAUTHORIZED');
  assert.equal(app.state.emails.length, 0);
  assert.equal(app.state.historyWrites, 0);
  assert.ok(app.rows.every(row => row.length === 9));
});

test('baseline credential fingerprint sessions fail closed after backend upgrade and fresh login succeeds', () => {
  const app = createBackend();
  const token = randomBytes(32).toString('hex');
  const digest = value => createHash('sha256').update(value).digest('hex');
  app.properties.set('OWNER_SESSION_' + digest(token), JSON.stringify({ expiresAt: app.Date.now() + 60000,
    credentialVersion: digest(ownerId + '\n' + verifier) }));
  assert.equal(app.post({ action: 'getAll', sessionToken: token }).code, 'UNAUTHORIZED');
  assert.equal(app.login().success, true);
});

test('optional editor head smoke cleans only its fictional rows, revokes authority and sends no mail', () => {
  assert.equal(readFileSync(new URL('../backend/generated/FitZone_Complete.gs', import.meta.url), 'utf8').includes('function runPrototypeHeadChecks('), false);
  const app = createBackend({ EXPIRY_EMAIL_ENABLED: 'false', FITZONE_PROTOTYPE_HEAD_TEST: 'fictional-data-only' });
  const original = JSON.stringify(app.rows);
  vm.runInContext(head, app.context);
  assert.equal(app.context.runPrototypeHeadChecks().success, true);
  assert.equal(JSON.stringify(app.rows), original);
  assert.equal(app.properties.get('MEMBER_ID_HIGH_WATER_MARK'), '3');
  assert.equal(app.state.emails.length, 0);
  assert.equal(app.state.historyWrites, 0);
  assert.equal([...app.properties.keys()].some(key => key.startsWith('OWNER_SESSION_')), false);
  assert.equal(app.state.lockHeld, false);
});

test('head smoke refuses missing attestation, enabled mail or active migrations before any member access', () => {
  for (const override of [{ FITZONE_PROTOTYPE_HEAD_TEST: undefined }, { EXPIRY_EMAIL_ENABLED: 'true' },
    { OWNER_AUTH_MODE: 'managed' }, { MEMBER_LOOKUP_MODE: 'capability' }, { MEMBER_HISTORY_ENABLED: 'true' }, { OWNER_STEP_UP_REQUIRED: 'true' }]) {
    const app = createBackend({ EXPIRY_EMAIL_ENABLED: 'false', FITZONE_PROTOTYPE_HEAD_TEST: 'fictional-data-only', ...override });
    vm.runInContext(head, app.context);
    assert.throws(() => app.context.runPrototypeHeadChecks(), /Head test blocked/);
    assert.equal(app.state.sheetReads, 0);
    assert.equal(app.state.sheetWrites, 0);
    assert.equal(app.state.emails.length, 0);
    assert.equal([...app.properties.keys()].some(key => key.startsWith('OWNER_SESSION_')), false);
  }
});
