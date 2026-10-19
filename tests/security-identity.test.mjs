import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { verifyOwnerIdentity, identitySettings } from '../server/owner-identity.ts';
import { createBackend, ownerId, password } from './helpers/apps-script.mjs';

const { privateKey, publicKey } = await generateKeyPair('ES256');
const getKey = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'synthetic-signing-key', alg: 'ES256' }] });

function fixture() {
  const key = randomBytes(32).toString('hex');
  const env = { OWNER_IDENTITY_ENABLED: 'true', OWNER_IDENTITY_ISSUER: 'https://identity.example.invalid/', OWNER_IDENTITY_JWKS_URL: 'https://identity.example.invalid/jwks',
    OWNER_IDENTITY_SUBJECT: 'synthetic-owner-subject', OWNER_IDENTITY_AUDIENCE: 'synthetic-client', OWNER_IDENTITY_REQUIRED_ACR: 'urn:synthetic:phishing-resistant',
    OWNER_IDENTITY_REQUIRED_AMR: 'hwk', GYM_INSTALLATION_ID: 'SYNTHETIC_GYM_INSTALL_01', OWNER_IDENTITY_SHARED_KEY: key };
  const app = createBackend({ OWNER_AUTH_MODE: 'managed', GYM_INSTALLATION_ID: env.GYM_INSTALLATION_ID,
    OWNER_IDENTITY_SUBJECT: env.OWNER_IDENTITY_SUBJECT, OWNER_IDENTITY_SHARED_KEY: key });
  return { app, env, begin: () => app.post({ action: 'beginOwnerIdentity', purpose: 'login' }).challenge };
}

async function tokenFor(app, challenge, claims = {}, signingKey = privateKey) {
  const now = Math.floor(app.Date.now() / 1000);
  return new SignJWT({ iss: 'https://identity.example.invalid/', aud: 'synthetic-client', sub: 'synthetic-owner-subject',
    nonce: challenge.nonce, iat: now, exp: now + 120, auth_time: now, acr: 'urn:synthetic:phishing-resistant', amr: ['hwk'], ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'synthetic-signing-key' }).sign(signingKey);
}

test('asymmetric provider verification bridges to backend session once; password fallback and proof replay fail', async () => {
  const { app, env, begin } = fixture();
  const challenge = begin();
  const idToken = await tokenFor(app, challenge);
  const proof = await verifyOwnerIdentity(idToken, challenge, env, { getKey, now: app.Date.now() });
  const response = app.post({ action: 'completeOwnerIdentity', proof });
  assert.equal(response.success, true);
  assert.equal(response.securityPolicy.authMode, 'managed');
  assert.equal(response.securityPolicy.stepUpRequired, true);
  assert.equal(app.post({ action: 'getAll', sessionToken: response.sessionToken }).success, true);
  assert.equal(app.post({ action: 'completeOwnerIdentity', proof }).code, 'INVALID_IDENTITY');
  assert.equal(app.post({ action: 'login', ownerId, password }).code, 'MANAGED_AUTH_REQUIRED');
  app.advance(30 * 60000);
  assert.equal(app.post({ action: 'getAll', sessionToken: response.sessionToken }).code, 'UNAUTHORIZED');
  const logs = app.state.logs.join('\n');
  for (const value of [idToken, proof.signature, env.OWNER_IDENTITY_SHARED_KEY, env.OWNER_IDENTITY_SUBJECT]) assert.ok(!logs.includes(value));
});

for (const [title, claims] of [
  ['wrong issuer', { iss: 'https://other.example.invalid/' }], ['wrong audience', { aud: 'other-client' }],
  ['wrong owner', { sub: 'other-owner' }], ['wrong nonce', { nonce: '0'.repeat(64) }],
  ['password-only authentication', { amr: ['pwd'] }], ['wrong assurance context', { acr: 'urn:password' }],
  ['expired token', { exp: 1 }], ['stale authentication', { auth_time: 1 }],
  ['future authentication', { auth_time: 2147483647 }], ['unbound multiple audiences', { aud: ['synthetic-client', 'other-client'] }],
  ['missing expiry', { exp: undefined }], ['authentication before challenge', { auth_time: Math.floor(Date.parse('2026-10-14T06:28:00Z') / 1000) }],
]) {
  test('provider verifier rejects ' + title, async () => {
    const { app, env, begin } = fixture(); const challenge = begin();
    const idToken = await tokenFor(app, challenge, claims);
    await assert.rejects(verifyOwnerIdentity(idToken, challenge, env, { getKey, now: app.Date.now() }));
    assert.equal(app.state.sheetReads, 0);
  });
}

