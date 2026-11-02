import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createBackend, ownerId, password } from './helpers/apps-script.mjs';

const member = { name: 'STAGING ONLY New', phone: '0000000001', age: 25, weight: 65, membershipType: '1 Month', startDate: '2026-10-14' };
function authenticated(properties = {}, options = {}) {
  const app = createBackend(properties, options);
  const { sessionToken } = app.login();
  app.send = value => app.post({ ...value, sessionToken });
  app.sessionToken = sessionToken;
  app.current = () => app.send({ action: 'getAll' }).members?.[0];
  app.confirm = (purpose, id, version, archiveOperationId) => app.send({ action: 'reauthenticate', purpose, memberId: id,
    expectedVersion: version, archiveOperationId, password }).stepUpToken;
  return app;
}
function historical(properties = {}, options = {}) {
  const app = authenticated({ MEMBER_HISTORY_ENABLED: 'true', MEMBER_HISTORY_SPREADSHEET_ID: 'SYNTHETIC-HISTORY-BOOK',
    MEMBER_HISTORY_SHEET_NAME: 'History', BACKUP_RESTORE_REFERENCE: 'SYNTHETIC_RESTORE_01',
    BACKUP_RESTORE_VERIFIED_AT: '2026-10-14T06:30:00.000Z', EXPIRY_EMAIL_ENABLED: 'false', ...properties }, options);
  return app;
}

test('malformed anonymous attempts do not spend the owner budget, run bcrypt or take the lock', () => {
  const app = createBackend();
  let computations = 0;
  const original = app.context.bcrypt.compareSync;
  app.context.bcrypt.compareSync = (...args) => { computations++; return original(...args); };
  app.state.lockAvailable = false;
  for (let i = 0; i < 100; i++) assert.equal(app.post({ action: 'login', ownerId: 'unknown', password: null }).code, 'INVALID_CREDENTIALS');
  assert.equal(computations, 0);
  assert.equal(app.properties.has('OWNER_LOGIN_THROTTLE'), false);
  app.state.lockAvailable = true;
  assert.equal(app.login().success, true);
  assert.equal(computations, 1);
  assert.equal(app.state.sheetReads, 0);
});

test('valid-shaped targeted traffic remains a documented lockout risk, with bounded bcrypt work/state', () => {
  const app = createBackend();
  let computations = 0;
  const original = app.context.bcrypt.compareSync;
  app.context.bcrypt.compareSync = (...args) => { computations++; return original(...args); };
  for (let i = 0; i < 20; i++) app.post({ action: 'login', ownerId: i % 2 ? ownerId : 'unknown-' + i, password: 'Wrong-synthetic-password!' });
  assert.equal(computations, 5);
  assert.equal(app.login().code, 'RATE_LIMITED');
  assert.equal([...app.properties.keys()].filter(key => key.includes('THROTTLE')).length, 1);
  app.advance(15 * 60000);
  assert.equal(app.login().success, true);
  assert.equal(app.state.lockHeld, false);
});

test('capability mode rejects numeric enumeration and unknown access uniformly without Sheet reads', () => {
  const app = createBackend({ MEMBER_LOOKUP_MODE: 'capability' });
  const unavailable = app.post({ action: 'lookupMember', lookupToken: '0'.repeat(64) });
  for (const id of ['1', '2', '001', '', 'not-an-id']) assert.deepEqual(app.get({ action: 'lookup', id }), unavailable);
  for (const token of ['', null, {}, '1', '0'.repeat(64)]) assert.deepEqual(app.post({ action: 'lookupMember', lookupToken: token }), unavailable);
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.state.emails.length, 0);
});

