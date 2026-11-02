import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import handler from '../api/owner-identity.ts';

test('identity HTTP entry point is disabled by default, POST-only, bounded and no-store', async t => {
  const prior = process.env.OWNER_IDENTITY_ENABLED;
  delete process.env.OWNER_IDENTITY_ENABLED;
  const server = createServer((request, response) => {
    if (request.url === '/preparsed') request.body = { idToken: 'synthetic-invalid', challenge: {} };
    void handler(request, response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    if (prior === undefined) delete process.env.OWNER_IDENTITY_ENABLED; else process.env.OWNER_IDENTITY_ENABLED = prior;
    await new Promise(resolve => server.close(resolve));
  });
  const url = 'http://127.0.0.1:' + server.address().port;
  const get = await fetch(url);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  const disabled = await fetch(url, { method: 'POST', body: '{}' });
  assert.equal(disabled.status, 503);
  assert.equal(disabled.headers.get('cache-control'), 'no-store');
  process.env.OWNER_IDENTITY_ENABLED = 'true';
  for (const [path, body] of [['/', '{'], ['/', 'x'.repeat(16385)], ['/preparsed', '']]) {
    const response = await fetch(url + path, { method: 'POST', body });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { success: false, code: 'INVALID_IDENTITY' });
  }
});
