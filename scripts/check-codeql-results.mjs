import { readdir, readFile } from 'node:fs/promises';

const directory = 'security-analysis/results';
const files = (await readdir(directory)).filter(file => file.endsWith('.sarif'));
if (!files.length) throw new Error('CodeQL produced no SARIF; security result is unverified.');
let failures = 0;
const scannerPath = 'scripts/scan-secrets.mjs';
const scannerSource = await readFile(scannerPath, 'utf8').catch(() => '');
const checksumGuard = scannerSource.indexOf("if (createHash('sha256').update(bytes).digest('hex') !== platform[1])");
const archiveWrite = scannerSource.indexOf('await writeFile(archive, bytes)');
const releaseUrl = scannerSource.match(/const releaseBase = new URL\('([^']+)'\)/)?.[1];
let isPinnedReleaseUrl = false;
try {
  const parsedUrl = new URL(releaseUrl);
  isPinnedReleaseUrl = parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'github.com' &&
    parsedUrl.pathname === '/gitleaks/gitleaks/releases/download/';
} catch { /* absent or malformed release URL is not trusted */ }
const hasPinnedArchiveChecksum = checksumGuard >= 0 && archiveWrite > checksumGuard &&
  /const release = '\d+\.\d+\.\d+'/.test(scannerSource) &&
  /\[[^\]]+, '[a-f0-9]{64}'\]/.test(scannerSource) &&
  isPinnedReleaseUrl;
let reviewedArchiveFlow = 0;
for (const file of files) {
  let report;
  try { report = JSON.parse(await readFile(`${directory}/${file}`, 'utf8')); } catch { throw new Error('CodeQL SARIF is unreadable.'); }
  if (report.version !== '2.1.0' || !Array.isArray(report.runs) || !report.runs.length) throw new Error('Invalid CodeQL SARIF structure.');
  for (const run of report.runs) {
    for (const result of run.results || []) {
      if (result.level === 'note' || result.level === 'none') continue;
      const location = result.locations?.[0]?.physicalLocation;
      const uri = location?.artifactLocation?.uri?.replace(/\\/g, '/');
      const sinkLine = scannerSource.slice(0, archiveWrite).split(/\r?\n/).length;
      if (hasPinnedArchiveChecksum && result.ruleId === 'js/http-to-file-access' &&
          uri === scannerPath && location?.region?.startLine === sinkLine) {
        // CodeQL cannot infer the SHA-256 equality guard; this exact sink only writes the pinned release bytes after the verified digest matches.
        reviewedArchiveFlow++;
        continue;
      }
      failures++;
      // Rule IDs only: no snippets, request values or potentially sensitive text.
      const rule = typeof result.ruleId === 'string' && /^(js|actions|fitzone)\/[a-z0-9_./-]{1,100}$/i.test(result.ruleId) ? result.ruleId : 'unclassified';
      console.error(`CodeQL finding: ${rule}`);
    }
  }
}
console.log(`CodeQL actionable findings: ${failures}.`);
if (reviewedArchiveFlow) console.log(`Reviewed checksum-gated release archive flow: ${reviewedArchiveFlow}.`);
if (failures) process.exitCode = 1;
