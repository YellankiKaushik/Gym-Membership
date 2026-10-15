import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from './helpers/apps-script.mjs';

const timeDrivenEvent = Object.freeze({
  triggerUid: 'synthetic-daily-trigger', authMode: 'FULL', timezone: 'Asia/Kolkata',
  year: 2026, month: 10, 'day-of-month': 14, hour: 9, minute: 0, second: 0,
});

test('parameterless daily handler ignores the trigger event and explicitly forwards normal mode and its result', () => {
  const app = createBackend();
  const calls = [];
  const result = { success: true, sent: 0 };
  app.context.checkMembershipExpiries = (...args) => { calls.push(args); return result; };
  assert.equal(app.context.runDailyExpiryNotifications.length, 0);
  assert.equal(app.context.runDailyExpiryNotifications(timeDrivenEvent), result);
  assert.equal(app.context.runDailyExpiryNotifications(), result);
  assert.deepEqual(calls, [[false], [false]]);
});

test('boolean-only sender still rejects trigger events without side effects', () => {
  const app = createBackend();
  const properties = JSON.stringify([...app.properties]);
  assert.throws(() => app.context.checkMembershipExpiries(timeDrivenEvent), /boolean dry-run flag/);
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.state.emails.length, 0);
  assert.equal(JSON.stringify([...app.properties]), properties);
});

test('daily trigger events retain locking, pending/sent journaling and duplicate prevention', () => {
  let app;
  app = createBackend({}, { onEmail: () => {
    assert.equal(app.state.lockHeld, true);
    assert.equal(app.rows[1][8], false);
    assert.equal(JSON.parse(app.properties.get('EXPIRY_NOTICE_1')).status, 'pending');
  } });
  assert.equal(app.context.runDailyExpiryNotifications(timeDrivenEvent).sent, 1);
  assert.equal(app.state.lockHeld, false);
  assert.equal(app.rows[1][8], true);
  assert.equal(JSON.parse(app.properties.get('EXPIRY_NOTICE_1')).status, 'sent');
  app.rows[1][8] = false; // The journal must still prevent a duplicate.
  assert.equal(app.context.runDailyExpiryNotifications(timeDrivenEvent).sent, 0);
  assert.equal(app.state.emails.length, 1);
});

test('daily trigger events honor the email-disable switch without opening the Sheet or changing state', () => {
  for (const enabled of [undefined, 'false']) {
    const app = createBackend({ EXPIRY_EMAIL_ENABLED: enabled });
    const properties = JSON.stringify([...app.properties]);
    const rows = JSON.stringify(app.rows);
    const result = app.context.runDailyExpiryNotifications(timeDrivenEvent);
    assert.equal(result.disabled, true);
    assert.equal(result.sent, 0);
    assert.equal(app.state.sheetReads, 0);
    assert.equal(app.state.sheetWrites, 0);
    assert.equal(app.state.spreadsheetOpens.length, 0);
    assert.equal(app.state.emails.length, 0);
    assert.equal(JSON.stringify([...app.properties]), properties);
    assert.equal(JSON.stringify(app.rows), rows);
  }
});

function term(app, days, notified = false) {
  const today = app.context.todayDate_();
  const end = new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  app.rows[1][7] = end;
  app.rows[1][8] = notified;
  return end;
}

for (const [days, count] of [[7, 1], [1, 1], [0, 1], [-1, 0], [8, 0]]) {
  test('notification eligibility at ' + days + ' calendar days: ' + count, () => {
    const app = createBackend();
    term(app, days);
    assert.equal(app.context.checkMembershipExpiries(true).preview.length, count);
    assert.equal(app.state.sheetWrites, 0);
    assert.equal(app.state.emails.length, 0);
    assert.equal(app.context.checkMembershipExpiries().sent, count);
    assert.equal(app.state.emails.length, count);
    assert.equal(app.context.checkMembershipExpiries().sent, 0);
  });
}

test('dry-run mode never mutates rows, properties, formats, or sends Gmail; synthetic preview never opens a Sheet', () => {
  const app = createBackend();
  const rows = JSON.stringify(app.rows);
  const properties = JSON.stringify([...app.properties]);
  assert.equal(app.context.previewSyntheticExpiryNotifications().preview.length, 3);
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.spreadsheetOpens.length, 0);
  app.context.checkMembershipExpiries(true);
  assert.equal(JSON.stringify(app.rows), rows);
  assert.equal(JSON.stringify([...app.properties]), properties);
  assert.equal(app.state.formats.length, 0);
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.state.emails.length, 0);
});

