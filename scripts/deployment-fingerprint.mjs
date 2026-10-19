import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validAppsScriptUrl } from './deployment-config.mjs';

export function deploymentFingerprint(value, identityKey = false) {
  if (identityKey ? !/^[a-f0-9]{64}$/.test(value) : !validAppsScriptUrl(value)) throw new Error('Invalid input; no fingerprint created.');
  return createHash('sha256').update(value).digest('hex');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Use a private interactive terminal; do not pass private values in arguments.');
  if (process.argv.slice(2).some(arg => arg !== '--identity-key')) throw new Error('Only --identity-key is supported.');
  const identityKey = process.argv.includes('--identity-key');
  process.stdout.write(identityKey ? 'Paste the production identity key (hidden): ' : 'Paste the complete production endpoint (hidden): ');
  const input = createInterface({ input: process.stdin, output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }), terminal: true });
  try {
    const value = await input.question('');
    process.stdout.write('\nSHA-256: ' + deploymentFingerprint(value, identityKey) + '\n');
  } finally { input.close(); }
}