test('capabilities disclose minimum fields, store only digests, and read IDs plus one row', () => {
  const app = authenticated({ MEMBER_LOOKUP_MODE: 'capability' });
  for (let i = 2; i <= 100; i++) app.rows.push([String(i), ...app.rows[1].slice(1)]);
  const issued = app.send({ action: 'issueMemberLookup', memberId: '1' });
  assert.equal(issued.success, true);
  const before = { reads: app.state.fullRangeReads, cells: app.state.cellsRead };
  const result = app.post({ action: 'lookupMember', lookupToken: issued.lookupToken });
  assert.equal(result.success, true);
  assert.equal(app.state.fullRangeReads, before.reads);
  assert.equal(app.state.cellsRead - before.cells, 109); // 100 IDs + nine selected cells, versus 909 full-range cells.
  assert.deepEqual(Object.keys(result.member).sort(), ['daysRemaining', 'endDate', 'id', 'membershipType', 'name', 'status']);
  assert.ok(!JSON.stringify([...app.properties]).includes(issued.lookupToken));
  for (const secret of ['Synthetic Member', '9999999999']) assert.ok(!JSON.stringify(result).includes(secret));
});

test('capability replacement, revocation, expiry and cross-project use are rejected', () => {
  const app = authenticated({ MEMBER_LOOKUP_MODE: 'capability' });
  const first = app.send({ action: 'issueMemberLookup', memberId: '1', validDays: 1 });
  const second = app.send({ action: 'issueMemberLookup', memberId: '1', validDays: 1 });
  assert.equal(app.post({ action: 'lookupMember', lookupToken: first.lookupToken }).success, false);
  const other = createBackend({ MEMBER_LOOKUP_MODE: 'capability' });
  assert.equal(other.post({ action: 'lookupMember', lookupToken: second.lookupToken }).success, false);
  assert.equal(app.send({ action: 'revokeMemberLookup', memberId: '1' }).success, true);
  assert.equal(app.post({ action: 'lookupMember', lookupToken: second.lookupToken }).success, false);
  const third = app.send({ action: 'issueMemberLookup', memberId: '1', validDays: 1 });
  app.advance(86400000);
  assert.equal(app.post({ action: 'lookupMember', lookupToken: third.lookupToken }).success, false);
});

test('capability work budgets stop before reading Sheets; manual duplicate IDs fail closed', () => {
  const app = authenticated({ MEMBER_LOOKUP_MODE: 'capability' });
  const issued = app.send({ action: 'issueMemberLookup', memberId: '1' });
  for (let i = 0; i < 10; i++) assert.equal(app.post({ action: 'lookupMember', lookupToken: issued.lookupToken }).success, true);
  const reads = app.state.sheetReads;
  assert.equal(app.post({ action: 'lookupMember', lookupToken: issued.lookupToken }).success, false);
  assert.equal(app.state.sheetReads, reads);
  app.advance(60000);
  app.rows.push(['1', ...app.rows[1].slice(1)]);
  assert.equal(app.post({ action: 'lookupMember', lookupToken: issued.lookupToken }).success, false);
});

test('capability state has an active limit, permits replacement and prunes expired pointers', () => {
  const app = authenticated({ MEMBER_LOOKUP_MODE: 'capability' });
  for (let i = 1; i <= 500; i++) {
    const key = 'LOOKUP_TOKEN_' + i.toString(16).padStart(64, '0');
    const id = String(i + 1);
    app.properties.set(key, JSON.stringify({ id, expiresAt: app.Date.now() + 1000, start: app.Date.now(), count: 0 }));
    app.properties.set('MEMBER_LOOKUP_' + id, key);
  }
  assert.equal(app.send({ action: 'issueMemberLookup', memberId: '1' }).code, 'LOOKUP_CAPACITY');
  const key = 'LOOKUP_TOKEN_' + '1'.padStart(64, '0');
  app.properties.set(key, JSON.stringify({ id: '1', expiresAt: app.Date.now() + 1000, start: app.Date.now(), count: 0 }));
  app.properties.set('MEMBER_LOOKUP_1', key);
  assert.equal(app.send({ action: 'issueMemberLookup', memberId: '1' }).success, true);
  assert.equal([...app.properties.keys()].filter(k => k.startsWith('LOOKUP_TOKEN_')).length, 500);
  app.advance(1000);
  assert.equal(app.send({ action: 'issueMemberLookup', memberId: '1' }).success, true);
  assert.equal([...app.properties.keys()].filter(k => k.startsWith('LOOKUP_TOKEN_')).length, 1);
  assert.equal(app.properties.has('MEMBER_LOOKUP_3'), false);
});

