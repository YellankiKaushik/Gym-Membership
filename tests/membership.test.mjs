import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from './helpers/apps-script.mjs';

const member = { name: 'Synthetic Only', phone: '0000000002', age: 25, weight: 65,
  membershipType: '1 Month', startDate: '2026-01-31' };

function authenticated(options = {}, properties = {}) {
  const app = createBackend(properties, options);
  const sessionToken = app.login().sessionToken;
  app.send = body => app.post({ ...body, sessionToken });
  return app;
}

for (const [start, plan, expected] of [
  ['2026-01-31', '1 Month', '2026-02-28'],
  ['2024-01-31', '1 Month', '2024-02-29'],
  ['2024-02-29', '1 Year', '2025-02-28'],
  ['2026-08-31', '6 Months', '2027-02-28'],
  ['2024-08-31', '6 Months', '2025-02-28'],
  ['2026-01-31', '3 Months', '2026-04-30'],
  ['2026-10-15', '1 Year', '2027-10-15'],
  ['2026-12-31', '1 Month', '2027-01-31'],
]) {
  test(start + ' + ' + plan + ' clamps to ' + expected, () => {
    const app = createBackend();
    assert.equal(app.context.formatDate(app.context.calculateEndDate(start, plan)), expected);
  });
}

test('all four plans persist genuine Sheet dates and return normalized dates', () => {
  const app = authenticated();
  for (const membershipType of ['1 Month', '3 Months', '6 Months', '1 Year']) {
    const result = app.send({ action: 'addMember', member: { ...member, membershipType } });
    assert.equal(result.success, true);
    const row = app.rows.at(-1);
    assert.equal(Object.prototype.toString.call(row[6]), '[object Date]');
    assert.equal(Object.prototype.toString.call(row[7]), '[object Date]');
    assert.equal(row.length, 9);
    assert.equal(row[8], false);
    const record = app.get({ id: result.memberId }).member;
    assert.equal(record.startDate, member.startDate);
    assert.match(record.endDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.ok(app.state.formats.some(f => f.column === 3 && f.format === '@'));
});

test('new empty installation issues 1, 2, 3, 4 as unpadded strings in Sheet and API', () => {
  const app = authenticated();
  app.rows.splice(1);
  for (const expected of ['1', '2', '3', '4']) {
    assert.equal(app.send({ action: 'addMember', member }).memberId, expected);
    assert.equal(app.rows.at(-1)[0], expected);
  }
});

test('creation grows a full Sheet before formatting and writing the next row', () => {
  const app = authenticated({ maxRows: 2 });
  assert.equal(app.send({ action: 'addMember', member }).memberId, '2');
  assert.equal(app.state.maxRows, 3);
  assert.equal(app.rows[2].length, 9);
});

test('highest legacy ID deleted before first creation remains reserved across executions', () => {
  const app = authenticated();
  app.rows.push(['009', ...app.rows[1].slice(1)]);
  assert.equal(app.send({ action: 'deleteMember', memberId: '9' }).success, true);
  assert.equal(app.properties.get('MEMBER_ID_HIGH_WATER_MARK'), '9');
  const next = authenticated({ shared: app });
  assert.equal(next.send({ action: 'addMember', member }).memberId, '10');
  assert.equal(next.send({ action: 'deleteMember', memberId: '010' }).success, true);
  assert.equal(next.send({ action: 'addMember', member }).memberId, '11');
  next.rows.splice(1); // Simulated manual deletion cannot reset an established counter.
  assert.equal(next.send({ action: 'addMember', member }).memberId, '12');
});

test('manual higher IDs raise the counter; an invalid counter fails closed', () => {
  const app = authenticated();
  app.rows.push([50, ...app.rows[1].slice(1)]);
  assert.equal(app.send({ action: 'addMember', member }).memberId, '51');
  for (const bad of ['', '-1', '1.5', 'NaN', '9007199254740992']) {
    app.properties.set('MEMBER_ID_HIGH_WATER_MARK', bad);
    const before = JSON.stringify(app.rows);
    assert.equal(app.send({ action: 'addMember', member }).code, 'INVALID_ID_COUNTER');
    assert.equal(JSON.stringify(app.rows), before);
  }
});

test('failed writes do not reuse reserved IDs and always release the lock', () => {
  const app = authenticated();
  app.state.failWrites = true;
  assert.equal(app.send({ action: 'addMember', member }).success, false);
  assert.equal(app.properties.get('MEMBER_ID_HIGH_WATER_MARK'), '2');
  assert.equal(app.state.lockHeld, false);
  app.state.failWrites = false;
  assert.equal(app.send({ action: 'addMember', member }).memberId, '3');
  assert.ok(app.state.flushes >= 2);
});

test('two mocked script executions cannot reserve the same ID while a creation is in flight', () => {
  let second;
  let competingResult;
  const first = authenticated({ onCounterWrite: () => {
    assert.equal(first.state.lockHeld, true);
    if (second && !competingResult) competingResult = second.send({ action: 'addMember', member });
  } });
  second = authenticated({ shared: first });
  assert.equal(first.send({ action: 'addMember', member }).memberId, '2');
  assert.equal(competingResult.code, 'MEMBER_BUSY');
  assert.equal(second.send({ action: 'addMember', member }).memberId, '3');
  assert.deepEqual(first.rows.slice(1).map(row => row[0]), ['001', '2', '3']);
  assert.equal(first.state.lockHeld, false);
  // This is an interleaving simulation, not a real Google parallel-runtime test.
});

test('busy writes fail before opening a Sheet and never mutate the ID counter', () => {
  const app = authenticated();
  app.state.lockAvailable = false;
  const actions = [
    { action: 'addMember', member }, { action: 'updateMember', member: { ...member, id: '1' } },
    { action: 'renewMember', memberId: '1', membershipType: '1 Month', startDate: '2026-10-16' },
    { action: 'deleteMember', memberId: '1' },
  ];
  for (const action of actions) assert.equal(app.send(action).code, 'MEMBER_BUSY');
  assert.deepEqual(app.state.spreadsheetOpens, []);
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.properties.has('MEMBER_ID_HIGH_WATER_MARK'), false);
});

test('early renewal rejects overlap without replacing input or changing paid dates', () => {
  const app = authenticated();
  const before = JSON.stringify(app.rows);
  for (const startDate of ['2026-10-14', '2026-10-15', '2026-01-01']) {
    const request = { action: 'renewMember', memberId: '001', membershipType: '1 Month', startDate };
    assert.equal(app.send(request).code, 'RENEWAL_OVERLAP');
    assert.equal(request.startDate, startDate);
    assert.equal(JSON.stringify(app.rows), before);
  }
  const result = app.send({ action: 'renewMember', memberId: '1', membershipType: '1 Month', startDate: '2026-10-16' });
  assert.equal(result.newEndDate, '2026-11-16');
  assert.equal(app.context.formatDate(app.rows[1][6]), '2026-10-16');
  assert.equal(app.rows[1][0], '001'); // Existing Sheet ID cells are not migrated.
  assert.equal(app.rows[1][8], false);
});

test('expired renewal uses the exact manual date, including an intentional gap or backdate', () => {
  for (const startDate of ['2026-10-20', '2026-10-05']) {
    const app = authenticated();
    app.rows[1][7] = '2026-09-30';
    const result = app.send({ action: 'renewMember', memberId: '1', membershipType: '1 Year', startDate });
    assert.equal(result.success, true);
    assert.equal(result.newEndDate, startDate.replace('2026', '2027'));
    assert.equal(app.context.formatDate(app.rows[1][6]), startDate);
  }
});

test('contact-only edit preserves custom expiry; changing term recalculates and resets I', () => {
  const app = authenticated();
  app.rows[1][7] = '2027-01-31';
  app.rows[1][8] = true;
  const edit = { ...member, id: '1', startDate: '2026-07-15', membershipType: '3 Months' };
  assert.equal(app.send({ action: 'updateMember', member: edit }).success, true);
  assert.equal(app.context.formatDate(app.rows[1][7]), '2027-01-31');
  assert.equal(app.rows[1][8], false);
  assert.equal(app.send({ action: 'updateMember', member: { ...edit, startDate: '2026-01-31', membershipType: '1 Month' } }).success, true);
  assert.equal(app.context.formatDate(app.rows[1][7]), '2026-02-28');
  assert.equal(app.rows[1].length, 9);
});

test('invalid and ambiguous manual dates cannot write, allocate IDs or normalize silently', () => {
  const app = authenticated();
  for (const startDate of ['', null, 0, {}, '2026-02-29', '2026-04-31', '2026-13-01',
    '2026-00-01', '2026-1-01', '01/02/2026', '2026-01-01T00:00:00Z', '1899-12-31']) {
    for (const body of [
      { action: 'addMember', member: { ...member, startDate } },
      { action: 'updateMember', member: { ...member, id: '1', startDate } },
      { action: 'renewMember', memberId: '1', membershipType: '1 Month', startDate },
    ]) assert.equal(app.send(body).code, 'INVALID_DATE');
  }
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.properties.has('MEMBER_ID_HIGH_WATER_MARK'), false);
});

