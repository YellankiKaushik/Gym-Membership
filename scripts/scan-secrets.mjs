import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm, access, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';

const release = '8.30.1';
const platforms = {
  'linux-x64': ['linux_x64.tar.gz', '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'],
  'win32-x64': ['windows_x64.zip', 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'],
};
const platform = platforms[`${process.platform}-${process.arch}`];
if (!platform) throw new Error('No reviewed Gitleaks release for this platform.');
const toolDir = resolve('.security-tools', `gitleaks-${release}`);
const binary = join(toolDir, process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks');
try { await access(binary); } catch {
  if (!process.argv.includes('--download')) throw new Error('Reviewed scanner not installed. Run npm run scan:secrets -- --download to download the checksum-pinned official release.');
  const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${release}/gitleaks_${release}_${platform[0]}`);
  if (!response.ok) throw new Error('Official scanner download failed.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== platform[1]) throw new Error('Scanner checksum mismatch.');
  await mkdir(toolDir, { recursive: true });
  const archive = join(toolDir, process.platform === 'win32' ? 'release.zip' : 'release.tar.gz');
  await writeFile(archive, bytes);
  if (process.platform === 'win32') {
    // Paths are arguments passed through environment, never interpolated as shell code.
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:FITZONE_SCAN_ARCHIVE -DestinationPath $env:FITZONE_SCAN_DIRECTORY -Force'],
      { env: { ...process.env, FITZONE_SCAN_ARCHIVE: archive, FITZONE_SCAN_DIRECTORY: toolDir }, stdio: 'pipe' });
  } else execFileSync('tar', ['-xzf', archive, '-C', toolDir], { stdio: 'pipe' });
}
const directory = await mkdtemp(join(tmpdir(), 'fitzone-secret-scan-'));
try {
  const snapshot = join(directory, 'tracked');
  await mkdir(snapshot);
  // Tracked/staged files only: never read unrelated untracked or ignored user files.
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of files) {
    const target = resolve(snapshot, file);
    if (!target.startsWith(snapshot + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Unsafe tracked path.');
    await mkdir(dirname(target), { recursive: true });
    try {
      if ((await lstat(file)).isSymbolicLink()) throw new Error('Tracked symlinks require explicit scanner review.');
      await copyFile(file, target);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let failed = false;
  for (const [mode, target] of [['git', '.'], ['dir', snapshot]]) {
    const report = join(directory, `${mode}.json`);
    const result = spawnSync(binary, [mode, target, '--config', resolve('.gitleaks.toml'), '--redact=100', '--no-banner', '--log-level=error',
      '--report-format=json', `--report-path=${report}`, '--timeout=120', '--ignore-gitleaks-allow', ...(mode === 'git' ? ['--log-opts=--all'] : [])], { encoding: 'utf8' });
    let findings;
    try { findings = JSON.parse(await readFile(report, 'utf8')); } catch { throw new Error('Secret scanner did not produce a readable report.'); }
    // Never print scanner stdout/stderr, secret-bearing source lines or author emails.
    console.log(JSON.stringify({ scanner: `gitleaks ${release}`, scope: mode === 'git' ? 'local reachable history' : 'tracked working tree', exitCode: result.status,
      findings: findings.map(f => ({ rule: f.RuleID, file: f.File.startsWith(snapshot) ? f.File.slice(snapshot.length + 1) : f.File, line: f.StartLine })) }));
    if (result.status !== 0 || findings.length) failed = true;
  }
  if (failed) process.exitCode = 1;
} finally {
  // Only the directory returned by mkdtemp is removed; no user paths are accepted.
  if (directory.startsWith(join(tmpdir(), 'fitzone-secret-scan-'))) await rm(directory, { recursive: true, force: true });
}
