import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readdir, rm} from 'node:fs/promises';
import {createServer as createTcpServer} from 'node:net';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {withCaptureResources} from '../scripts/capture-resources.mjs';

function fixture(failAt) {
  const calls = [];
  const step = name => async () => {
    calls.push(name);
    if (failAt?.includes(name)) throw new Error(name);
  };
  const browser = {close: step('browser.close')};
  const server = {listen: step('server.listen'), close: step('server.close')};
  return {calls, options: {
    createServer: async () => {await step('server.create')(); return server;},
    launchBrowser: async () => {await step('browser.launch')(); return browser;}
  }, capture: async value => {assert.equal(value, browser); await step('capture')(); return 'captured';}};
}

test('capture closes browser then Vite after successful work', async () => {
  const {calls, options, capture} = fixture();
  assert.equal(await withCaptureResources(options, capture), 'captured');
  assert.deepEqual(calls, ['server.create', 'server.listen', 'browser.launch', 'capture', 'browser.close', 'server.close']);
});

test('listen or browser launch failure still closes the acquired Vite server', async () => {
  for (const failure of ['server.listen', 'browser.launch']) {
    const {calls, options, capture} = fixture([failure]);
    await assert.rejects(withCaptureResources(options, capture), new RegExp(failure));
    assert.equal(calls.at(-1), 'server.close');
    assert.ok(!calls.includes('capture'));
  }
});

test('capture failure closes both resources and browser close failure cannot leak Vite', async () => {
  for (const failures of [['capture'], ['browser.close'], ['capture', 'browser.close']]) {
    const {calls, options, capture} = fixture(failures);
    await assert.rejects(withCaptureResources(options, capture), error => {
      if (failures.length > 1) assert.deepEqual(error.errors.map(item => item.message), failures);
      else assert.equal(error.message, failures[0]);
      return true;
    });
    assert.deepEqual(calls.slice(-2), ['browser.close', 'server.close']);
  }
});

const promoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootDependenciesPresent = existsSync(resolve(promoRoot, '../node_modules/vite/dist/node/index.js')) && existsSync(resolve(promoRoot, '../node_modules/playwright/index.mjs'));
async function assertPortAvailable() {
  const server = createTcpServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4197, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('capture with an invalid CHROME_PATH exits and releases port 4197 without writing captures', {skip: !rootDependenciesPresent}, async () => {
  await assertPortAvailable();
  const directory = await mkdtemp(join(tmpdir(), 'fitzone-capture-test-'));
  const isolatedPromo = join(directory, 'promo-video');
  await mkdir(isolatedPromo);
  try {
    const result = spawnSync(process.execPath, [join(promoRoot, 'scripts/capture.mjs')], {
      cwd: isolatedPromo,
      env: {...process.env, CHROME_PATH: join(directory, 'missing-chrome.exe')},
      encoding: 'utf8',
      timeout: 15000
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /executable.*doesn.t exist/i);
    assert.deepEqual(await readdir(join(isolatedPromo, 'assets/captures')), []);
    await assertPortAvailable();
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