test('unsupported plans fail without Sheet writes', () => {
  const app = authenticated();
  for (const membershipType of ['12 Months', 'toString', '', null, {}, '1 month']) {
    assert.equal(app.send({ action: 'addMember', member: { ...member, membershipType } }).code, 'INVALID_PLAN');
  }
  assert.equal(app.state.sheetWrites, 0);
});

test('legacy IDs, numeric phones, text formatting and real Sheet dates are compatible', () => {
  const app = authenticated({ phoneDisplays: { 2: '09876 54321' } });
  app.rows[1][0] = 1;
  app.rows[1][2] = 987654321;
  app.rows[1][6] = new Date('2026-07-14T18:30:00Z');
  app.rows[1][7] = new Date('2026-10-14T18:30:00Z');
  const record = app.send({ action: 'getAll' }).members[0];
  assert.equal(record.id, '1');
  assert.equal(record.phone, '09876 54321');
  assert.equal(record.startDate, '2026-07-15');
  assert.equal(record.endDate, '2026-10-15');
  assert.equal(app.get({ id: '001' }).member.phone, 'XXXXXX4321');
  app.rows[1][2] = '0000000001';
  assert.equal(app.send({ action: 'getAll' }).members[0].phone, '0000000001');
});

test('numeric phones without explicit padding are strings, never guessed zeros', () => {
  const app = authenticated();
  app.rows[1][2] = 123456789;
  assert.equal(app.send({ action: 'getAll' }).members[0].phone, '123456789');
  app.rows[1][2] = 9999999999;
  assert.equal(app.send({ action: 'getAll' }).members[0].phone, '9999999999');
  app.rows[1][2] = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(app.send({ action: 'getAll' }).code, 'INVALID_PHONE');
});

