import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, ownerId, password, verifier } from './helpers/apps-script.mjs';

test('correct owner login issues an opaque session without reading the Sheet', () => {
  const app = createBackend();
  const response = app.login();
  assert.equal(response.success, true);
  assert.match(response.sessionToken, /^[a-f0-9]{64}$/);
  assert.equal(response.expiresAt, app.Date.now() + 30 * 60 * 1000);
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.lockHeld, false);
  const stored = JSON.stringify(Object.fromEntries(app.properties));
  assert.ok(!stored.includes(response.sessionToken));
  assert.ok(!JSON.stringify(response).includes(verifier));
  assert.ok(!JSON.stringify(response).includes(password));
  assert.equal('members' in response, false);
});

for (const [title, input] of [
  ['wrong owner', { ownerId: 'wrong-owner', password }],
  ['wrong password', { ownerId, password: 'Wrong-synthetic-password!' }],
  ['null password', { ownerId, password: null }],
  ['null owner', { ownerId: null, password }],
  ['empty password', { ownerId, password: '' }],
  ['object password', { ownerId, password: {} }],
  ['oversized password', { ownerId, password: 'x'.repeat(73) }],
  ['UTF-8 truncated password', { ownerId, password: '😀'.repeat(30) }],
]) {
  test('login rejects ' + title, () => {
    const app = createBackend();
    assert.equal(app.post({ action: 'login', ...input }).code, 'INVALID_CREDENTIALS');
    assert.equal(app.state.sheetReads, 0);
    assert.equal(app.state.sheetWrites, 0);
  });
}

for (const [key, value] of [
  ['OWNER_ID', undefined], ['OWNER_ID', ''], ['OWNER_ID', '   '],
  ['OWNER_PASSWORD_HASH', undefined], ['OWNER_PASSWORD_HASH', ''],
  ['OWNER_PASSWORD_HASH', '   '], ['OWNER_PASSWORD_HASH', 'plaintext-not-a-verifier'],
  ['OWNER_PASSWORD_HASH', verifier.replace('$12$', '$04$')],
  ['OWNER_PASSWORD_HASH', verifier.replace('$12$', '$31$')],
]) {
  test('configuration fails closed for ' + key + ' = ' + JSON.stringify(value), () => {
    const app = createBackend({ [key]: value });
    assert.equal(app.login().code, 'AUTH_UNAVAILABLE');
    assert.equal(app.post({ action: 'getAll', password: null }).code, 'UNAUTHORIZED');
    assert.equal(app.state.sheetReads, 0);
  });
}

test('malformed events and JSON fail without touching member records', () => {
  const app = createBackend();
  for (const event of [undefined, {}, { postData: {} }, { postData: { contents: '{' } },
    { postData: { contents: 'x'.repeat(16385) } }]) {
    assert.equal(app.rawPost(event).success, false);
  }
  for (const value of [null, [], '', false, 0, {}, { action: null }]) {
    assert.equal(app.post(value).success, false);
  }
  assert.equal(app.state.sheetReads, 0);
});

test('every protected action rejects absent, fake, null and password-only authorization', () => {
  const app = createBackend();
  for (const action of ['getAll', 'addMember', 'updateMember', 'renewMember', 'deleteMember', 'logout']) {
    for (const credential of [{}, { sessionToken: null }, { sessionToken: {} },
      { sessionToken: '0'.repeat(64) }, { password }]) {
      assert.equal(app.post({ action, ...credential }).code, 'UNAUTHORIZED');
    }
  }
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.sheetWrites, 0);
});

test('server expiration rejects a token at the exact deadline', () => {
  const app = createBackend();
  const { sessionToken } = app.login();
  app.advance(30 * 60 * 1000);
  assert.equal(app.post({ action: 'getAll', sessionToken }).code, 'UNAUTHORIZED');
  assert.equal(app.state.sheetReads, 0);
});

test('logout revokes only that session; replay fails', () => {
  const app = createBackend();
  const first = app.login().sessionToken;
  const second = app.login().sessionToken;
  assert.notEqual(first, second);
  assert.equal(app.post({ action: 'logout', sessionToken: first }).success, true);
  assert.equal(app.post({ action: 'getAll', sessionToken: first }).code, 'UNAUTHORIZED');
  assert.equal(app.post({ action: 'getAll', sessionToken: second }).success, true);
});

test('credential rotation and missing configuration invalidate existing sessions', () => {
  for (const change of [properties => properties.set('OWNER_ID', 'rotated-owner'),
    properties => properties.delete('OWNER_PASSWORD_HASH')]) {
    const app = createBackend();
    const { sessionToken } = app.login();
    change(app.properties);
    assert.equal(app.post({ action: 'getAll', sessionToken }).code, 'UNAUTHORIZED');
    assert.equal(app.state.sheetReads, 0);
  }
});

