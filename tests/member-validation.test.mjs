import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from './helpers/apps-script.mjs';

const member = { name: 'STAGING ONLY Example', phone: '0000000001', age: 25, weight: 65.5,
  membershipType: '1 Month', startDate: '2026-10-15' };

test('invalid contact and measurement values cannot write or reserve IDs', () => {
  const app = createBackend();
  const sessionToken = app.login().sessionToken;
  for (const change of [{ name: '=IMPORTXML("x")' }, { name: '@unsafe' }, { name: '+' },
    { name: 'a'.repeat(121) }, { age: -1 }, { age: 2.5 }, { age: '25' }, { age: 121 },
    { weight: 0 }, { weight: Infinity }, { weight: '65' }, { weight: 501 }, { phone: '=1234567890' }]) {
    for (const action of ['addMember', 'updateMember']) {
      assert.equal(app.post({ action, sessionToken, member: { ...member, id: '1', ...change } }).code, 'INVALID_MEMBER');
    }
  }
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.properties.has('MEMBER_ID_HIGH_WATER_MARK'), false);
});

test('country-code phones stay strings; refresh reads direct Sheet edits', () => {
  const app = createBackend({ MEMBER_ID_HIGH_WATER_MARK: '3' });
  const sessionToken = app.login().sessionToken;
  const added = app.post({ action: 'addMember', sessionToken, member: { ...member, phone: '+91 00000 00001' } });
  assert.equal(added.memberId, '4');
  assert.equal(app.rows.at(-1)[2], '+91 00000 00001');
  app.rows.at(-1)[1] = 'STAGING ONLY Direct Sheet Edit';
  app.rows.at(-1)[7] = '2026-12-31';
  const refreshed = app.post({ action: 'getAll', sessionToken }).members.find(m => m.id === '4');
  assert.equal(refreshed.name, 'STAGING ONLY Direct Sheet Edit');
  assert.equal(refreshed.endDate, '2026-12-31');
  app.rows.at(-1)[5] = 'Unsupported';
  assert.equal(app.post({ action: 'getAll', sessionToken }).code, 'INVALID_PLAN');
});