test('missing email or disabled delivery cannot mark anything notified', () => {
  for (const properties of [{ ADMIN_EMAIL: undefined }, { ADMIN_EMAIL: 'invalid' },
    { EXPIRY_EMAIL_ENABLED: undefined }, { EXPIRY_EMAIL_ENABLED: 'false' }]) {
    const app = createBackend(properties);
    app.context.checkMembershipExpiries();
    assert.equal(app.state.emails.length, 0);
    assert.equal(app.state.sheetWrites, 0);
    assert.equal(app.properties.has('EXPIRY_NOTICE_1'), false);
  }
});

test('legacy notified flags, including text TRUE/FALSE, are respected', () => {
  for (const value of [true, 'TRUE', 'true']) {
    const app = createBackend(); term(app, 1, value);
    assert.equal(app.context.checkMembershipExpiries().sent, 0);
  }
  const app = createBackend(); term(app, 1, 'FALSE');
  assert.equal(app.context.checkMembershipExpiries().sent, 1);
});

test('submission failure keeps Column I false, records attempts, backs off and stops after three attempts', () => {
  const app = createBackend(); app.state.failEmail = true;
  assert.equal(app.context.checkMembershipExpiries().failed, 1);
  assert.equal(app.rows[1][8], false);
  assert.equal(JSON.parse(app.properties.get('EXPIRY_NOTICE_1')).status, 'failed');
  assert.equal(app.context.checkMembershipExpiries().failed, 0);
  for (let i = 0; i < 2; i++) { app.advance(3600000); assert.equal(app.context.checkMembershipExpiries().failed, 1); }
  app.advance(3600000);
  assert.deepEqual(Array.from(app.context.checkMembershipExpiries().reviewRequired), ['1']);
  assert.equal(app.state.emails.length, 0);
  assert.equal(app.state.lockHeld, false);
});

test('successful retry completes only after successful Gmail submission', () => {
  let app;
  app = createBackend({}, { onEmail: () => { assert.equal(app.rows[1][8], false); assert.equal(JSON.parse(app.properties.get('EXPIRY_NOTICE_1')).status, 'pending'); } });
  app.state.failEmail = true; app.context.checkMembershipExpiries();
  app.state.failEmail = false; app.advance(3600000);
  assert.equal(app.context.checkMembershipExpiries().sent, 1);
  assert.equal(app.rows[1][8], true);
  assert.equal(JSON.parse(app.properties.get('EXPIRY_NOTICE_1')).attempts, 2);
});

test('sent journal suppresses repeats after Sheet flag failure or manual flag clearing', () => {
  const app = createBackend(); app.state.failWrites = true;
  assert.equal(app.context.checkMembershipExpiries().flagFailures, 1);
  assert.equal(app.rows[1][8], false);
  app.state.failWrites = false;
  assert.equal(app.context.checkMembershipExpiries().sent, 0);
  assert.equal(app.state.emails.length, 1);
});

test('crash after Gmail but before completion journaling requires explicit reconciliation', () => {
  const app = createBackend({}, { beforePropertyWrite: (key, value) => {
    if (key.startsWith('EXPIRY_NOTICE_') && JSON.parse(value).status === 'sent') throw new Error('Synthetic property outage');
  } });
  assert.throws(() => app.context.checkMembershipExpiries(), /outage/);
  assert.equal(app.state.emails.length, 1);
  assert.equal(app.rows[1][8], false);
  assert.equal(app.state.lockHeld, false);
  assert.deepEqual(Array.from(app.context.checkMembershipExpiries().reviewRequired), ['1']);
  assert.equal(app.state.emails.length, 1);
});

