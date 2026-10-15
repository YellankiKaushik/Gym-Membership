import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/membership.ts', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: module.exports, module, Date, Intl });
const ui = module.exports;

test('frontend has exactly the four supported plans', () => {
  assert.deepEqual(Array.from(ui.MEMBERSHIP_PLANS), ['1 Month', '3 Months', '6 Months', '1 Year']);
});

test('frontend dates reject manual rollovers and ambiguous formats', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-1-01', '01/02/2026', '', '1899-01-01']) {
    assert.equal(ui.isMembershipDate(date), false);
  }
  assert.equal(ui.isMembershipDate('2024-02-29'), true);
});

test('renewal defaults carry forward paid days and use today after expiry', () => {
  assert.equal(ui.suggestedRenewalStart('2026-10-31', '2026-10-15'), '2026-11-01');
  assert.equal(ui.suggestedRenewalStart('2026-10-14', '2026-10-15'), '2026-10-15');
  assert.equal(ui.suggestedRenewalStart('2026-10-15', '2026-10-15'), '2026-10-16');
  assert.equal(ui.dayAfter('2024-02-28'), '2024-02-29');
  assert.equal(ui.dayAfter('2024-02-29'), '2024-03-01');
});

test('renewal validation rejects overlap and preserves an explicit later date', () => {
  assert.match(ui.renewalDateError('2026-10-14', '2026-10-15'), /preserve paid time/);
  assert.match(ui.renewalDateError('2026-10-15', '2026-10-15'), /preserve paid time/);
  assert.match(ui.renewalDateError('2026-02-31', '2026-10-15'), /valid renewal/);
  assert.equal(ui.renewalDateError('2026-10-20', '2026-10-15'), null);
});

test('frontend default date uses gym timezone before and after India midnight', () => {
  assert.equal(ui.gymToday(new Date('2026-10-14T18:29:59Z')), '2026-10-14');
  assert.equal(ui.gymToday(new Date('2026-10-14T18:30:00Z')), '2026-10-15');
});

test('dashboard totals, active overlap, inclusive seven-day window and expiry ordering', () => {
  const members = [-1, 8, 7, 0, 1].map((days, i) => ({ id: String(i + 1), name: 'STAGING ONLY Example ' + i,
    phone: '000000000' + i, endDate: new Date(Date.parse('2026-10-15T00:00:00Z') + days * 86400000).toISOString().slice(0, 10) }));
  assert.deepEqual(JSON.parse(JSON.stringify(ui.memberSummary(members, '2026-10-15'))), { total: 5, active: 4, expiring: 3, expired: 1 });
  assert.deepEqual(Array.from(ui.filterMembers(members, 'expiring', '', '2026-10-15'), m => m.id), ['4', '5', '3']);
  assert.equal(ui.filterMembers(members, 'all', '001', '2026-10-15')[0].id, '1');
  assert.equal(ui.filterMembers(members, 'all', 'example 3', '2026-10-15')[0].id, '4');
  assert.equal(ui.filterMembers(members, 'all', '0000000004', '2026-10-15')[0].id, '5');
  assert.equal(ui.filterMembers(members, 'expired', '', '2026-10-15').length, 1);
  assert.equal(ui.filterMembers([{ ...members[0], phone: '+91 00000 00004' }], 'all', '0000000004', '2026-10-15').length, 1);
});
