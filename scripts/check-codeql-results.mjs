import { readdir, readFile } from 'node:fs/promises';

const directory = 'security-analysis/results';
const files = (await readdir(directory)).filter(file => file.endsWith('.sarif'));
if (!files.length) throw new Error('CodeQL produced no SARIF; security result is unverified.');
let failures = 0;
for (const file of files) {
  let report;
  try { report = JSON.parse(await readFile(`${directory}/${file}`, 'utf8')); } catch { throw new Error('CodeQL SARIF is unreadable.'); }
  if (report.version !== '2.1.0' || !Array.isArray(report.runs) || !report.runs.length) throw new Error('Invalid CodeQL SARIF structure.');
  for (const run of report.runs) {
    for (const result of run.results || []) {
      if (result.level === 'note' || result.level === 'none') continue;
      failures++;
      // Rule IDs only: no snippets, request values or potentially sensitive text.
      const rule = typeof result.ruleId === 'string' && /^(js|actions|fitzone)\/[a-z0-9_./-]{1,100}$/i.test(result.ruleId) ? result.ruleId : 'unclassified';
      console.error(`CodeQL finding: ${rule}`);
    }
  }
}
console.log(`CodeQL actionable findings: ${failures}.`);
if (failures) process.exitCode = 1;
