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
  await mkdir(join(directory, 'scripts'), { recursive: true });
  const file = join(directory, 'security-analysis/results/javascript.sarif');
  const run = () => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check-codeql-results.mjs', import.meta.url))], { cwd: directory, encoding: 'utf8' });
  await writeFile(file, JSON.stringify({ version: '2.1.0', runs: [{ results: [] }] }));
  assert.equal(run().status, 0);
  await writeFile(file, JSON.stringify({ version: '2.1.0', runs: [{ results: [{ ruleId: 'js/synthetic-rule', level: 'warning', message: { text: 'SYNTHETIC_PRIVATE_DIAGNOSTIC_DO_NOT_PRINT' } }] }] }));
  const finding = run();
  assert.equal(finding.status, 1);
  assert.ok(!finding.stdout.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC') && !finding.stderr.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'));
  const scanner = [
    "const release = '8.30.1';",
    "const platforms = { 'linux-x64': ['linux_x64.tar.gz', '" + 'a'.repeat(64) + "'] };",
    "const releaseBase = new URL('https://github.com/gitleaks/gitleaks/releases/download/');",
    "if (createHash('sha256').update(bytes).digest('hex') !== platform[1]) throw new Error('Scanner checksum mismatch.');",
    'await writeFile(archive, bytes);',
  ].join('\n');
  const scannerFile = join(directory, 'scripts/scan-secrets.mjs');
  await writeFile(scannerFile, scanner);
  const sinkLine = scanner.split('\n').findIndex(line => line.includes('await writeFile(archive, bytes)')) + 1;
  await writeFile(file, JSON.stringify({ version: '2.1.0', runs: [{ results: [{
    ruleId: 'js/http-to-file-access', level: 'warning',
    locations: [{ physicalLocation: { artifactLocation: { uri: 'scripts/scan-secrets.mjs' }, region: { startLine: sinkLine } } }],
    message: { text: 'SYNTHETIC_PRIVATE_DIAGNOSTIC_DO_NOT_PRINT' },
  }] }] }));
  const reviewed = run();
  assert.equal(reviewed.status, 0);
  assert.match(reviewed.stdout, /Reviewed checksum-gated release archive flow: 1/);
  assert.ok(!reviewed.stdout.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC') && !reviewed.stderr.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'));
  await writeFile(scannerFile, scanner.replace('https://github.com/gitleaks/gitleaks/releases/download/', 'https://github.com.attacker.invalid/gitleaks/gitleaks/releases/download/'));
  assert.equal(run().status, 1, 'a release URL with an attacker-controlled host fails closed');
  await writeFile(scannerFile, scanner.replace(/if \(createHash\('sha256'\)[^\n]+\n/, ''));
  assert.equal(run().status, 1, 'the exact flow fails closed if the digest check is removed');
  await writeFile(file, '{}');
  assert.equal(run().status, 1);
  await writeFile(file, 'SYNTHETIC_PRIVATE_DIAGNOSTIC_DO_NOT_PRINT');
  const malformed = run();
  assert.equal(malformed.status, 1);
  assert.ok(!malformed.stderr.includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'));
});
