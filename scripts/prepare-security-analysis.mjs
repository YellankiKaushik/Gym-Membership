import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkBundleGlobals } from './generate-apps-script.mjs';

// CodeQL's JS extraction must not be assumed to understand the .gs extension.
// Exact JS mirrors explicitly include all maintained non-vendor backend logic.
await mkdir('security-analysis/apps-script', { recursive: true });
const manifest = [];
for (const name of ['Auth', 'Code']) {
  const source = (await readFile(`backend/${name}.gs`, 'utf8')).replace(/\r\n?/g, '\n');
  checkBundleGlobals(source);
  await writeFile(`security-analysis/apps-script/${name}.js`, source);
  manifest.push({ source: `backend/${name}.gs`, mirror: `${name}.js`, sha256: createHash('sha256').update(source).digest('hex') });
}
await writeFile('security-analysis/manifest.json', JSON.stringify(manifest, null, 2));
console.log('Prepared byte-identical JavaScript mirrors: Auth.gs, Code.gs. Vendored bcrypt is covered by integrity tests, not claimed as CodeQL coverage.');