test('legacy public work is bounded and never crowds out existing authenticated authorization', () => {
  const app = authenticated();
  for (let i = 0; i < 60; i++) assert.equal(app.get({ id: '1' }).success, true);
  const reads = app.state.sheetReads;
  assert.equal(app.get({ id: '1' }).code, 'LOOKUP_UNAVAILABLE');
  assert.equal(app.state.sheetReads, reads);
  assert.equal(app.send({ action: 'getAll' }).success, true);
  app.advance(60000);
  assert.equal(app.get({ id: '1' }).success, true);
});

test('configured row cap blocks full-range reads and lookup lock contention releases safely', () => {
  const app = createBackend({ MEMBER_MAX_ROWS: '2' });
  app.rows.push(['2', ...app.rows[1].slice(1)]);
  assert.equal(app.get({ id: '1' }).code, 'MEMBER_READ_LIMIT');
  assert.equal(app.state.sheetReads, 0);
  app.state.lockAvailable = false;
  assert.equal(app.get({ id: '1' }).code, 'LOOKUP_UNAVAILABLE');
  assert.equal(app.state.lockHeld, false);
});

test('fresh confirmation is bound to session/member/version/action and consumed once', () => {
  const app = authenticated({ OWNER_STEP_UP_REQUIRED: 'true' });
  const current = app.current();
  const deletion = { action: 'deleteMember', memberId: '1', expectedVersion: current.version };
  assert.equal(app.send(deletion).code, 'REAUTHENTICATION_REQUIRED');
  const stepUpToken = app.confirm('deleteMember', '1', current.version);
  assert.ok(stepUpToken);
  assert.equal(app.send({ ...deletion, memberId: '2', stepUpToken }).code, 'REAUTHENTICATION_REQUIRED');
  assert.equal(app.send({ ...deletion, stepUpToken }).success, true);
  assert.equal(app.send({ ...deletion, stepUpToken }).code, 'REAUTHENTICATION_REQUIRED');
  assert.equal(app.rows.length, 1);
});

test('expired confirmation and logout replay cannot authorize deletion', () => {
  const app = authenticated({ OWNER_STEP_UP_REQUIRED: 'true' });
  const current = app.current();
  const token = app.confirm('deleteMember', '1', current.version);
  app.advance(60000);
  assert.equal(app.send({ action: 'deleteMember', memberId: '1', expectedVersion: current.version, stepUpToken: token }).code, 'REAUTHENTICATION_REQUIRED');
  app.send({ action: 'logout' });
  assert.equal(app.send({ action: 'deleteMember', memberId: '1', stepUpToken: token }).code, 'UNAUTHORIZED');
  assert.equal(app.state.sheetWrites, 0);
});

test('new privileged routes are server gated, including restore and capability administration', () => {
  const app = createBackend();
  for (const action of ['restoreMember', 'issueMemberLookup', 'revokeMemberLookup', 'reauthenticate']) {
    assert.equal(app.post({ action, memberId: '1', password }).code, 'UNAUTHORIZED');
  }
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.sheetWrites, 0);
});

test('history cannot activate without a current backup restore attestation and separate store', () => {
  for (const overrides of [{ BACKUP_RESTORE_VERIFIED_AT: undefined }, { BACKUP_RESTORE_VERIFIED_AT: '2025-01-01T00:00:00Z' },
    { BACKUP_RESTORE_VERIFIED_AT: '2027-01-01T00:00:00Z' }, { MEMBER_HISTORY_SPREADSHEET_ID: 'SYNTHETIC-STAGING-BOOK' }]) {
    const app = historical(overrides);
    assert.equal(app.send({ action: 'addMember', member, operationId: randomUUID() }).success, false);
    assert.equal(app.state.sheetWrites, 0);
  }
});