test('invalid Sheet dates fail reads and renewals without leaking private data or writing', () => {
  const app = authenticated();
  for (const value of ['2026-02-31', '14/10/2026', '', 46200, new Date('invalid')]) {
    app.rows[1][7] = value;
    assert.equal(app.send({ action: 'getAll' }).code, 'INVALID_DATE');
    assert.equal(app.get({ id: '1' }).code, 'INVALID_DATE');
    assert.equal(app.send({ action: 'renewMember', memberId: '1', membershipType: '1 Month', startDate: '2026-10-16' }).code, 'INVALID_DATE');
  }
  assert.equal(app.state.sheetWrites, 0);
});

test('ambiguous legacy duplicates cannot select or mutate the wrong person', () => {
  const app = authenticated();
  app.rows.push([1, ...app.rows[1].slice(1)]);
  assert.equal(app.get({ id: '001' }).code, 'DUPLICATE_MEMBER_ID');
  assert.equal(app.send({ action: 'deleteMember', memberId: '1' }).code, 'DUPLICATE_MEMBER_ID');
  assert.equal(app.send({ action: 'addMember', member }).code, 'DUPLICATE_MEMBER_ID');
  assert.equal(app.state.sheetWrites, 0);
});

test('Asia/Kolkata expiry stays active through local end-of-day across a UTC boundary', () => {
  const app = authenticated();
  app.rows[1][7] = '2026-10-14';
  app.advance(11 * 60 * 60 * 1000 + 59 * 60 * 1000); // 23:59 in Kolkata.
  assert.equal(app.get({ id: '1' }).member.status, 'Active');
  assert.equal(app.get({ id: '1' }).member.daysRemaining, 0);
  app.advance(60 * 1000);
  assert.equal(app.send({ action: 'getAll' }).code, 'UNAUTHORIZED'); // Token expiry remains server enforced.
  const nextSession = app.login().sessionToken;
  assert.equal(app.post({ action: 'getAll', sessionToken: nextSession }).members[0].status, 'Expired');
});
