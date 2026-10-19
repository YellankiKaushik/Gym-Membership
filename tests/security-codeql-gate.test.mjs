import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('CodeQL result gate rejects findings/malformed output and never prints diagnostic snippets', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'fitzone-sarif-'));
  t.after(async () => { if (directory.startsWith(join(tmpdir(), 'fitzone-sarif-'))) await rm(directory, { recursive: true, force: true }); });
  await mkdir(join(directory, 'security-analysis/results'), { recursive: true });
  const file = join(directory, 'security-analysis/results/javascript.sarif');
  const run = () => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check-codeql-results.mjs', import.meta.url))], { cwd: directory, encoding: 'utf8' });
  await writeFile(file, JSON.stringify({ version: '2.1.0', runs: [{ results: [] }] }));
  assert.equal(run().status, 0);
  await writeFile(file, JSON.stringify({ version: '2.1.0', runs: [{ results: [{ ruleId: 'js/synthetic-rule', level: 'warning', message: { text: 'SYNTHETIC_PRIVATE_DIAGNOSTIC_DO_NOT_PRINT' } }] }] }));
  const finding = run();
  assert.equal(finding.status, 1);
  assert.ok(!finding.stdout.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC') && !finding.stderr.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'));
  await writeFile(file, '{}');
  assert.equal(run().status, 1);
  await writeFile(file, 'SYNTHETIC_PRIVATE_DIAGNOSTIC_DO_NOT_PRINT');
  const malformed = run();
  assert.equal(malformed.status, 1);
  assert.ok(!malformed.stderr.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'));
});