test('history requires unique operation IDs, rejects stale/missing versions and deduplicates creation', () => {
  const app = historical();
  assert.equal(app.send({ action: 'addMember', member }).code, 'OPERATION_ID_REQUIRED');
  assert.equal(app.send({ action: 'updateMember', member: { ...member, id: '1' }, operationId: randomUUID() }).code, 'STALE_MEMBER');
  const operationId = randomUUID();
  const first = app.send({ action: 'addMember', member, operationId });
  const writes = app.state.sheetWrites;
  assert.deepEqual(app.send({ action: 'addMember', member, operationId }), first);
  assert.equal(app.state.sheetWrites, writes);
  assert.equal(app.send({ action: 'addMember', member: { ...member, name: 'STAGING ONLY Different' }, operationId }).code, 'OPERATION_CONFLICT');
  assert.equal(app.properties.get('MEMBER_ID_HIGH_WATER_MARK'), '2');
  assert.equal(app.historyRows.at(-1)[3], 'COMMITTED');
});

test('archive-first deletion restores the original ID, phone formatting, dates and nine-column structure', () => {
  const app = historical({ OWNER_STEP_UP_REQUIRED: 'true' }, { initialFormats: ['@', '@', '0000000000', '0', '0.0', '@', 'yyyy-mm-dd', 'yyyy-mm-dd', 'General'], phoneDisplays: { 2: '0123456789' } });
  app.rows[1][2] = 123456789;
  const current = app.current();
  const operationId = randomUUID();
  const stepUpToken = app.confirm('deleteMember', '1', current.version);
  assert.equal(app.send({ action: 'deleteMember', memberId: '1', expectedVersion: current.version, operationId, stepUpToken }).success, true);
  assert.equal(app.rows.length, 1);
  assert.equal(app.historyRows[1][3], 'COMMITTED');
  const restoreConfirmation = app.confirm('restoreMember', '1', undefined, operationId);
  const restored = app.send({ action: 'restoreMember', memberId: '1', archiveOperationId: operationId, operationId: randomUUID(),
    stepUpToken: restoreConfirmation, notificationReconciliationConfirmed: true });
  assert.equal(restored.success, true);
  assert.equal(app.rows[1].length, 9);
  assert.equal(app.rows[1][0], '001');
  assert.equal(app.rows[1][2], 123456789);
  assert.ok(app.state.formats.some(entry => entry.column === 3 && entry.format === '0000000000'));
  assert.equal(app.context.formatDate(app.rows[1][7]), current.endDate);
  assert.equal(app.current().id, '1');
  assert.equal(app.current().phone, '0123456789');
  assert.equal(app.properties.get('MEMBER_ID_HIGH_WATER_MARK'), '1');
  assert.equal(app.send({ action: 'addMember', member, operationId: randomUUID() }).memberId, '2');
  assert.equal(app.state.emails.length, 0);
});

