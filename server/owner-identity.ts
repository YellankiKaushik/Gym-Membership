import { createHash, createHmac } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

export interface IdentityChallenge {
  id: string; nonce: string; purpose: string; installationId: string; expiresAt: number;
}

export function identitySettings(env: NodeJS.ProcessEnv) {
  const issuer = env.OWNER_IDENTITY_ISSUER || '';
  const jwks = env.OWNER_IDENTITY_JWKS_URL || '';
  const subject = env.OWNER_IDENTITY_SUBJECT || '';
  const audience = env.OWNER_IDENTITY_AUDIENCE || '';
  const installationId = env.GYM_INSTALLATION_ID || '';
  const key = env.OWNER_IDENTITY_SHARED_KEY || '';
  const acr = env.OWNER_IDENTITY_REQUIRED_ACR || '';
  const amr = (env.OWNER_IDENTITY_REQUIRED_AMR || '').split(',').map(value => value.trim()).filter(Boolean);
  if (env.OWNER_IDENTITY_ENABLED !== 'true' || !subject || subject.length > 256 || !audience || !acr ||
      amr.length === 0 || amr.length > 4 || amr.some(value => !/^[a-zA-Z0-9:_-]{1,64}$/.test(value)) ||
      !/^[A-Za-z0-9_-]{16,64}$/.test(installationId) || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Identity configuration unavailable.');
  let issuerUrl: URL, jwksUrl: URL;
  try { issuerUrl = new URL(issuer); jwksUrl = new URL(jwks); } catch { throw new Error('Identity configuration unavailable.'); }
  if (issuerUrl.protocol !== 'https:' || jwksUrl.protocol !== 'https:' || issuerUrl.origin !== jwksUrl.origin ||
      [issuerUrl, jwksUrl].some(url => url.username || url.password || url.hash || url.search)) throw new Error('Identity configuration unavailable.');
  if (env.VERCEL_ENV === 'preview' && (env.FITZONE_PREVIEW_SYNTHETIC !== '1' ||
      !/^[a-f0-9]{64}$/.test(env.FITZONE_PRODUCTION_IDENTITY_KEY_SHA256 || '') ||
      createHash('sha256').update(key).digest('hex') === env.FITZONE_PRODUCTION_IDENTITY_KEY_SHA256)) throw new Error('Preview identity isolation unavailable.');
  return { issuer, jwks, subject, audience, installationId, key, acr, amr };
}

const resolvers = new Map<string, JWTVerifyGetKey>();

// No unverified token claim controls issuer, key URL, owner identity or gym.
export async function verifyOwnerIdentity(idToken: unknown, challenge: IdentityChallenge, env: NodeJS.ProcessEnv,
  options: { now?: number; getKey?: JWTVerifyGetKey } = {}) {
  const settings = identitySettings(env);
  const now = options.now ?? Date.now();
  if (typeof idToken !== 'string' || idToken.length > 12000 || !challenge ||
      !/^[a-f0-9]{64}$/.test(challenge.id) || !/^[a-f0-9]{64}$/.test(challenge.nonce) ||
      !/^(login|[a-f0-9]{64})$/.test(challenge.purpose) || challenge.installationId !== settings.installationId ||
      !Number.isSafeInteger(challenge.expiresAt) || challenge.expiresAt <= now || challenge.expiresAt > now + 125000) throw new Error('Invalid identity.');
  let getKey = options.getKey || resolvers.get(settings.jwks);
  if (!getKey) {
    getKey = createRemoteJWKSet(new URL(settings.jwks), { timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000 });
    // Server configuration is trusted, but keep warm-process memory bounded.
    if (resolvers.size >= 4) resolvers.clear();
    resolvers.set(settings.jwks, getKey);
  }
  const { payload } = await jwtVerify(idToken, getKey, { issuer: settings.issuer, audience: settings.audience,
    algorithms: ['RS256', 'ES256'], requiredClaims: ['exp', 'iat', 'auth_time', 'sub', 'nonce', 'acr', 'amr'],
    currentDate: new Date(now), maxTokenAge: '5m', clockTolerance: 5 });
  if (payload.sub !== settings.subject || payload.nonce !== challenge.nonce || payload.acr !== settings.acr ||
      !Array.isArray(payload.amr) || !settings.amr.every(method => (payload.amr as unknown[]).includes(method)) ||
      typeof payload.auth_time !== 'number' || !Number.isSafeInteger(payload.auth_time) ||
      payload.auth_time * 1000 < now - 300000 || payload.auth_time * 1000 > now + 5000 ||
      payload.auth_time * 1000 < challenge.expiresAt - 125000 ||
      (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== settings.audience) ||
      (payload.azp !== undefined && payload.azp !== settings.audience)) throw new Error('Invalid identity.');
  const proof = { v: 1, installationId: settings.installationId, subjectHash: createHash('sha256').update(settings.subject).digest('hex'),
    id: challenge.id, nonce: challenge.nonce, purpose: challenge.purpose, authenticatedAt: payload.auth_time * 1000, expiresAt: now + 60000 };
  const signature = createHmac('sha256', settings.key).update(JSON.stringify([proof.v, proof.installationId, proof.subjectHash,
    proof.id, proof.nonce, proof.purpose, proof.authenticatedAt, proof.expiresAt])).digest('hex');
  return { ...proof, signature };
}
