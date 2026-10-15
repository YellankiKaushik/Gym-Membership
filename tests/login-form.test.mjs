import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('React login renders associated Owner ID and password fields without restoring a legacy password', async () => {
  const bundle = await build({
    entryPoints: ['src/pages/Adminpanel.tsx'], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', logLevel: 'silent',
    loader: { '.jpg': 'dataurl' },
  });
  const session = new Map([['gymAdminPassword', 'synthetic-old-password']]);
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module, exports: module.exports, require: createRequire(import.meta.url),
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      removeItem: key => session.delete(key),
    },
    localStorage: { getItem: () => '' },
    window: new EventTarget(), Event,
  });
  const html = renderToStaticMarkup(React.createElement(module.exports.default));
  assert.match(html, /for="owner-id"/);
  assert.match(html, /id="owner-id"/);
  assert.match(html, /autoComplete="username"/);
  assert.match(html, /for="owner-password"/);
  assert.match(html, /id="owner-password"/);
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="current-password"/);
  assert.ok(!html.includes('synthetic-old-password'));
  assert.equal(session.has('gymAdminPassword'), false);
});
