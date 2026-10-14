// Run locally in a private terminal. Never pass the password through command arguments.
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import vm from 'node:vm';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  throw new Error('Use an interactive private terminal; piped password input is disabled.');
}
const context = vm.createContext({ crypto: webcrypto, setTimeout, clearTimeout });
vm.runInContext(readFileSync(new URL('../backend/Bcrypt.gs', import.meta.url), 'utf8'), context);
let hidden = false;
const output = new Writable({ write(chunk, encoding, callback) {
  if (!hidden) process.stdout.write(chunk, encoding);
  callback();
} });
const input = createInterface({ input: process.stdin, output, terminal: true });
try {
  const ownerId = (await input.question('Owner ID: ')).trim();
  process.stdout.write('Password (hidden): ');
  hidden = true;
  const password = await input.question('');
  process.stdout.write('\nConfirm password (hidden): ');
  const confirmation = await input.question('');
  hidden = false;
  process.stdout.write('\n');
  if (!ownerId || ownerId.length > 128) throw new Error('Owner ID must contain 1–128 characters.');
  if (password.length < 12 || context.bcrypt.truncates(password)) {
    throw new Error('Use at least 12 characters and at most 72 UTF-8 bytes.');
  }
  if (password !== confirmation) throw new Error('Passwords do not match.');
  const verifier = context.bcrypt.hashSync(password, 12);
  console.log('Set these Script Properties privately. Do not commit or share this output.');
  console.log('OWNER_ID=' + ownerId);
  console.log('OWNER_PASSWORD_HASH=' + verifier);
} finally {
  hidden = false;
  input.close();
}
