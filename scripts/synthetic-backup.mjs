import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const header = ['ID', 'Name', 'Phone', 'Age', 'Weight', 'Plan', 'Start', 'End', 'Notified'];
const plans = ['1 Month', '3 Months', '6 Months', '1 Year'];

function validateSnapshot(snapshot, installationId) {
  if (!snapshot || snapshot.version !== 1 || snapshot.environment !== 'synthetic-staging' ||
      snapshot.installationId !== installationId || !/^SYNTHETIC_[A-Z0-9_]{8,64}$/.test(installationId) ||
      Object.keys(snapshot).sort().join(',') !== 'createdAt,environment,installationId,properties,rows,version' ||
      !Number.isFinite(Date.parse(snapshot.createdAt)) || !Array.isArray(snapshot.rows) || snapshot.rows.length > 10000 ||
      JSON.stringify(snapshot.rows[0]) !== JSON.stringify(header) || !snapshot.properties || typeof snapshot.properties !== 'object') throw new Error('Invalid synthetic backup.');
  const seen = new Set();
  let highest = 0;
  for (const row of snapshot.rows.slice(1)) {
    if (!Array.isArray(row) || row.length !== 9 || !/^[1-9]\d{0,15}$/.test(String(row[0])) || !Number.isSafeInteger(Number(row[0])) ||
        typeof row[1] !== 'string' || !row[1].startsWith('STAGING ONLY ') || row[1].length > 120 ||
        !/^00000000\d{2}$/.test(row[2]) || !Number.isInteger(row[3]) || row[3] < 1 || row[3] > 120 ||
        typeof row[4] !== 'number' || !Number.isFinite(row[4]) || row[4] <= 0 || row[4] > 500 || !plans.includes(row[5]) || typeof row[8] !== 'boolean') throw new Error('Non-synthetic or invalid member row.');
    for (const index of [6, 7]) if (typeof row[index] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row[index]) ||
      !Number.isFinite(Date.parse(row[index])) || new Date(row[index]).toISOString().slice(0, 10) !== row[index]) throw new Error('Invalid backup date.');
    if (row[7] < row[6] || seen.has(String(row[0]))) throw new Error('Invalid backup member identity/term.');
    seen.add(String(row[0])); highest = Math.max(highest, Number(row[0]));
  }
  const counter = snapshot.properties.MEMBER_ID_HIGH_WATER_MARK;
  if (typeof counter !== 'string' || !/^\d+$/.test(counter) || !Number.isSafeInteger(Number(counter)) || Number(counter) < highest) throw new Error('Unsafe backup ID counter.');
  for (const [key, value] of Object.entries(snapshot.properties)) {
    if (key === 'MEMBER_ID_HIGH_WATER_MARK') continue;
    if (!/^EXPIRY_NOTICE_[1-9]\d{0,15}$/.test(key) || typeof value !== 'string' || value.length > 1000) throw new Error('Forbidden backup property.');
    let record; try { record = JSON.parse(value); } catch { throw new Error('Invalid notification journal.'); }
    if (!record || Object.keys(record).sort().join(',') !== 'attemptedAt,attempts,status,term' || !/^[a-f0-9]{64}$/.test(record.term) || !['pending', 'sent', 'failed'].includes(record.status) ||
        !Number.isInteger(record.attempts) || record.attempts < 1 || record.attempts > 3 || !Number.isFinite(record.attemptedAt)) throw new Error('Invalid notification journal.');
  }
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 10 * 1024 * 1024) throw new Error('Backup exceeds safe size.');
  return snapshot;
}

// This rehearsal API deliberately refuses ordinary member names/phones. It is
// not a production snapshot job or permission/independence attestation.
export function createSyntheticSnapshot({ installationId, rows, properties, now = new Date().toISOString() }) {
  const allowed = Object.fromEntries(Object.entries(properties).filter(([key]) => key === 'MEMBER_ID_HIGH_WATER_MARK' || /^EXPIRY_NOTICE_[1-9]\d{0,15}$/.test(key)));
  const snapshot = { version: 1, environment: 'synthetic-staging', installationId, createdAt: now,
    rows: rows.map(row => row.map((value, index) => index === 6 || index === 7 ? (value instanceof Date ?
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value) : value) : value)), properties: allowed };
  return validateSnapshot(snapshot, installationId);
}

function requireKey(key) { if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A private random 256-bit backup key is required.'); }

export function encryptSyntheticSnapshot(snapshot, key) {
  requireKey(key); validateSnapshot(snapshot, snapshot.installationId);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('FitZone:synthetic-backup:v1:' + snapshot.installationId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(snapshot), 'utf8'), cipher.final()]);
  return { version: 1, installationId: snapshot.installationId, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
}

export function decryptSyntheticSnapshot(envelope, key, expectedInstallationId) {
  requireKey(key);
  try {
    if (Object.keys(envelope).sort().join(',') !== 'ciphertext,installationId,iv,tag,version' || envelope.version !== 1 || envelope.installationId !== expectedInstallationId || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > 15 * 1024 * 1024) throw new Error();
    const iv = Buffer.from(envelope.iv, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from('FitZone:synthetic-backup:v1:' + expectedInstallationId));
    decipher.setAuthTag(tag);
    const value = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
    return validateSnapshot(value, expectedInstallationId);
  } catch { throw new Error('Backup authentication or validation failed.'); }
}

export function syntheticRestorePlan(snapshot, expectedInstallationId) {
  validateSnapshot(snapshot, expectedInstallationId);
  return { target: 'NEW_SYNTHETIC_PROJECT_ONLY', rows: structuredClone(snapshot.rows), properties: { ...snapshot.properties },
    expiryEmailEnabled: false, reviveSessions: false, notificationReconciliationRequired: true };
}
