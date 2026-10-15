import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const result = spawnSync(process.execPath, ['--test', 'tests/*.test.mjs'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit',
  env: { ...process.env, FITZONE_TEST_BACKEND: 'bundle' },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