test('five failed logins throttle subsequent attempts until the window expires', () => {
  const app = createBackend();
  for (let i = 0; i < 5; i++) assert.equal(app.post({ action: 'login', ownerId, password: null }).code, 'INVALID_CREDENTIALS');
  assert.equal(app.login().code, 'RATE_LIMITED');
  assert.equal(app.state.lockHeld, false);
  app.advance(15 * 60 * 1000);
  assert.equal(app.login().success, true);
});

test('auth lock contention fails closed', () => {
  const app = createBackend();
  app.state.lockAvailable = false;
  assert.equal(app.login().code, 'AUTH_BUSY');
  assert.equal(app.state.sheetReads, 0);
});

test('expired, malformed and old-credential session records are pruned; active sessions are bounded', () => {
  const app = createBackend();
  const first = app.login().sessionToken;
  const firstKey = [...app.properties.keys()].find(key => key.startsWith('OWNER_SESSION_'));
  const record = JSON.parse(app.properties.get(firstKey));
  for (let i = 0; i < 19; i++) {
    app.properties.set('OWNER_SESSION_synthetic_' + i, JSON.stringify({ ...record, expiresAt: record.expiresAt + i + 1 }));
  }
  app.properties.set('OWNER_SESSION_malformed', '{');
  app.properties.set('OWNER_SESSION_expired', JSON.stringify({ ...record, expiresAt: app.Date.now() }));
  app.properties.set('OWNER_SESSION_rotated', JSON.stringify({ ...record, credentialVersion: 'old' }));
  assert.equal(app.login().success, true);
  assert.equal([...app.properties.keys()].filter(key => key.startsWith('OWNER_SESSION_')).length, 20);
  assert.equal(app.post({ action: 'getAll', sessionToken: first }).code, 'UNAUTHORIZED');
});

test('public GET never dispatches administrative actions, even with valid credentials', () => {
  const app = createBackend();
  const { sessionToken } = app.login();
  for (const action of ['login', 'logout', 'getAll', 'addMember', 'updateMember', 'renewMember', 'deleteMember']) {
    assert.equal(app.get({ action, password, sessionToken }).success, false);
  }
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.sheetWrites, 0);
});

test('public lookup uses a pseudonym and an explicit allowlist without private fields', () => {
  const app = createBackend();
  const response = app.get({ action: 'lookup', id: '001' });
  assert.equal(response.success, true);
  assert.equal(response.member.name, 'Member #1');
  assert.deepEqual(Object.keys(response.member).sort(), [
    'daysRemaining', 'endDate', 'id', 'membershipType', 'name', 'status',
  ]);
  assert.ok(!JSON.stringify(response).includes('9999999999'));
  assert.ok(!JSON.stringify(response).includes('Synthetic Member'));
  assert.equal(app.context.maskPhone('123'), 'XXXX');
});

test('authorized CRUD retains IDs, calculations, and nine columns with I = Notified', () => {
  const app = createBackend();
  const { sessionToken } = app.login();
  assert.equal(app.post({ action: 'getAll', sessionToken }).members.length, 1);
  const member = { name: 'Synthetic New', phone: '8888888888', age: 25, weight: 65,
    membershipType: '3 Months', startDate: '2026-01-15' };
  const added = app.post({ action: 'addMember', member, sessionToken });
  assert.equal(added.memberId, '2');
  assert.equal(app.rows[2].length, 9);
  assert.equal(app.rows[2][8], false);
  assert.equal(app.context.formatDate(app.rows[2][7]), '2026-04-15');
  app.rows[2][8] = true;
  assert.equal(app.post({ action: 'updateMember', member: { ...member, id: '2', name: 'Changed' }, sessionToken }).success, true);
  assert.equal(app.rows[2][1], 'Changed');
  assert.equal(app.rows[2][8], true);
  assert.equal(app.post({ action: 'renewMember', memberId: '2', membershipType: '6 Months', startDate: '2026-10-15', sessionToken }).success, true);
  assert.equal(app.context.formatDate(app.rows[2][7]), '2027-04-15');
  assert.equal(app.rows[2][8], false);
  assert.equal(app.rows[2].length, 9);
  assert.equal(app.post({ action: 'deleteMember', memberId: '2', sessionToken }).success, true);
  assert.equal(app.rows.length, 2);
});

test('email functions use configured recipient and preserve column I', () => {
  const app = createBackend();
  app.context.checkMembershipExpiries();
  assert.equal(app.state.emails.length, 1);
  assert.equal(app.state.emails[0][0], 'owner@example.invalid');
  assert.match(app.state.emails[0][1], /Membership Expiry Alert/);
  assert.equal(app.rows[1][8], true);
  assert.equal(app.rows[1].length, 9);
});

test('exception responses never echo property values or credentials', () => {
  const app = createBackend();
  app.context.handleGetAllMembers = () => { throw new Error(password + verifier); };
  const { sessionToken } = app.login();
  const response = app.post({ action: 'getAll', sessionToken });
  assert.equal(response.success, false);
  assert.ok(!JSON.stringify(response).includes(password));
  assert.ok(!JSON.stringify(response).includes(verifier));
});
