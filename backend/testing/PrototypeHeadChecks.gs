/** Optional editor-only fake-data smoke test. NEVER part of the installer.
 * Runs against the current project's shared Sheet/properties. Freeze other
 * work first, disable mail, and remove this file before creating a version.
 * This uses the editor's existing authority to issue a temporary session; it
 * does not test a password login or the /dev HTTP transport.
 */
function runPrototypeHeadChecks() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('FITZONE_PROTOTYPE_HEAD_TEST') !== 'fictional-data-only' ||
      properties.getProperty('EXPIRY_EMAIL_ENABLED') !== 'false' ||
      (properties.getProperty('OWNER_AUTH_MODE') || 'legacy') !== 'legacy' ||
      (properties.getProperty('MEMBER_LOOKUP_MODE') || 'legacy') !== 'legacy' ||
      memberHistoryEnabled_() || ownerSecurityPolicy_().stepUpRequired) {
    throw new Error('Head test blocked: confirm fictional data, disabled mail and inactive migrations.');
  }
  const checks = [];
  const assert = function (condition, label) {
    if (!condition) throw new Error('Prototype head check failed: ' + label);
    checks.push(label);
  };
  const decode = function (response) { return JSON.parse(response.getContent()); };
  const config = ownerConfiguration_();
  assert(!!config, 'owner configuration');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Head test blocked: busy.');
  let session;
  try { session = issueOwnerSession_(config); } finally { lock.releaseLock(); }
  const request = function (data) {
    return decode(doPost({ postData: { contents: JSON.stringify({ ...data, sessionToken: session.sessionToken }) } }));
  };
  const marker = 'STAGING ONLY Head ' + Utilities.getUuid();
  const created = [];
  let completed = false;
  try {
    const denied = decode(doPost({ postData: { contents: '{"action":"getAll"}' } }));
    assert(denied.code === 'UNAUTHORIZED', 'unauthorized read denied');
    assert(request({ action: 'getAll' }).success, 'session read');
    const member = { name: marker, phone: '0000000001', age: 25, weight: 65,
      membershipType: '1 Month', startDate: '2026-01-31' };
    const added = request({ action: 'addMember', member: member });
    assert(added.success && /^[1-9]\d*$/.test(added.memberId), 'create');
    created.push(added.memberId);
    const current = function (id) {
      const result = request({ action: 'getAll' });
      assert(result.success, 'refresh');
      return result.members.find(function (value) { return value.id === id; });
    };
    let record = current(added.memberId);
    assert(record && record.phone === member.phone && record.endDate === '2026-02-28', 'phone and calendar formatting');
    const lookup = decode(doGet({ parameter: { action: 'lookup', id: added.memberId } }));
    assert(lookup.success && lookup.member.name === 'Member #' + added.memberId &&
      !('phone' in lookup.member) && !('age' in lookup.member), 'minimal legacy lookup');
    assert(request({ action: 'updateMember', member: { ...record, age: 26 } }).success, 'edit');
    record = current(added.memberId);
    assert(record.age === 26 && record.endDate === '2026-02-28', 'contact-only edit preserves term');
    assert(request({ action: 'renewMember', memberId: record.id, expectedVersion: record.version,
      membershipType: '1 Month', startDate: '2026-02-28' }).code === 'RENEWAL_OVERLAP', 'overlap denied');
    assert(request({ action: 'renewMember', memberId: record.id, expectedVersion: record.version,
      membershipType: '1 Month', startDate: '2026-03-01' }).newEndDate === '2026-04-01', 'renew');
    record = current(added.memberId);
    assert(request({ action: 'deleteMember', memberId: record.id, expectedVersion: record.version }).success, 'delete test record');
    const next = request({ action: 'addMember', member: member });
    assert(next.success, 'second create');
    created.push(next.memberId);
    assert(Number(next.memberId) > Number(added.memberId), 'deleted IDs never reused');
    const disabled = runDailyExpiryNotifications({ triggerUid: 'synthetic-event' });
    assert(disabled.disabled === true && disabled.sent === 0, 'trigger mail disabled');
    completed = true;
  } finally {
    try {
      for (const id of created) {
        const result = request({ action: 'getAll' });
        if (!result.success) throw new Error('Prototype cleanup needs editor review.');
        const row = result.members.find(function (value) { return value.id === id; });
        if (!row) continue;
        if (row.name !== marker || !request({ action: 'deleteMember', memberId: id, expectedVersion: row.version }).success) {
          throw new Error('Prototype cleanup needs editor review.');
        }
      }
    } finally {
      const revoked = request({ action: 'logout' });
      assert(revoked.success, 'temporary session logout');
    }
  }
  assert(completed && request({ action: 'getAll' }).code === 'UNAUTHORIZED', 'logged-out session rejected');
  // Only labels/counts. Never print responses, member records or authority.
  console.log(JSON.stringify({ prototypeHead: 'PASS', checks: checks.length }));
  return { success: true, checks: checks.length };
}
