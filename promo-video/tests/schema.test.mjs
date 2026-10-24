import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBackend} from '../../tests/helpers/apps-script.mjs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const stagingHeaders = read('../../staging/members.tsv').split(/\r?\n/, 1)[0].split('\t');
const diagnostics = read('../../staging/RuntimeChecks.gs');
const installation = read('../../INSTALLATION.md');
const film = read('../src/Premium.tsx');

// Presentation aliases are documented in SCHEMA_REVIEW.md. Unknown labels fail;
// this does not permit reordering columns or changing the staging diagnostic.
const keys = new Map([
  ['ID', 'id'], ['Member ID', 'id'], ['Name', 'name'], ['Phone', 'phone'],
  ['Age', 'age'], ['Weight', 'weight'],
  ['Membership Type', 'membershipType'], ['Membership Plan', 'membershipType'],
  ['Start Date', 'startDate'], ['End Date', 'endDate'], ['Notified', 'notified'],
]);
function semantics(headers) {
  assert.equal(headers.length, 9, 'The member contract has exactly nine columns');
  return headers.map(label => {
    assert.ok(keys.has(label), `Unknown column label: ${label}`);
    return keys.get(label);
  });
}
function literalStringArray(source, name) {
  const expression = source.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*(\\[[^\\]]*\\])`));
  assert.ok(expression, `Missing literal ${name} array`);
  // The inspected declarations contain only single-quoted string literals.
  return JSON.parse(expression[1].replace(/'/g, '"'));
}

test('staging fixture and its diagnostic retain the same literal nine-column headers', () => {
  assert.deepEqual(literalStringArray(diagnostics, 'expected'), stagingHeaders);
  assert.equal(stagingHeaders[5], 'Membership Type');
});

test('approved film and installation retain the same positional member contract as staging', () => {
  const installationHeader = installation.match(/```text\r?\n([^\r\n]+)\r?\n```/);
  assert.ok(installationHeader, 'Missing installation Sheet headings');
  const contract = semantics(stagingHeaders);
  assert.deepEqual(semantics(installationHeader[1].split('\t')), contract);
  assert.deepEqual(semantics(literalStringArray(film, 'cols')), contract);
});

test('backend reader and writer preserve that nine-column meaning without Google access', () => {
  const app = createBackend({}, {format: 'source'});
  app.rows[0] = stagingHeaders;
  const member = {name: 'SCHEMA TEST ONLY', phone: '0000000000', age: 29, weight: 73,
    membershipType: '3 Months', startDate: '2026-10-24'};
  const result = app.context.addMember(member);
  assert.equal(result.success, true);
  const written = app.rows.at(-1);
  assert.equal(written.length, 9);
  const expected = [result.memberId, member.name, member.phone, member.age, member.weight,
    member.membershipType, member.startDate, '2027-01-24', false];
  const normalized = [...written];
  normalized[6] = app.context.formatDate(written[6]);
  normalized[7] = app.context.formatDate(written[7]);
  assert.deepEqual(normalized, expected);
  const record = app.context.memberRecord_(written, member.phone);
  const contract = semantics(stagingHeaders);
  for (let index = 0; index < contract.length - 1; index++) {
    assert.equal(record[contract[index]], expected[index], `Incorrect ${contract[index]} position`);
  }
  assert.equal(written[8], false, 'New memberships reset the Notified flag in column I');
  assert.equal(app.state.emails.length, 0);
});
