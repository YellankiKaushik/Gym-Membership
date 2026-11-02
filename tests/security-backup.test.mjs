import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createSyntheticSnapshot, encryptSyntheticSnapshot, decryptSyntheticSnapshot, syntheticRestorePlan } from '../scripts/synthetic-backup.mjs';

function fixture() {
  return createSyntheticSnapshot({ installationId: 'SYNTHETIC_GYM_BACKUP_01', rows: [
    ['ID', 'Name', 'Phone', 'Age', 'Weight', 'Plan', 'Start', 'End', 'Notified'],
    ['7', 'STAGING ONLY Restore Example', '0000000000', 25, 65, '1 Month', new Date('2026-10-01T00:00:00+05:30'), new Date('2026-11-01T00:00:00+05:30'), true],
  ], properties: { MEMBER_ID_HIGH_WATER_MARK: '12', OWNER_SESSION_EXCLUDED: 'must-not-restore', OWNER_PASSWORD_HASH: 'excluded',
    EXPIRY_NOTICE_7: JSON.stringify({ term: 'a'.repeat(64), status: 'sent', attempts: 1, attemptedAt: Date.now() }) } });
}

test('synthetic encrypted restore preserves dates/counters/journal, excludes sessions/secrets and disables email', () => {
  const snapshot = fixture(), key = randomBytes(32);
  const envelope = encryptSyntheticSnapshot(snapshot, key);
  const restored = decryptSyntheticSnapshot(envelope, key, snapshot.installationId);
  const plan = syntheticRestorePlan(restored, snapshot.installationId);
  assert.deepEqual(restored, snapshot);
  assert.equal(plan.rows[1][6], '2026-10-01');
  assert.equal(plan.properties.MEMBER_ID_HIGH_WATER_MARK, '12');
  assert.equal(plan.reviveSessions, false);
  assert.equal(plan.expiryEmailEnabled, false);
  assert.equal(plan.notificationReconciliationRequired, true);
  assert.equal(Object.keys(plan.properties).length, 2);
  assert.ok(!JSON.stringify(envelope).includes('Restore Example'));
});

test('backup tampering, wrong key, wrong installation and wrong format fail authentication', () => {
  const snapshot = fixture(), key = randomBytes(32);
  const envelope = encryptSyntheticSnapshot(snapshot, key);
  for (const changed of [{ ...envelope, ciphertext: 'AAAA' + envelope.ciphertext.slice(4) }, { ...envelope, version: 2 }, { ...envelope, tag: '' }]) {
    assert.throws(() => decryptSyntheticSnapshot(changed, key, snapshot.installationId), /authentication or validation/);
  }
  assert.throws(() => decryptSyntheticSnapshot(envelope, randomBytes(32), snapshot.installationId));
  assert.throws(() => decryptSyntheticSnapshot(envelope, key, 'SYNTHETIC_OTHER_GYM'));
});

test('backup rehearsal refuses ordinary personal data, duplicate IDs, invalid dates and low counters', () => {
  for (const change of [s => s.rows[1][1] = 'Ordinary personal name', s => s.rows[1][2] = '9876543210',
    s => s.rows.push([...s.rows[1]]), s => s.rows[1][7] = '2026-02-30', s => s.properties.MEMBER_ID_HIGH_WATER_MARK = '1',
    s => s.properties.OWNER_SESSION_NEW = 'not-allowed']) {
    const snapshot = fixture(); change(snapshot);
    assert.throws(() => encryptSyntheticSnapshot(snapshot, randomBytes(32)));
  }
});
