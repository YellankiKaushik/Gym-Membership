import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('vendored bcrypt algorithm payload matches the integrity-verified upstream 3.0.3 file', () => {
  const source = readFileSync(new URL('../backend/Bcrypt.gs', import.meta.url), 'utf8');
  const firstPayloadLine = source.indexOf('// GENERATED FILE. DO NOT EDIT.');
  const lastPayloadLine = source.lastIndexOf('\n})(function () { throw new Error(');
  assert.ok(firstPayloadLine > 0 && lastPayloadLine > firstPayloadLine);
  const original = source.slice(firstPayloadLine, lastPayloadLine);
  assert.equal(createHash('sha256').update(original).digest('hex'),
    'ed01b52b436504d8bb7086d93fee4bd8edbb22d8ed88e1b456e0c604f30e79c4');
});
