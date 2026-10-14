import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createBackend, password } from './helpers/apps-script.mjs';

const diagnostics = readFileSync(new URL('../staging/RuntimeChecks.gs', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('../staging/members.tsv', import.meta.url), 'utf8');

for (const order of [
  ['Code.gs', 'Auth.gs', 'Bcrypt.gs'], ['Code.gs', 'Bcrypt.gs', 'Auth.gs'],
  ['Auth.gs', 'Code.gs', 'Bcrypt.gs'], ['Auth.gs', 'Bcrypt.gs', 'Code.gs'],
  ['Bcrypt.gs', 'Auth.gs', 'Code.gs'], ['Bcrypt.gs', 'Code.gs', 'Auth.gs'],
]) {
  test('mock runtime loads the three files in order: ' + order.join(', '), () => {
    const app = createBackend({}, { fileOrder: order });
    assert.equal(app.login().success, true);
    assert.equal(app.state.sheetReads, 0);
  });
}

test('staging fixtures contain only nine columns and deliberately non-contactable synthetic phones', () => {
  const rows = fixture.trim().split(/\r?\n/).map(row => row.split('\t'));
  assert.equal(rows.length, 3);
  for (const row of rows) assert.equal(row.length, 9);
  assert.equal(rows[0][8], 'Notified');
  for (const row of rows.slice(1)) {
    assert.match(row[1], /^STAGING ONLY /);
    assert.match(row[2], /^0{9}[01]$/);
  }
});

test('staging diagnostics fail closed without a marker or with the wrong spreadsheet', () => {
  for (const properties of [{}, { STAGING_ONLY: 'true', STAGING_SHEET_ID: 'WRONG-TEST-ID' }]) {
    const app = createBackend(properties);
    vm.runInContext(diagnostics, app.context);
    assert.throws(() => app.context.checkStagingFiles(), /staging|Staging/);
    assert.equal(app.state.sheetReads, 0);
    assert.equal(app.state.sheetWrites, 0);
    assert.equal(app.state.emails.length, 0);
  }
});

test('staging diagnostics report booleans/timings only and discard the temporary benchmark password', () => {
  const app = createBackend({ STAGING_ONLY: 'true', STAGING_SHEET_ID: 'SYNTHETIC-STAGING-BOOK',
    STAGING_BENCHMARK_PASSWORD: password });
  app.rows[0] = fixture.split(/\r?\n/)[0].split('\t');
  vm.runInContext(diagnostics, app.context);
  const files = app.context.checkStagingFiles();
  for (const value of Object.values(files)) assert.equal(value, true);
  const report = app.context.benchmarkStagingAuthentication();
  assert.equal(report.samples, 5);
  assert.equal(app.properties.has('STAGING_BENCHMARK_PASSWORD'), false);
  assert.equal([...app.properties.keys()].filter(key => key.startsWith('OWNER_SESSION_')).length, 0);
  const logs = app.state.logs.join('\n');
  assert.ok(!logs.includes(password));
  assert.ok(!logs.includes('sessionToken'));
  assert.ok(!logs.includes('SYNTHETIC-STAGING-BOOK'));
  assert.equal(app.state.sheetWrites, 0);
  assert.equal(app.state.emails.length, 0);
  // Clock is frozen in the mock; these zero timings are NOT a Google benchmark.
  assert.equal(report.maxMs, 0);
});

test('missing active Sheet context returns a safe failure rather than proving web-app CRUD works', () => {
  const app = createBackend();
  app.context.SpreadsheetApp.getActiveSheet = () => null;
  const { sessionToken } = app.login();
  assert.equal(app.post({ action: 'getAll', sessionToken }).success, false);
  assert.equal(app.get({ action: 'lookup', id: '001' }).success, false);
  assert.equal(app.state.sheetWrites, 0);
});
