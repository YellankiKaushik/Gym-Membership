import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBackend } from './helpers/apps-script.mjs';

const member = { name: 'STAGING ONLY Gamma', phone: '0000000002', age: 25, weight: 65,
  membershipType: '3 Months', startDate: '2026-10-15' };

for (const name of ['Members', 'Sheet1', 'Gym Members 2026']) {
  test('every Sheet operation selects only the configured tab: ' + name, () => {
    const app = createBackend({ MEMBER_SHEET_NAME: name }, { sheetName: name });
    // Model web-app execution with neither active-context method present at all.
    delete app.context.SpreadsheetApp.getActiveSheet;
    delete app.context.SpreadsheetApp.getActiveSpreadsheet;
    const { sessionToken } = app.login();
    assert.deepEqual(app.state.spreadsheetOpens, []);
    assert.equal(app.get({ action: 'lookup', id: '001' }).success, true);
    assert.equal(app.post({ action: 'getAll', sessionToken }).members.length, 1);
    const added = app.post({ action: 'addMember', member, sessionToken });
    assert.equal(added.memberId, '2');
    assert.equal(app.rows[2].length, 9);
    assert.equal(app.rows[2][8], false);
    app.rows[2][8] = true;
    assert.equal(app.post({ action: 'updateMember', sessionToken,
      member: { ...member, id: '2', name: 'STAGING ONLY Changed' } }).success, true);
    assert.equal(app.rows[2][8], true);
    app.rows[2][8] = true;
    assert.equal(app.post({ action: 'renewMember', sessionToken, memberId: '2',
      membershipType: '6 Months', startDate: '2027-01-16' }).success, true);
    assert.equal(app.rows[2].length, 9);
    assert.equal(app.rows[2][8], false);
    assert.equal(app.context.formatDate(app.rows[2][7]), '2027-07-16');
    assert.equal(app.post({ action: 'deleteMember', sessionToken, memberId: '2' }).success, true);
    assert.equal(app.rows.length, 2);
    const beforeEmail = app.rows[1].slice(0, 8);
    // Gmail is mocked: this cannot send an email or execute a real trigger.
    app.context.checkMembershipExpiries();
    assert.equal(app.rows[1].length, 9);
    assert.deepEqual(app.rows[1].slice(0, 8), beforeEmail);
    assert.equal(app.rows[1][8], true);
    assert.equal(app.state.emails.length, 1);
    assert.equal(app.state.spreadsheetOpens.length, 7);
    assert.deepEqual(app.state.spreadsheetOpens, Array(7).fill('SYNTHETIC-STAGING-BOOK'));
    assert.deepEqual(app.state.tabSelections, Array(7).fill(name));
  });
}

for (const [title, overrides, opens] of [
  ['missing ID', { SPREADSHEET_ID: undefined }, 0],
  ['empty ID', { SPREADSHEET_ID: '' }, 0],
  ['whitespace ID', { SPREADSHEET_ID: '   ' }, 0],
  ['URL instead of ID', { SPREADSHEET_ID: 'https://example.invalid/private-id' }, 0],
  ['incorrect or inaccessible ID', { SPREADSHEET_ID: 'PRIVATE-WRONG-ID' }, 7],
  ['missing tab property', { MEMBER_SHEET_NAME: undefined }, 0],
  ['empty tab property', { MEMBER_SHEET_NAME: '' }, 0],
  ['whitespace tab property', { MEMBER_SHEET_NAME: '   ' }, 0],
  ['tab does not exist', { MEMBER_SHEET_NAME: 'Private nonexistent tab' }, 7],
]) {
  test('Sheet configuration fails safely for ' + title, () => {
    const app = createBackend(overrides);
    const before = JSON.stringify(app.rows);
    const { sessionToken } = app.login();
    const responses = [app.get({ action: 'lookup', id: '001' }),
      ...[
        { action: 'getAll' }, { action: 'addMember', member },
        { action: 'updateMember', member: { ...member, id: '001' } },
        { action: 'renewMember', memberId: '001', membershipType: '6 Months', startDate: '2026-10-15' },
        { action: 'deleteMember', memberId: '001' },
      ].map(body => app.post({ ...body, sessionToken }))];
    for (const response of responses) {
      assert.equal(response.success, false);
      assert.equal(response.code, 'MEMBER_SHEET_UNAVAILABLE');
      assert.deepEqual(Object.keys(response).sort(), ['code', 'error', 'success']);
      assert.ok(!JSON.stringify(response).includes('PRIVATE-WRONG-ID'));
      assert.ok(!JSON.stringify(response).includes('Private nonexistent tab'));
      assert.ok(!JSON.stringify(response).includes('private-id'));
    }
    assert.throws(() => app.context.checkMembershipExpiries(), /^Error: MEMBER_SHEET_UNAVAILABLE$/);
    assert.equal(app.state.spreadsheetOpens.length, opens);
    assert.equal(app.state.sheetReads, 0);
    assert.equal(app.state.sheetWrites, 0);
    assert.equal(app.state.emails.length, 0);
    assert.equal(JSON.stringify(app.rows), before);
  });
}

test('unauthorized actions cannot open or select any spreadsheet or tab', () => {
  const app = createBackend({ SPREADSHEET_ID: 'PRIVATE-WRONG-ID' });
  for (const action of ['getAll', 'addMember', 'updateMember', 'renewMember', 'deleteMember']) {
    for (const credential of [{}, { sessionToken: '0'.repeat(64) }]) {
      assert.equal(app.post({ action, member, ...credential }).code, 'UNAUTHORIZED');
    }
    assert.equal(app.get({ action }).success, false);
  }
  assert.deepEqual(app.state.spreadsheetOpens, []);
  assert.deepEqual(app.state.tabSelections, []);
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.sheetWrites, 0);
});

test('Sheet configuration is read afresh instead of retaining a previously selected tab', () => {
  const app = createBackend();
  assert.equal(app.get({ id: '001' }).success, true);
  app.properties.set('MEMBER_SHEET_NAME', 'Missing');
  assert.equal(app.get({ id: '001' }).code, 'MEMBER_SHEET_UNAVAILABLE');
  app.properties.set('MEMBER_SHEET_NAME', 'Members');
  assert.equal(app.get({ id: '001' }).success, true);
});

test('backend source contains no active spreadsheet fallback', () => {
  const source = readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /SpreadsheetApp\s*\.\s*getActive/);
});
