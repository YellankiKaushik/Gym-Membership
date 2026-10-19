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
  const mode = properties.getProperty('OWNER_AUTH_MODE') || 'legacy';
  // Bound bcrypt's work factor to prevent accidental execution-time exhaustion.
  if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId !== ownerId.trim() ||
      ownerId.length > 128 || typeof verifier !== 'string' ||
      !/^\$2[aby]\$(12|13|14)\$[./A-Za-z0-9]{53}$/.test(verifier) ||
      typeof bcrypt === 'undefined' || !['legacy', 'managed'].includes(mode)) {
    return null;
  }
  const credentialVersion = digestOwnerValue_([ownerId, verifier, mode,
    properties.getProperty('OWNER_IDENTITY_SUBJECT'), properties.getProperty('GYM_INSTALLATION_ID'),
    properties.getProperty('OWNER_IDENTITY_SHARED_KEY')].join('\n'));
  const previous = properties.getProperty('OWNER_CONFIGURATION_VERSION');
  if (previous !== credentialVersion) {
    properties.setProperty('OWNER_CONFIGURATION_VERSION', credentialVersion);
    if (previous) securityEvent_('configuration', 'CHANGED');
  }
  return {
    properties: properties,
    ownerId: ownerId,
    verifier: verifier,
    mode: mode,
    credentialVersion: credentialVersion
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
  // Malformed traffic must not acquire the lock, run bcrypt or spend the
  // shared expensive-computation budget. Valid-shaped hostile attempts can
  // still exhaust that budget: a trusted limiter/identity path is required.
  if (!validOwnerPasswordInput_(data)) {
    securityEvent_('login', 'INVALID_CREDENTIALS');
    return authFailure_('INVALID_CREDENTIALS', 'Invalid Owner ID or password.');
  }
  const config = ownerConfiguration_();
  if (!config) return authFailure_('AUTH_UNAVAILABLE', 'Owner authentication is not configured.');
  if (config.mode === 'managed') return authFailure_('MANAGED_AUTH_REQUIRED', 'Use the configured secure owner sign-in.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return authFailure_('AUTH_BUSY', 'Please try again shortly.');
  try {
    const failure = checkOwnerPassword_(data, config);
    if (failure) return failure;
    const result = issueOwnerSession_(config);
    securityEvent_('login', 'SUCCESS');
    return result;
  } finally {
    lock.releaseLock();
  }
}

function validOwnerPasswordInput_(data) {
  return data && typeof data.ownerId === 'string' && data.ownerId.length > 0 && data.ownerId.length <= 128 &&
    typeof data.password === 'string' && data.password.length >= 12 && data.password.length <= 72 && !bcrypt.truncates(data.password);
}

// Caller holds ScriptLock. Fixed-size state, no attacker-controlled key growth.
function checkOwnerPassword_(data, config) {
  const now = Date.now();
  const saved = parseOwnerRecord_(config.properties.getProperty(OWNER_AUTH.THROTTLE_KEY));
  const throttle = saved && Number.isFinite(saved.startedAt) && saved.startedAt <= now &&
    Number.isInteger(saved.failures) && saved.failures >= 0 && now < saved.startedAt + OWNER_AUTH.FAILURE_WINDOW_MS
    ? saved : { startedAt: now, failures: 0 };
  if (throttle.failures >= OWNER_AUTH.MAX_FAILURES) {
    securityEvent_('login', 'RATE_LIMITED');
    return authFailure_('RATE_LIMITED', 'Too many login attempts. Try again in 15 minutes.');
  }
  // Compare valid-shaped inputs even for an incorrect Owner ID.
  if (!bcrypt.compareSync(data.password, config.verifier) || data.ownerId !== config.ownerId) {
    throttle.failures += 1;
    config.properties.setProperty(OWNER_AUTH.THROTTLE_KEY, JSON.stringify(throttle));
    securityEvent_('login', 'INVALID_CREDENTIALS');
    return authFailure_('INVALID_CREDENTIALS', 'Invalid Owner ID or password.');
  }
  config.properties.deleteProperty(OWNER_AUTH.THROTTLE_KEY);
  return null;
}

// Called only after verified authentication and while ScriptLock is held.
function issueOwnerSession_(config) {
    const now = Date.now();
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
      authenticatedAt: now,
      credentialVersion: config.credentialVersion
    }));
    return { success: true, sessionToken: token, expiresAt: expiresAt, securityPolicy: ownerSecurityPolicy_() };
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
  return { properties: config.properties, key: key, record: session };
}
