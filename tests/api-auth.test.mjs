import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createBackend, ownerId, password } from './helpers/apps-script.mjs';

const source = ts.transpileModule(readFileSync(new URL('../src/api/gymApi.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const endpoint = 'https://script.google.com/macros/s/SYNTHETIC_TEST_ONLY/exec';

function createClient(timers = { setTimeout, clearTimeout }) {
  const backend = createBackend();
  const local = new Map([['gymApiUrl', endpoint]]);
  const session = new Map();
  const storage = map => ({
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  });
  const requests = [];
  let fetchOverride;
  const context = vm.createContext({
    exports: {}, Date: backend.Date, URL, Error, TypeError, Event, AbortController,
    window: new EventTarget(), localStorage: storage(local), sessionStorage: storage(session),
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (fetchOverride) return fetchOverride(url, options);
      const response = options.method === 'POST'
        ? backend.post(JSON.parse(options.body))
        : backend.get(Object.fromEntries(new URL(url).searchParams));
      return { ok: true, json: async () => response };
    },
  });
  vm.runInContext(source, context, { filename: 'gymApi.js' });
  return {
    api: context.exports, backend, local, session, requests,
    setFetch: callback => { fetchOverride = callback; },
  };
}

test('renewal client receives a normalized newEndDate from the protected backend contract', async () => {
  const client = createClient();
  assert.equal((await client.api.loginOwner(ownerId, password)).success, true);
  const result = await client.api.renewMembership({
    memberId: '1', membershipType: '1 Month', startDate: '2026-10-16',
  });
  assert.equal(result.success, true);
  assert.equal(result.newEndDate, '2026-11-16');
  assert.equal(client.backend.context.formatDate(client.backend.rows[1][6]), '2026-10-16');
  assert.equal(client.backend.rows[1].length, 9);
});

test('client logs in with a dedicated POST and stores only the session', async () => {
  const client = createClient();
  client.session.set('gymAdminPassword', 'legacy-synthetic-password');
  assert.equal((await client.api.loginOwner(ownerId, password)).success, true);
  assert.equal(client.requests[0].options.method, 'POST');
  assert.equal(JSON.parse(client.requests[0].options.body).action, 'login');
  assert.equal(client.session.has('gymAdminPassword'), false);
  assert.ok(!JSON.stringify([...client.session]).includes(password));
  assert.equal(client.api.isAdminLoggedIn(), true);
});

test('login failures and malformed success responses never create a session', async () => {
  const client = createClient();
  assert.equal((await client.api.loginOwner(ownerId, 'wrong-password!')).success, false);
  client.setFetch(async () => ({ ok: true, json: async () => ({ success: true }) }));
  assert.equal((await client.api.loginOwner(ownerId, password)).code, 'INVALID_RESPONSE');
  assert.equal(client.api.isAdminLoggedIn(), false);
});

test('all admin operations use token POST bodies without permanent passwords', async () => {
  const client = createClient();
  await client.api.loginOwner(ownerId, password);
  const member = { name: 'Synthetic', phone: '8888888888', age: 25, weight: 70,
    membershipType: '3 Months', startDate: '2026-10-15' };
  await client.api.getAllMembers();
  await client.api.addMember(member);
  await client.api.updateMember({ ...member, id: '002' });
  await client.api.renewMembership({ memberId: '002', membershipType: '3 Months', startDate: '2026-10-15' });
  await client.api.deleteMember('002');
  const token = JSON.parse(client.session.get('gymOwnerSession')).sessionToken;
  for (const { url, options } of client.requests.slice(1)) {
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.sessionToken, token);
    assert.equal('password' in body, false);
    assert.ok(!url.includes(token));
    assert.ok(!url.includes(password));
    assert.equal(new URL(url).search, '');
  }
});

test('lookup sends no owner credentials while signed in and exposes no age/weight', async () => {
  const client = createClient();
  await client.api.loginOwner(ownerId, password);
  const result = await client.api.lookupMember('001');
  assert.equal(result.success, true);
  assert.equal('age' in result.member, false);
  assert.equal('weight' in result.member, false);
  const request = client.requests.at(-1);
  assert.equal(request.options.body, undefined);
  assert.equal(new URL(request.url).searchParams.get('action'), 'lookup');
  assert.equal(new URL(request.url).searchParams.has('password'), false);
  assert.equal(new URL(request.url).searchParams.has('sessionToken'), false);
});

test('logout clears browser state immediately and revokes the captured server session', async () => {
  const client = createClient();
  await client.api.loginOwner(ownerId, password);
  const token = JSON.parse(client.session.get('gymOwnerSession')).sessionToken;
  const logout = client.api.logoutOwner();
  assert.equal(client.api.isAdminLoggedIn(), false);
  assert.equal((await logout).success, true);
  assert.equal(client.backend.post({ action: 'getAll', sessionToken: token }).code, 'UNAUTHORIZED');
  const count = client.requests.length;
  assert.equal((await client.api.getAllMembers()).code, 'UNAUTHORIZED');
  assert.equal(client.requests.length, count);
});

test('client expiry clears storage and backend expiry cannot be extended through browser state', async () => {
  const client = createClient();
  await client.api.loginOwner(ownerId, password);
  const saved = JSON.parse(client.session.get('gymOwnerSession'));
  client.backend.advance(30 * 60 * 1000);
  assert.equal(client.api.isAdminLoggedIn(), false);
  client.session.set('gymOwnerSession', JSON.stringify({ ...saved, expiresAt: client.backend.Date.now() + 60000 }));
  assert.equal((await client.api.getAllMembers()).code, 'UNAUTHORIZED');
  assert.equal(client.session.has('gymOwnerSession'), false);
});

test('endpoint changes and old password-only sessions do not authorize requests', async () => {
  const client = createClient();
  client.session.set('gymAdminPassword', password);
  assert.equal(client.api.isAdminLoggedIn(), false);
  assert.equal(client.session.has('gymAdminPassword'), false);
  await client.api.loginOwner(ownerId, password);
  client.api.setApiUrl('https://script.google.com/macros/s/OTHER_TEST_ONLY/exec');
  assert.equal(client.api.isAdminLoggedIn(), false);
});

test('login rejects arbitrary endpoints and query-bearing endpoints before sending credentials', async () => {
  const client = createClient();
  for (const url of ['https://example.invalid/exec', endpoint + '?password=synthetic',
    'https://synthetic:secret@script.google.com/macros/s/TEST/exec', 'http://script.google.com/macros/s/TEST/exec']) {
    client.local.set('gymApiUrl', url);
    assert.equal((await client.api.loginOwner(ownerId, password)).code, 'NOT_CONFIGURED');
    assert.equal((await client.api.lookupMember('001')).code, 'NOT_CONFIGURED');
  }
  assert.equal(client.requests.length, 0);
});

test('a lost mutation response is not automatically retried', async () => {
  const client = createClient();
  await client.api.loginOwner(ownerId, password);
  client.requests.length = 0;
  client.setFetch(async () => { throw new TypeError('Synthetic lost response'); });
  assert.equal((await client.api.addMember({})).success, false);
  assert.equal(client.requests.length, 1);
});

test('malformed storage and malformed JSON responses fail safely', async () => {
  const client = createClient();
  client.session.set('gymOwnerSession', '{');
  assert.equal(client.api.isAdminLoggedIn(), false);
  client.setFetch(async () => ({ ok: true, json: async () => null }));
  assert.equal((await client.api.loginOwner(ownerId, password)).code, 'INVALID_RESPONSE');
  assert.equal(client.api.isAdminLoggedIn(), false);
});

test('late unauthorized responses from an older session cannot clear a newer login', async () => {
  const client = createClient();
  await client.api.loginOwner(ownerId, password);
  let resolveOld;
  client.setFetch(() => new Promise(resolve => { resolveOld = resolve; }));
  const oldRequest = client.api.getAllMembers();
  client.setFetch(undefined);
  assert.equal((await client.api.loginOwner(ownerId, password)).success, true);
  const newSession = client.session.get('gymOwnerSession');
  resolveOld({ ok: true, json: async () => ({ success: false, code: 'UNAUTHORIZED' }) });
  await oldRequest;
  assert.equal(client.session.get('gymOwnerSession'), newSession);
});

test('logout cancels an outstanding login and revokes its eventual server token', async () => {
  const client = createClient();
  let completeLogin;
  client.setFetch(() => new Promise(resolve => { completeLogin = resolve; }));
  const pending = client.api.loginOwner(ownerId, password);
  await client.api.logoutOwner();
  client.setFetch(undefined);
  const late = client.backend.login();
  completeLogin({ ok: true, json: async () => late });
  assert.equal((await pending).code, 'LOGIN_CANCELLED');
  assert.equal(client.api.isAdminLoggedIn(), false);
  assert.equal(client.backend.post({ action: 'getAll', sessionToken: late.sessionToken }).code, 'UNAUTHORIZED');
});

test('an older login cannot replace a newer successful session', async () => {
  const client = createClient();
  let completeOld;
  client.setFetch(() => new Promise(resolve => { completeOld = resolve; }));
  const old = client.api.loginOwner(ownerId, password);
  client.setFetch(undefined);
  assert.equal((await client.api.loginOwner(ownerId, password)).success, true);
  const latest = client.session.get('gymOwnerSession');
  const stale = client.backend.login();
  completeOld({ ok: true, json: async () => stale });
  assert.equal((await old).code, 'LOGIN_CANCELLED');
  assert.equal(client.session.get('gymOwnerSession'), latest);
  assert.equal(client.backend.post({ action: 'getAll', sessionToken: stale.sessionToken }).code, 'UNAUTHORIZED');
});

test('endpoint changes cancel pending login even when the original endpoint is restored', async () => {
  const client = createClient();
  let complete;
  client.setFetch(() => new Promise(resolve => { complete = resolve; }));
  const pending = client.api.loginOwner(ownerId, password);
  client.api.setApiUrl('https://script.google.com/macros/s/OTHER_TEST_ONLY/exec');
  client.api.setApiUrl(endpoint);
  client.setFetch(undefined);
  const late = client.backend.login();
  complete({ ok: true, json: async () => late });
  assert.equal((await pending).code, 'LOGIN_CANCELLED');
  assert.equal(client.api.isAdminLoggedIn(), false);
});

test('request timeout remains active until the JSON response body has been read', async () => {
  const active = new Map();
  let nextId = 0;
  const client = createClient({
    setTimeout: callback => { const id = ++nextId; active.set(id, callback); return id; },
    clearTimeout: id => active.delete(id),
  });
  let finishBody;
  client.setFetch(async (_url, options) => ({ ok: true, json: () => new Promise((resolve, reject) => {
    finishBody = resolve;
    options.signal.addEventListener('abort', () => {
      const error = new Error('Synthetic body timeout');
      error.name = 'AbortError';
      reject(error);
    });
  }) }));
  const pending = client.api.loginOwner(ownerId, password);
  await new Promise(setImmediate);
  try {
    assert.equal(active.size, 1);
    [...active.values()][0]();
    assert.equal((await pending).error, 'Request timed out');
    assert.equal(active.size, 0);
  } finally {
    finishBody(null);
    await pending;
  }
});