test('previous-term recovery does not overwrite intervening edits and requires email reconciliation', () => {
  const app = historical();
  const current = app.current();
  const operationId = randomUUID();
  const renewal = app.send({ action: 'renewMember', memberId: '1', membershipType: '1 Month', startDate: '2026-10-16', expectedVersion: current.version, operationId });
  assert.equal(renewal.success, true);
  const renewed = app.current();
  let stepUpToken = app.confirm('restoreMember', '1', renewed.version, operationId);
  app.properties.set('EXPIRY_EMAIL_ENABLED', 'true');
  assert.equal(app.send({ action: 'restoreMember', memberId: '1', expectedVersion: renewed.version, archiveOperationId: operationId,
    operationId: randomUUID(), stepUpToken, notificationReconciliationConfirmed: true }).code, 'NOTIFICATION_REVIEW_REQUIRED');
  app.properties.set('EXPIRY_EMAIL_ENABLED', 'false');
  stepUpToken = app.confirm('restoreMember', '1', renewed.version, operationId);
  app.rows[1][1] = 'STAGING ONLY Intervening edit';
  assert.equal(app.send({ action: 'restoreMember', memberId: '1', expectedVersion: renewed.version, archiveOperationId: operationId,
    operationId: randomUUID(), stepUpToken, notificationReconciliationConfirmed: true }).code, 'RESTORE_CONFLICT');
  app.rows[1][1] = current.name;
  stepUpToken = app.confirm('restoreMember', '1', renewed.version, operationId);
  assert.equal(app.send({ action: 'restoreMember', memberId: '1', expectedVersion: renewed.version, archiveOperationId: operationId,
    operationId: randomUUID(), stepUpToken, notificationReconciliationConfirmed: true }).success, true);
  assert.equal(app.current().endDate, current.endDate);
});

test('history intent failure blocks member writes; interrupted commit requires explicit reconciliation', () => {
  const app = historical();
  app.state.failHistoryWrites = true;
  assert.equal(app.send({ action: 'addMember', member, operationId: randomUUID() }).success, false);
  assert.equal(app.state.sheetWrites, 0);
  app.state.failHistoryWrites = false;
  app.state.failHistoryCommit = true;
  const operationId = randomUUID();
  const request = { action: 'addMember', member, operationId };
  assert.equal(app.send(request).success, false);
  assert.equal(app.rows.length, 3);
  assert.equal(app.historyRows[1][3], 'PENDING');
  const writes = app.state.sheetWrites;
  assert.equal(app.send(request).code, 'HISTORY_REVIEW_REQUIRED');
  assert.equal(app.send({ action: 'addMember', member, operationId: randomUUID() }).code, 'HISTORY_REVIEW_REQUIRED');
  assert.equal(app.state.sheetWrites, writes);
  app.properties.set('EXPIRY_EMAIL_ENABLED', 'true');
  assert.equal(app.context.checkMembershipExpiries(false).code, 'HISTORY_REVIEW_REQUIRED');
  assert.equal(app.state.emails.length, 0);
  app.state.failHistoryCommit = false;
  assert.equal(app.context.reconcileMemberHistory(operationId, 'applied').success, true);
  assert.equal(app.send(request).success, true);
  assert.equal(app.state.sheetWrites, writes);
});

test('failed member write is not auto-retried; explicit not-applied reconciliation verifies the before image', () => {
  const app = historical();
  app.state.failWrites = true;
  const operationId = randomUUID();
  const request = { action: 'updateMember', member: { ...member, id: '1', version: app.current().version }, operationId };
  assert.equal(app.send(request).success, false);
  assert.equal(app.historyRows[1][3], 'PENDING');
  assert.throws(() => app.context.reconcileMemberHistory(operationId, 'applied'), /does not match/);
  assert.equal(app.context.reconcileMemberHistory(operationId, 'not-applied').success, true);
  app.state.failWrites = false;
  assert.equal(app.send({ ...request, operationId: randomUUID() }).success, true);
});

test('security events cover auth/mutation/revocation and never contain input secrets or member contact data', () => {
  const app = authenticated();
  app.post({ action: 'login', ownerId, password: null });
  app.send({ action: 'addMember', member });
  app.send({ action: 'logout' });
  app.send({ action: 'deleteMember', memberId: '1' });
  const logs = app.state.logs.join('\n');
  for (const value of [password, app.sessionToken, '9999999999', member.name, member.phone, 'SYNTHETIC-STAGING-BOOK']) assert.ok(!logs.includes(value));
  assert.doesNotMatch(logs, /\$2[aby]\$\d{2}\$/);
  const actions = app.state.logs.map(value => JSON.parse(value).action);
  for (const action of ['login', 'create', 'logout', 'unauthorized']) assert.ok(actions.includes(action));
});
