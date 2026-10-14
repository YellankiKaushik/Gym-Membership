/** Owner authentication. Uses bcryptjs 3.0.3 and Apps Script platform services. */
const OWNER_AUTH = Object.freeze({
  SESSION_MS: 30 * 60 * 1000,
  FAILURE_WINDOW_MS: 15 * 60 * 1000,
  MAX_FAILURES: 5,
  MAX_SESSIONS: 20,
  SESSION_PREFIX: 'OWNER_SESSION_',
  THROTTLE_KEY: 'OWNER_LOGIN_THROTTLE'
});

function authFailure_(code, error) {
  return { success: false, code: code, error: error };
}

function ownerConfiguration_() {
  const properties = PropertiesService.getScriptProperties();
  const ownerId = properties.getProperty('OWNER_ID');
  const verifier = properties.getProperty('OWNER_PASSWORD_HASH');
  // Bound bcrypt's work factor to prevent accidental execution-time exhaustion.
  if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId !== ownerId.trim() ||
      ownerId.length > 128 || typeof verifier !== 'string' ||
      !/^\$2[aby]\$(12|13|14)\$[./A-Za-z0-9]{53}$/.test(verifier) ||
      typeof bcrypt === 'undefined') {
    return null;
  }
  return {
    properties: properties,
    ownerId: ownerId,
    verifier: verifier,
    credentialVersion: digestOwnerValue_(ownerId + '\n' + verifier)
  };
}

function digestOwnerValue_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8
  ).map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join('');
}

function parseOwnerRecord_(value) {
  try { return JSON.parse(value); } catch (_) { return null; }
}

function loginOwner_(data) {
  const config = ownerConfiguration_();
  if (!config) return authFailure_('AUTH_UNAVAILABLE', 'Owner authentication is not configured.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return authFailure_('AUTH_BUSY', 'Please try again shortly.');
  try {
    const now = Date.now();
    const saved = parseOwnerRecord_(config.properties.getProperty(OWNER_AUTH.THROTTLE_KEY));
    const throttle = saved && Number.isFinite(saved.startedAt) &&
      Number.isInteger(saved.failures) && saved.failures >= 0 &&
      now < saved.startedAt + OWNER_AUTH.FAILURE_WINDOW_MS
      ? saved : { startedAt: now, failures: 0 };
    if (throttle.failures >= OWNER_AUTH.MAX_FAILURES) {
      return authFailure_('RATE_LIMITED', 'Too many login attempts. Try again in 15 minutes.');
    }
    const validInput = typeof data.ownerId === 'string' && data.ownerId.length <= 128 &&
      typeof data.password === 'string' && data.password.length >= 12 &&
      data.password.length <= 72 && !bcrypt.truncates(data.password);
    // Check the password even for a wrong Owner ID; never disclose which field matched.
    const passwordMatches = validInput && bcrypt.compareSync(data.password, config.verifier);
    if (!passwordMatches || data.ownerId !== config.ownerId) {
      throttle.failures += 1;
      config.properties.setProperty(OWNER_AUTH.THROTTLE_KEY, JSON.stringify(throttle));
      return authFailure_('INVALID_CREDENTIALS', 'Invalid Owner ID or password.');
    }
    config.properties.deleteProperty(OWNER_AUTH.THROTTLE_KEY);
    const records = config.properties.getProperties();
    const active = [];
    Object.keys(records).forEach(function (key) {
      if (key.indexOf(OWNER_AUTH.SESSION_PREFIX) !== 0) return;
      const session = parseOwnerRecord_(records[key]);
      if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now ||
          session.credentialVersion !== config.credentialVersion) {
        config.properties.deleteProperty(key);
      } else {
        active.push({ key: key, expiresAt: session.expiresAt });
      }
    });
    active.sort(function (a, b) { return a.expiresAt - b.expiresAt; });
    while (active.length >= OWNER_AUTH.MAX_SESSIONS) {
      config.properties.deleteProperty(active.shift().key);
    }
    // getUuid is Google's platform randomUUID, not Math.random or a custom PRNG.
    const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    const expiresAt = now + OWNER_AUTH.SESSION_MS;
    config.properties.setProperty(OWNER_AUTH.SESSION_PREFIX + digestOwnerValue_(token), JSON.stringify({
      expiresAt: expiresAt,
      credentialVersion: config.credentialVersion
    }));
    return { success: true, sessionToken: token, expiresAt: expiresAt };
  } finally {
    lock.releaseLock();
  }
}

function validateOwnerSession_(token) {
  const config = ownerConfiguration_();
  if (!config || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = OWNER_AUTH.SESSION_PREFIX + digestOwnerValue_(token);
  const session = parseOwnerRecord_(config.properties.getProperty(key));
  if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now() ||
      session.credentialVersion !== config.credentialVersion) {
    config.properties.deleteProperty(key);
    return null;
  }
  return { properties: config.properties, key: key };
}