test('unsigned/forged tokens, tampered bridge proofs, other gyms and wrong shared keys fail closed', async () => {
  const { app, env, begin } = fixture(); const challenge = begin();
  await assert.rejects(verifyOwnerIdentity('eyJhbGciOiJub25lIn0.e30.', challenge, env, { getKey, now: app.Date.now() }));
  const other = await generateKeyPair('ES256');
  await assert.rejects(verifyOwnerIdentity(await tokenFor(app, challenge, {}, other.privateKey), challenge, env, { getKey, now: app.Date.now() }));
  const proof = await verifyOwnerIdentity(await tokenFor(app, challenge), challenge, env, { getKey, now: app.Date.now() });
  for (const altered of [{ ...proof, signature: '0'.repeat(64) }, { ...proof, installationId: 'SYNTHETIC_OTHER_GYM_01' }, { ...proof, purpose: '0'.repeat(64) }]) {
    assert.equal(app.post({ action: 'completeOwnerIdentity', proof: altered }).code, 'INVALID_IDENTITY');
  }
  const second = fixture();
  assert.equal(second.app.post({ action: 'completeOwnerIdentity', proof }).code, 'INVALID_IDENTITY');
  app.properties.set('OWNER_IDENTITY_SHARED_KEY', randomBytes(32).toString('hex'));
  assert.equal(app.post({ action: 'completeOwnerIdentity', proof }).code, 'INVALID_IDENTITY');
  assert.equal(app.state.sheetReads, 0);
});

test('identity challenges are bounded, expire, and preserve lock behavior without touching Sheets', () => {
  const { app } = fixture();
  for (let i = 0; i < 8; i++) assert.equal(app.post({ action: 'beginOwnerIdentity', purpose: 'login' }).success, true);
  assert.equal(app.post({ action: 'beginOwnerIdentity', purpose: 'login' }).code, 'AUTH_BUSY');
  assert.equal(JSON.parse(app.properties.get('OWNER_IDENTITY_CHALLENGES')).length, 8);
  app.advance(120000);
  assert.equal(app.post({ action: 'beginOwnerIdentity', purpose: 'login' }).success, true);
  app.state.lockAvailable = false;
  assert.equal(app.post({ action: 'beginOwnerIdentity', purpose: 'login' }).code, 'AUTH_BUSY');
  assert.equal(app.state.sheetReads, 0);
  assert.equal(app.state.lockHeld, false);
});

test('managed destructive step-up requires the matching existing session and fresh one-use identity', async () => {
  const { app, env, begin } = fixture();
  let challenge = begin();
  let proof = await verifyOwnerIdentity(await tokenFor(app, challenge), challenge, env, { getKey, now: app.Date.now() });
  const sessionToken = app.post({ action: 'completeOwnerIdentity', proof }).sessionToken;
  const current = app.post({ action: 'getAll', sessionToken }).members[0];
  const data = { purpose: 'deleteMember', memberId: '1', expectedVersion: current.version, sessionToken };
  challenge = app.post({ action: 'beginOwnerIdentity', ...data }).challenge;
  proof = await verifyOwnerIdentity(await tokenFor(app, challenge), challenge, env, { getKey, now: app.Date.now() });
  assert.equal(app.post({ action: 'completeOwnerIdentity', proof }).code, 'INVALID_IDENTITY');
  const result = app.post({ action: 'completeOwnerIdentity', proof, sessionToken });
  assert.ok(result.stepUpToken);
  assert.equal(app.post({ action: 'deleteMember', memberId: '1', expectedVersion: current.version, stepUpToken: result.stepUpToken, sessionToken }).success, true);
  assert.equal(app.post({ action: 'deleteMember', memberId: '1', expectedVersion: current.version, stepUpToken: result.stepUpToken, sessionToken }).code, 'REAUTHENTICATION_REQUIRED');
});

test('identity configuration is disabled by default and preview keys must be independently scoped', () => {
  const { env } = fixture();
  assert.throws(() => identitySettings({}));
  assert.throws(() => identitySettings({ ...env, OWNER_IDENTITY_JWKS_URL: 'https://attacker.example.invalid/keys' }));
  assert.throws(() => identitySettings({ ...env, VERCEL_ENV: 'preview' }));
  assert.throws(() => identitySettings({ ...env, VERCEL_ENV: 'preview', FITZONE_PREVIEW_SYNTHETIC: '1',
    FITZONE_PRODUCTION_IDENTITY_KEY_SHA256: createHash('sha256').update(env.OWNER_IDENTITY_SHARED_KEY).digest('hex') }));
  assert.ok(identitySettings({ ...env, VERCEL_ENV: 'preview', FITZONE_PREVIEW_SYNTHETIC: '1',
    FITZONE_PRODUCTION_IDENTITY_KEY_SHA256: createHash('sha256').update(randomBytes(32)).digest('hex') }));
});