test('two simulated scheduled executions and CRUD cannot interleave under ScriptLock', () => {
  let second, competing, mutation;
  const first = createBackend({}, { onEmail: () => {
    competing = second.context.runDailyExpiryNotifications(timeDrivenEvent);
    mutation = second.context.deleteMember('1');
  } });
  second = createBackend({}, { shared: first });
  assert.equal(first.context.runDailyExpiryNotifications(timeDrivenEvent).sent, 1);
  assert.equal(competing.code, 'MEMBER_BUSY');
  assert.equal(mutation.code, 'MEMBER_BUSY');
  assert.equal(second.context.runDailyExpiryNotifications(timeDrivenEvent).sent, 0);
  assert.equal(first.state.emails.length, 1);
});

test('contact-only edits retain notification flag and journal, renewal enables a new deterministic term', () => {
  const app = createBackend();
  app.context.checkMembershipExpiries();
  const oldTerm = JSON.parse(app.properties.get('EXPIRY_NOTICE_1')).term;
  app.context.updateMember({ id: '1', name: 'STAGING ONLY Edited', phone: '0000000000', age: 30, weight: 70,
    membershipType: '3 Months', startDate: '2026-07-15' });
  assert.equal(app.rows[1][8], true);
  assert.equal(app.context.checkMembershipExpiries().sent, 0);
  app.context.renewMember({ memberId: '1', startDate: '2026-10-16', membershipType: '1 Month' });
  assert.equal(app.rows[1][8], false);
  app.advance(26 * 86400000);
  assert.equal(app.context.checkMembershipExpiries().sent, 1);
  assert.notEqual(JSON.parse(app.properties.get('EXPIRY_NOTICE_1')).term, oldTerm);
  assert.equal(app.state.emails.length, 2);
});

test('invalid records are skipped for notifications, duplicate IDs still fail closed', () => {
  const app = createBackend(); app.rows[1][7] = '2026-02-31';
  assert.equal(app.context.checkMembershipExpiries().invalidRows, 1);
  assert.equal(app.state.emails.length, 0);
  app.rows.push([...app.rows[1]]);
  assert.throws(() => app.context.checkMembershipExpiries(), /Duplicate member IDs/);
});

test('malformed journals fail closed rather than inventing a fresh notification', () => {
  for (const record of ['', '{', JSON.stringify({ term: 'invalid', status: 'sent', attempts: 1, attemptedAt: 1 })]) {
    const app = createBackend({ EXPIRY_NOTICE_1: record });
    assert.deepEqual(Array.from(app.context.checkMembershipExpiries().reviewRequired), ['1']);
    assert.equal(app.state.emails.length, 0);
    assert.equal(app.state.sheetWrites, 0);
  }
});

test('explicit editor reconciliation can confirm an uncertain submission without resending', () => {
  let outage = true;
  const app = createBackend({}, { beforePropertyWrite: (key, value) => {
    if (outage && key.startsWith('EXPIRY_NOTICE_') && JSON.parse(value).status === 'sent') throw new Error('Synthetic outage');
  } });
  assert.throws(() => app.context.checkMembershipExpiries());
  outage = false;
  assert.equal(app.context.resolveExpiryNotification('001', 'sent').success, true);
  assert.equal(app.rows[1][8], true);
  assert.equal(app.context.checkMembershipExpiries().sent, 0);
  assert.equal(app.state.emails.length, 1);
});

test('explicit retry reconciliation only permits another scheduled attempt; it never sends itself', () => {
  const app = createBackend();
  const alert = app.context.checkMembershipExpiries(true).preview[0];
  app.properties.set(alert.key, JSON.stringify({ term: alert.term, status: 'pending', attempts: 1, attemptedAt: app.Date.now() }));
  assert.throws(() => app.context.resolveExpiryNotification('1', 'unknown'));
  assert.equal(app.context.resolveExpiryNotification('1', 'retry').success, true);
  assert.equal(app.state.emails.length, 0);
  assert.equal(app.context.checkMembershipExpiries().sent, 1);
  assert.equal(app.get({ action: 'resolveExpiryNotification', id: '1' }).success, false);
});

test('a genuine direct Sheet term change is distinguished from a contact edit even if old I remains true', () => {
  const app = createBackend();
  app.context.checkMembershipExpiries();
  app.rows[1][7] = '2026-10-16';
  assert.equal(app.rows[1][8], true);
  assert.equal(app.context.checkMembershipExpiries().sent, 1);
  assert.equal(app.context.checkMembershipExpiries().sent, 0);
  assert.equal(app.state.emails.length, 2);
});
