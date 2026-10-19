/**
 * Gym Membership Management System
 * Uploaded nine-column baseline with owner authentication (not yet deployed).
 */

const CONFIG = {
  GYM_NAME: 'FitZone',
  LOCATION: 'Hyderabad'
};

// ==================== SETUP ====================

function getMemberSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  const tabName = properties.getProperty('MEMBER_SHEET_NAME');
  if (typeof spreadsheetId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(spreadsheetId) ||
      typeof tabName !== 'string' || !tabName.trim()) {
    throw new Error('MEMBER_SHEET_UNAVAILABLE');
  }
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(tabName);
    if (!sheet) throw new Error('Missing member tab');
    return sheet;
  } catch (err) {
    // Never forward Google exceptions: they can contain private identifiers.
    throw new Error('MEMBER_SHEET_UNAVAILABLE');
  }
}

function setAdminEmail() {
  // Configure the recipient privately in Project Settings > Script Properties.
  const email = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Configure ADMIN_EMAIL in Script Properties before enabling email triggers.');
  }
}

// ==================== PUBLIC API ====================

function doGet(e) {

  try {

    const parameter = e && e.parameter ? e.parameter : {};
    const action = parameter.action || 'lookup';

    // MEMBER LOOKUP
    if (action === 'lookup') {
      if (memberLookupMode_() !== 'legacy') return createResponse(lookupUnavailable_());
      return handleMemberLookup(parameter.id);
    }

    return createResponse({
      success: false,
      error: 'Invalid action'
    });

  } catch (err) {

    if (err && err.membershipCode) return createResponse({ success: false, code: err.membershipCode, error: err.message });
    return createResponse({
      success: false,
      code: err && err.message === 'MEMBER_SHEET_UNAVAILABLE' ? 'MEMBER_SHEET_UNAVAILABLE' : 'REQUEST_FAILED',
      error: err && err.message === 'MEMBER_SHEET_UNAVAILABLE'
        ? 'Member Sheet unavailable. Check spreadsheet and tab configuration or access.'
        : 'Unable to complete lookup'
    });
  }
}

// ==================== ADMIN API ====================
function doPost(e) {
  let eventAction = 'unauthorized';
  try {

    if (!e || !e.postData || typeof e.postData.contents !== 'string' ||
        e.postData.contents.length > 16384) {
      return createResponse(authFailure_('INVALID_REQUEST', 'Invalid request'));
    }
    const data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.action !== 'string') {
      return createResponse(authFailure_('INVALID_REQUEST', 'Invalid request'));
    }
    eventAction = ({ getAll: 'read', addMember: 'create', updateMember: 'update', renewMember: 'renew', deleteMember: 'delete', restoreMember: 'restore' })[data.action] || 'unauthorized';
    if (data.action === 'login') return createResponse(loginOwner_(data));
    if (data.action === 'lookupMember') return createResponse(lookupWithCapability_(data.lookupToken));
    if (data.action === 'beginOwnerIdentity') return createResponse(beginOwnerIdentity_(data));
    if (data.action === 'completeOwnerIdentity') return createResponse(completeOwnerIdentity_(data));
    const session = validateOwnerSession_(data.sessionToken);
    if (!session) {
      securityEvent_('unauthorized', 'UNAUTHORIZED');
      return createResponse(authFailure_('UNAUTHORIZED', 'Session expired or invalid. Please log in.'));
    }
    if (data.action === 'logout') {
      session.properties.deleteProperty(session.key);
      securityEvent_('logout', 'SUCCESS');
      return createResponse({ success: true });
    }

    switch (data.action) {
      case 'reauthenticate':
        return createResponse(reauthenticateOwner_(data, session));
      case 'issueMemberLookup':
        return createResponse(issueMemberLookup_(data, session));
      case 'revokeMemberLookup':
        return createResponse(revokeMemberLookup_(data, session));
      case 'restoreMember':
        return createResponse(restoreMember_(data, session));

      // Protected member fetch (login never returns member records).
      case 'getAll':
        const records = handleGetAllMembers();
        securityEvent_('read', 'SUCCESS');
        return records;

      // CREATE MEMBER
      case 'addMember':
        return createResponse(addMember(data.member, data));

      // UPDATE MEMBER
      case 'updateMember':
        return createResponse(updateMember(data.member, data));

      // RENEW MEMBER
      case 'renewMember':
        return createResponse(renewMember(data));

      // DELETE MEMBER
      case 'deleteMember':
        if (!consumeOwnerStepUp_(data, session, 'deleteMember')) return createResponse(authFailure_('REAUTHENTICATION_REQUIRED', 'Confirm this action with a fresh sign-in.'));
        return createResponse(deleteMember(data.memberId, data.expectedVersion, data));

      default:

        return createResponse({
          success: false,
          error: 'Invalid action'
        });
    }

  } catch (err) {
    securityEvent_(eventAction, 'FAILED');
    if (err && err.membershipCode) return createResponse({ success: false, code: err.membershipCode, error: err.message });
    return createResponse({
      success: false,
      code: err && err.message === 'MEMBER_SHEET_UNAVAILABLE' ? 'MEMBER_SHEET_UNAVAILABLE' : 'REQUEST_FAILED',
      error: err && err.message === 'MEMBER_SHEET_UNAVAILABLE'
        ? 'Member Sheet unavailable. Check spreadsheet and tab configuration or access.'
        : 'Unable to complete request'
    });
  }
}

// ==================== MEMBERSHIP READS / WRITES ====================

function membershipError_(code, message) {
  const error = new Error(message);
  error.membershipCode = code;
  throw error;
}

function withMemberWriteLock_(operation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, code: 'MEMBER_BUSY', error: 'Member records are busy. Please try again.' };
  try {
    return operation();
  } finally {
    try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  }
}

function normalizeMemberId_(value) {
  const text = String(value == null ? '' : value).trim();
  const number = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < 1) {
    membershipError_('INVALID_MEMBER_ID', 'Member IDs must be positive whole numbers.');
  }
  return String(number);
}

function memberRows_(sheet) {
  assertMemberReadBound_(sheet);
  const rows = sheet.getDataRange().getValues();
  const seen = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === '' || rows[i][0] == null) continue;
    const id = normalizeMemberId_(rows[i][0]);
    if (seen[id]) membershipError_('DUPLICATE_MEMBER_ID', 'Duplicate member IDs in Sheet. Resolve them before continuing.');
    seen[id] = true;
  }
  return rows;
}

function normalizePhone_(value, displayed) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      membershipError_('INVALID_PHONE', 'Phone cell has lost numeric precision. Restore it as plain text.');
    }
    const raw = String(value);
    const formatted = String(displayed || '').trim();
    const digits = formatted.replace(/\D/g, '');
    // Honor explicit Sheet formatting (including zero padding), never guess zeros.
    if (/^[+\d ()-]+$/.test(formatted) && digits.endsWith(raw) &&
        /^0*$/.test(digits.slice(0, digits.length - raw.length))) return formatted;
    return raw;
  }
  return String(value == null ? '' : value).trim();
}

function memberRecord_(row, displayedPhone) {
  const startDate = formatDate(row[6]);
  const endDate = formatDate(row[7]);
  if (endDate < startDate) membershipError_('INVALID_DATE', 'Membership end date cannot precede its start date.');
  calculateEndDate(startDate, row[5]); // Reject unknown plans in manually edited rows.
  const days = dateOrdinal_(endDate) - dateOrdinal_(todayDate_());
  return {
    id: normalizeMemberId_(row[0]), name: String(row[1] || ''),
    phone: normalizePhone_(row[2], displayedPhone), age: row[3], weight: row[4],
    membershipType: row[5], startDate: startDate, endDate: endDate, version: memberVersion_(row),
    status: days >= 0 ? 'Active' : 'Expired', daysRemaining: days
  };
}

function memberVersion_(row) {
  return digestOwnerValue_(JSON.stringify(row.slice(0, 8).map(function (value) {
    return Object.prototype.toString.call(value) === '[object Date]' ? formatDate(value) : value;
  })));
}

function assertMemberVersion_(row, expected) {
  if ((memberHistoryEnabled_() && expected === undefined) || (expected !== undefined && expected !== memberVersion_(row))) {
    membershipError_('STALE_MEMBER', 'This member changed in Sheets or another session. Refresh and reopen the form before saving.');
  }
}

function handleMemberLookup(memberId) {
  if (memberLookupMode_() !== 'legacy') return createResponse(lookupUnavailable_());
  if (!memberId) return createResponse({ success: false, error: 'Member ID required' });
  const id = normalizeMemberId_(memberId);
  if (!consumeLookupBudget_()) return createResponse(lookupUnavailable_());
  const sheet = getMemberSheet_();
  const rows = memberRows_(sheet);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === '' || rows[i][0] == null) continue;
    if (normalizeMemberId_(rows[i][0]) !== id) continue;
    const member = memberRecord_(rows[i], sheet.getRange(i + 1, 3).getDisplayValues()[0][0]);
    // Explicit allowlist: predictable IDs must not reveal contact/identity data.
    return createResponse({ success: true, member: {
      id: member.id, name: 'Member #' + member.id, membershipType: member.membershipType,
      endDate: member.endDate, status: member.status, daysRemaining: Math.max(member.daysRemaining, 0)
    } });
  }
  return createResponse({ success: false, error: 'Member not found' });
}

function handleGetAllMembers() {
  const sheet = getMemberSheet_();
  const rows = memberRows_(sheet);
  const phones = sheet.getRange(1, 3, rows.length, 1).getDisplayValues();
  const members = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === '' || rows[i][0] == null) continue;
    members.push(memberRecord_(rows[i], phones[i][0]));
  }
  return createResponse({ success: true, members: members });
}

function validateMemberInput_(member) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) {
    membershipError_('INVALID_MEMBER', 'Member details required.');
  }
  const name = typeof member.name === 'string' ? member.name.trim() : '';
  const phone = normalizePhone_(member.phone);
  const digits = phone.replace(/\D/g, '');
  if (!name || name.length > 120 || /^[=+@]/.test(name) || /[\u0000-\u001f]/.test(name) ||
      !/^[\d ()+-]+$/.test(phone) || phone.length > 24 ||
      !(digits.length === 10 || /^91\d{10}$/.test(digits))) {
    membershipError_('INVALID_MEMBER', 'Enter a name (up to 120 characters) and a 10-digit phone, optionally with +91. Names cannot start with =, + or @.');
  }
  if (typeof member.age !== 'number' || !Number.isInteger(member.age) || member.age <= 0 || member.age > 120 ||
      typeof member.weight !== 'number' || !Number.isFinite(member.weight) || member.weight <= 0 || member.weight > 500) {
    membershipError_('INVALID_MEMBER', 'Enter a whole-number age from 1 to 120 and weight greater than 0, up to 500 kg.');
  }
  const start = parseMembershipDate_(member.startDate);
  const end = calculateEndDate(member.startDate, member.membershipType);
  return { name: name, phone: phone, start: start, end: end };
}

function rememberHighestId_(rows) {
  const properties = PropertiesService.getScriptProperties();
  const stored = properties.getProperty('MEMBER_ID_HIGH_WATER_MARK');
  if (stored !== null && (!/^\d+$/.test(stored) || !Number.isSafeInteger(Number(stored)))) {
    membershipError_('INVALID_ID_COUNTER', 'Member ID counter is invalid. Restore it from a trusted backup.');
  }
  let highest = Number(stored || 0);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] !== '' && rows[i][0] != null) highest = Math.max(highest, Number(normalizeMemberId_(rows[i][0])));
  }
  properties.setProperty('MEMBER_ID_HIGH_WATER_MARK', String(highest));
  return highest;
}

function addMember(m, mutation) {
  const input = validateMemberInput_(m);
  return withMemberWriteLock_(function () {
    const history = historyContext_('create', mutation);
    if (history && history.replay) return history.replay;
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    const next = rememberHighestId_(rows) + 1;
    if (!Number.isSafeInteger(next)) membershipError_('INVALID_ID_COUNTER', 'Member ID limit reached.');
    // Reserve before any Sheet write. Failed writes can leave gaps, never reused IDs.
    PropertiesService.getScriptProperties().setProperty('MEMBER_ID_HIGH_WATER_MARK', String(next));
    const row = sheet.getLastRow() + 1;
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
    sheet.getRange(row, 1).setNumberFormat('@');
    sheet.getRange(row, 2).setNumberFormat('@');
    sheet.getRange(row, 3).setNumberFormat('@');
    sheet.getRange(row, 7, 1, 2).setNumberFormat('yyyy-mm-dd');
    const after = [
      String(next), input.name, input.phone, m.age, m.weight, m.membershipType,
      input.start, input.end, false
    ];
    prepareHistoryMutation_(history, String(next), null, after);
    sheet.getRange(row, 1, 1, 9).setValues([after]);
    const result = { success: true, memberId: String(next) };
    finishHistoryMutation_(history, result);
    securityEvent_('create', 'SUCCESS', String(next));
    return result;
  });
}

function updateMember(m, mutation) {
  const input = validateMemberInput_(m);
  const id = normalizeMemberId_(m.id);
  return withMemberWriteLock_(function () {
    const history = historyContext_('update', mutation);
    if (history && history.replay) return history.replay;
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === '' || rows[i][0] == null || normalizeMemberId_(rows[i][0]) !== id) continue;
      // A contact-only edit must preserve a manually extended or renewed expiry.
      assertMemberVersion_(rows[i], m.version);
      const unchangedTerm = formatDate(rows[i][6]) === m.startDate && rows[i][5] === m.membershipType;
      const end = unchangedTerm ? parseMembershipDate_(formatDate(rows[i][7])) : input.end;
      const after = [rows[i][0],
        input.name, input.phone, m.age, m.weight, m.membershipType, input.start, end,
        unchangedTerm ? rows[i][8] : false
      ];
      prepareHistoryMutation_(history, id, rows[i], after, sheet, i + 1);
      sheet.getRange(i + 1, 2, 1, 2).setNumberFormat('@');
      sheet.getRange(i + 1, 7, 1, 2).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(i + 1, 2, 1, 8).setValues([after.slice(1)]);
      finishHistoryMutation_(history, { success: true });
      securityEvent_('update', 'SUCCESS', id);
      return { success: true };
    }
    return { success: false, error: 'Member not found' };
  });
}

function renewMember(data) {
  const id = normalizeMemberId_(data.memberId);
  const start = parseMembershipDate_(data.startDate);
  const end = calculateEndDate(data.startDate, data.membershipType);
  return withMemberWriteLock_(function () {
    const history = historyContext_('renew', data);
    if (history && history.replay) return history.replay;
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === '' || rows[i][0] == null || normalizeMemberId_(rows[i][0]) !== id) continue;
      // End dates are inclusive. Reject overlap; never replace the owner's input.
      assertMemberVersion_(rows[i], data.expectedVersion);
      if (data.startDate <= formatDate(rows[i][7])) {
        return { success: false, code: 'RENEWAL_OVERLAP',
          error: 'Renewal must start after the current end date to preserve paid time. Choose a later date.' };
      }
      prepareHistoryMutation_(history, id, rows[i], [...rows[i].slice(0, 5), data.membershipType, start, end, false], sheet, i + 1);
      sheet.getRange(i + 1, 7, 1, 2).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(i + 1, 6, 1, 4).setValues([[data.membershipType, start, end, false]]);
      const result = { success: true, newEndDate: formatDate(end) };
      finishHistoryMutation_(history, result);
      securityEvent_('renew', 'SUCCESS', id);
      return result;
    }
    return { success: false, error: 'Member not found' };
  });
}

function deleteMember(memberId, expectedVersion, mutation) {
  const id = normalizeMemberId_(memberId);
  return withMemberWriteLock_(function () {
    const history = historyContext_('delete', mutation);
    if (history && history.replay) return history.replay;
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === '' || rows[i][0] == null || normalizeMemberId_(rows[i][0]) !== id) continue;
      // Seed before deleting even when no member has been created by this version.
      assertMemberVersion_(rows[i], expectedVersion);
      rememberHighestId_(rows);
      prepareHistoryMutation_(history, id, rows[i], null, sheet, i + 1);
      // Revocation precedes deletion; a partial failure may require reissuance,
      // but can never leave a deleted member's public access intentionally live.
      revokeLookupForMember_(id);
      sheet.deleteRow(i + 1);
      finishHistoryMutation_(history, { success: true });
      securityEvent_('delete', 'SUCCESS', id);
      return { success: true };
    }
    return { success: false, error: 'Member not found' };
  });
}

// ==================== EMAIL ====================

function notifiedCell_(value) {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

function notificationTerm_(member) {
  return digestOwnerValue_([member.id, member.membershipType, member.startDate, member.endDate].join('|'));
}

// Pure planner. Neither sends mail nor writes properties/Sheet cells.
function planExpiryNotifications_(rows, saved, today, now) {
  const preview = [];
  const reviewRequired = [];
  let invalidRows = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === '' || rows[i][0] == null) continue;
    let member;
    try { member = memberRecord_(rows[i]); } catch (_) { invalidRows++; continue; }
    const days = dateOrdinal_(member.endDate) - dateOrdinal_(today);
    if (days < 0 || days > 7) continue;
    const term = notificationTerm_(member);
    const key = 'EXPIRY_NOTICE_' + member.id;
    let record = null;
    if (Object.prototype.hasOwnProperty.call(saved, key)) {
      try {
        record = JSON.parse(saved[key]);
        if (!record || !/^[a-f0-9]{64}$/.test(record.term) ||
            !['pending', 'sent', 'failed'].includes(record.status) ||
            !Number.isInteger(record.attempts) || record.attempts < 1 ||
            !Number.isFinite(record.attemptedAt)) throw new Error('Invalid ledger');
      } catch (_) { reviewRequired.push(member.id); continue; }
    }
    if (record && record.term === term) {
      if (record.status === 'sent') continue; // Ledger survives a failed Column I write.
      if (record.status === 'pending' || record.attempts >= 3) { reviewRequired.push(member.id); continue; }
      if (now - record.attemptedAt < 60 * 60 * 1000) continue; // Failed submission: bounded retry/backoff.
    } else if (!record && notifiedCell_(rows[i][8])) {
      continue; // Honor legacy Notified flags when no term journal exists yet.
    }
    preview.push({ id: member.id, name: member.name, phone: member.phone,
      end: member.endDate, days: days, status: days === 0 ? 'Expires today' : 'Expires in ' + days + ' day(s)',
      term: term, key: key, row: i + 1, attempts: record && record.term === term ? record.attempts : 0 });
  }
  preview.sort(function (a, b) { return a.end.localeCompare(b.end) || Number(a.id) - Number(b.id); });
  return { preview: preview, reviewRequired: reviewRequired, invalidRows: invalidRows };
}

// Time-driven triggers pass an event; keep it out of the boolean dry-run API.
function runDailyExpiryNotifications() {
  return checkMembershipExpiries(false);
}

function checkMembershipExpiries(testMode = false) {
  if (testMode !== true && testMode !== false) throw new Error('Use a boolean dry-run flag.');
  const properties = PropertiesService.getScriptProperties();
  if (!testMode && properties.getProperty('EXPIRY_EMAIL_ENABLED') !== 'true') {
    return { success: true, disabled: true, sent: 0 };
  }
  if (testMode) {
    const sheet = getMemberSheet_();
    return { success: true, dryRun: true, ...planExpiryNotifications_(
      memberRows_(sheet), properties.getProperties(), todayDate_(), Date.now()) };
  }
  // The same ScriptLock coordinates CRUD, scheduled jobs and all journal writes.
  return withMemberWriteLock_(function () {
    const email = properties.getProperty('ADMIN_EMAIL');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, code: 'EMAIL_NOT_CONFIGURED', sent: 0 };
    }
    if (memberHistoryEnabled_() && historyStore_().rows.slice(1).some(function (row) { return !['COMMITTED', 'CANCELLED'].includes(row[3]); })) {
      return { success: false, code: 'HISTORY_REVIEW_REQUIRED', sent: 0 };
    }
    const sheet = getMemberSheet_();
    const plan = planExpiryNotifications_(memberRows_(sheet), properties.getProperties(), todayDate_(), Date.now());
    let sent = 0;
    let failed = 0;
    let flagFailures = 0;
    for (const alert of plan.preview) {
      const record = { term: alert.term, status: 'pending', attempts: alert.attempts + 1, attemptedAt: Date.now() };
      // Persist intent BEFORE Gmail. An interrupted/ambiguous attempt is never auto-retried.
      properties.setProperty(alert.key, JSON.stringify(record));
      try {
        sendAdminEmail([alert], email);
      } catch (_) {
        record.status = 'failed';
        properties.setProperty(alert.key, JSON.stringify(record));
        failed++;
        continue;
      }
      // Gmail submission succeeded. Journal completion BEFORE setting the legacy flag.
      record.status = 'sent';
      properties.setProperty(alert.key, JSON.stringify(record));
      sent++;
      try { sheet.getRange(alert.row, 9).setValue(true); } catch (_) { flagFailures++; }
    }
    return { success: failed === 0 && flagFailures === 0, sent: sent, failed: failed,
      flagFailures: flagFailures, reviewRequired: plan.reviewRequired, invalidRows: plan.invalidRows };
  });
}

function sendAdminEmail(list, recipient) {
  const properties = PropertiesService.getScriptProperties();
  const email = recipient || properties.getProperty('ADMIN_EMAIL');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('EMAIL_NOT_CONFIGURED');
  const name = properties.getProperty('GYM_NAME') || CONFIG.GYM_NAME;
  const location = properties.getProperty('GYM_LOCATION') || CONFIG.LOCATION;
  let body = 'Membership Alerts | ' + name + '\n\n';
  list.forEach(function (m, i) {
    body += (i + 1) + '. ' + m.name + '\nID: ' + m.id + '\nPhone: ' + m.phone +
      '\nStatus: ' + m.status + '\nEnds: ' + m.end + '\n\n';
  });
  GmailApp.sendEmail(email, 'Membership Expiry Alert | ' + name, body + '— ' + name + ', ' + location);
}

// Safe editor entry point: synthetic rows only, no Sheet/property access and no Gmail.
function previewSyntheticExpiryNotifications() {
  const today = todayDate_();
  const datePlus = function (days) {
    return new Date((dateOrdinal_(today) + days) * 86400000).toISOString().slice(0, 10);
  };
  const rows = [['ID', 'Name', 'Phone', 'Age', 'Weight', 'Plan', 'Start', 'End', 'Notified']];
  [7, 1, 0, -1, 8].forEach(function (days, i) {
    rows.push([String(i + 1), 'STAGING ONLY Example ' + (i + 1), '0000000000', 25, 65,
      '1 Month', datePlus(-30), datePlus(days), false]);
  });
  return { success: true, dryRun: true, synthetic: true,
    ...planExpiryNotifications_(rows, {}, today, Date.now()) };
}

// Editor-only explicit reconciliation after checking Sent mail. Never exposed by doGet/doPost.
function resolveExpiryNotification(memberId, resolution) {
  if (!['sent', 'retry'].includes(resolution)) throw new Error('Choose sent or retry after checking Sent mail.');
  const id = normalizeMemberId_(memberId);
  return withMemberWriteLock_(function () {
    const properties = PropertiesService.getScriptProperties();
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][0] || normalizeMemberId_(rows[i][0]) !== id) continue;
      const key = 'EXPIRY_NOTICE_' + id;
      const record = JSON.parse(properties.getProperty(key) || 'null');
      if (!record || record.term !== notificationTerm_(memberRecord_(rows[i]))) throw new Error('No matching current-term attempt.');
      record.status = resolution === 'sent' ? 'sent' : 'failed';
      if (resolution === 'retry') { record.attempts = 1; record.attemptedAt = 0; }
      properties.setProperty(key, JSON.stringify(record));
      if (resolution === 'sent') sheet.getRange(i + 1, 9).setValue(true);
      return { success: true };
    }
    return { success: false, error: 'Member not found' };
  });
}

// ==================== UTIL ====================

// Calendar dates are interpreted in the gym's Asia/Kolkata timezone, never host-local time.
function isoDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    membershipError_('INVALID_DATE', 'Enter a valid date as YYYY-MM-DD.');
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    membershipError_('INVALID_DATE', 'Enter a real calendar date between 1900 and 9999.');
  }
  return value;
}

function parseMembershipDate_(value) {
  return Utilities.parseDate(isoDate_(value), 'Asia/Kolkata', 'yyyy-MM-dd');
}

function formatDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (!Number.isFinite(value.getTime())) membershipError_('INVALID_DATE', 'Invalid date in member Sheet.');
    return isoDate_(Utilities.formatDate(value, 'Asia/Kolkata', 'yyyy-MM-dd'));
  }
  return isoDate_(value);
}

function todayDate_() {
  return formatDate(new Date());
}

function dateOrdinal_(iso) {
  isoDate_(iso);
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
}

function calculateEndDate(start, type) {
  const plans = { '1 Month': 1, '3 Months': 3, '6 Months': 6, '1 Year': 12 };
  const months = typeof type === 'string' && Object.prototype.hasOwnProperty.call(plans, type) ? plans[type] : null;
  if (!months) membershipError_('INVALID_PLAN', 'Choose 1 Month, 3 Months, 6 Months or 1 Year.');
  const iso = formatDate(start);
  const target = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(Number(iso.slice(8, 10)), lastDay);
  const result = String(target.getUTCFullYear()).padStart(4, '0') + '-' +
    String(target.getUTCMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  return parseMembershipDate_(result);
}

function maskPhone(p) {
  const phone = String(p || '').replace(/\D/g, '');
  return phone.length > 4 ? 'XXXXXX' + phone.slice(-4) : 'XXXX';
}

function createResponse(obj) {

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== SECURITY POLICY / MINIMAL EVENTS ====================

function ownerSecurityPolicy_() {
  const properties = PropertiesService.getScriptProperties();
  return { authMode: properties.getProperty('OWNER_AUTH_MODE') || 'legacy',
    stepUpRequired: properties.getProperty('OWNER_STEP_UP_REQUIRED') === 'true' || properties.getProperty('OWNER_AUTH_MODE') === 'managed',
    historyEnabled: memberHistoryEnabled_(), lookupMode: memberLookupMode_() };
}

function securityEvent_(action, result, memberId) {
  const actions = ['login', 'logout', 'unauthorized', 'step_up', 'identity', 'read', 'create', 'update', 'renew', 'delete', 'restore', 'capability_issue', 'capability_revoke', 'configuration'];
  const results = ['SUCCESS', 'INVALID_CREDENTIALS', 'RATE_LIMITED', 'UNAUTHORIZED', 'REJECTED', 'PENDING', 'FAILED', 'CHANGED'];
  const event = { schema: 1, category: 'fitzone_security', at: new Date().toISOString(), correlationId: Utilities.getUuid(),
    action: actions.includes(action) ? action : 'unauthorized', result: results.includes(result) ? result : 'REJECTED' };
  if (typeof memberId === 'string' && /^[1-9]\d{0,15}$/.test(memberId)) event.memberId = memberId;
  // No request objects, identities, exception messages, tokens or config values.
  try { console.log(JSON.stringify(event)); } catch (_) { /* Provider logging outage must not bypass authorization. */ }
}

function assertMemberReadBound_(sheet) {
  const configured = PropertiesService.getScriptProperties().getProperty('MEMBER_MAX_ROWS');
  const limit = configured === null ? 10000 : Number(configured);
  if (!Number.isInteger(limit) || limit < 2 || limit > 50000 || sheet.getLastRow() > limit) {
    membershipError_('MEMBER_READ_LIMIT', 'Member storage exceeds its configured safe read limit. Contact the owner.');
  }
}

function memberLookupMode_() {
  const mode = PropertiesService.getScriptProperties().getProperty('MEMBER_LOOKUP_MODE') || 'legacy';
  if (!['legacy', 'capability'].includes(mode)) membershipError_('LOOKUP_UNAVAILABLE', 'Membership access unavailable.');
  return mode;
}

function lookupUnavailable_() {
  return { success: false, code: 'LOOKUP_UNAVAILABLE', error: 'Membership access unavailable. Contact the gym for a current access code.' };
}

function consumeLookupBudget_(tokenKey) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return false;
  try {
    const properties = PropertiesService.getScriptProperties();
    const now = Date.now();
    const current = parseOwnerRecord_(properties.getProperty('PUBLIC_LOOKUP_BUDGET'));
    const bucket = current && Number.isFinite(current.start) && current.start <= now && now < current.start + 60000 &&
      Number.isInteger(current.count) && current.count >= 0 ? current : { start: now, count: 0 };
    if (bucket.count >= 60) return false;
    if (tokenKey) {
      const token = parseOwnerRecord_(properties.getProperty(tokenKey));
      if (!token || !Number.isFinite(token.expiresAt) || token.expiresAt <= now ||
          typeof token.id !== 'string' || properties.getProperty('MEMBER_LOOKUP_' + token.id) !== tokenKey) return false;
      if (!Number.isFinite(token.start) || token.start > now || now >= token.start + 60000) { token.start = now; token.count = 0; }
      if (!Number.isInteger(token.count) || token.count < 0 || token.count >= 10) return false;
      token.count++;
      properties.setProperty(tokenKey, JSON.stringify(token));
    }
    bucket.count++;
    properties.setProperty('PUBLIC_LOOKUP_BUDGET', JSON.stringify(bucket));
    return true;
  } finally { lock.releaseLock(); }
}

function issueMemberLookup_(data, session) {
  if (memberLookupMode_() !== 'capability') return lookupUnavailable_();
  if (!consumeOwnerStepUp_(data, session, 'issueMemberLookup')) return authFailure_('REAUTHENTICATION_REQUIRED', 'Confirm this action with a fresh sign-in.');
  const id = normalizeMemberId_(data.memberId);
  const days = data.validDays === undefined ? 30 : data.validDays;
  if (!Number.isInteger(days) || days < 1 || days > 90) return lookupUnavailable_();
  return withMemberWriteLock_(function () {
    const rows = memberRows_(getMemberSheet_());
    const row = rows.slice(1).find(function (value) { return value[0] !== '' && normalizeMemberId_(value[0]) === id; });
    if (!row) return lookupUnavailable_();
    const properties = PropertiesService.getScriptProperties();
    const pointer = 'MEMBER_LOOKUP_' + id;
    const previous = properties.getProperty(pointer);
    const records = properties.getProperties();
    let active = 0;
    Object.keys(records).forEach(function (key) {
      if (!/^LOOKUP_TOKEN_[a-f0-9]{64}$/.test(key)) return;
      const saved = parseOwnerRecord_(records[key]);
      if (!saved || saved.expiresAt <= Date.now()) {
        properties.deleteProperty(key);
        if (saved && typeof saved.id === 'string' && /^[1-9]\d{0,15}$/.test(saved.id) && properties.getProperty('MEMBER_LOOKUP_' + saved.id) === key) {
          properties.deleteProperty('MEMBER_LOOKUP_' + saved.id);
        }
      } else active++;
    });
    const replacement = previous && parseOwnerRecord_(records[previous]);
    if (active >= 500 && (!replacement || replacement.id !== id || replacement.expiresAt <= Date.now())) return authFailure_('LOOKUP_CAPACITY', 'Member access storage requires owner review before issuing more codes.');
    const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    const key = 'LOOKUP_TOKEN_' + digestOwnerValue_(token);
    const expiresAt = Date.now() + days * 86400000;
    properties.setProperty(key, JSON.stringify({ id: id, expiresAt: expiresAt, start: Date.now(), count: 0 }));
    try { properties.setProperty(pointer, key); } catch (error) { properties.deleteProperty(key); throw error; }
    if (previous && /^LOOKUP_TOKEN_[a-f0-9]{64}$/.test(previous)) properties.deleteProperty(previous);
    securityEvent_('capability_issue', 'SUCCESS', id);
    return { success: true, lookupToken: token, expiresAt: expiresAt };
  });
}

function revokeMemberLookup_(data, session) {
  if (!consumeOwnerStepUp_(data, session, 'revokeMemberLookup')) return authFailure_('REAUTHENTICATION_REQUIRED', 'Confirm this action with a fresh sign-in.');
  const id = normalizeMemberId_(data.memberId);
  return withMemberWriteLock_(function () {
    revokeLookupForMember_(id);
    securityEvent_('capability_revoke', 'SUCCESS', id);
    return { success: true };
  });
}

function revokeLookupForMember_(id) {
  const properties = PropertiesService.getScriptProperties();
  const pointer = 'MEMBER_LOOKUP_' + id;
  const key = properties.getProperty(pointer);
  properties.deleteProperty(pointer);
  if (key && /^LOOKUP_TOKEN_[a-f0-9]{64}$/.test(key)) properties.deleteProperty(key);
}

function lookupWithCapability_(token) {
  const unavailable = lookupUnavailable_();
  if (memberLookupMode_() !== 'capability' || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return unavailable;
  const key = 'LOOKUP_TOKEN_' + digestOwnerValue_(token);
  if (!consumeLookupBudget_(key)) return unavailable;
  const record = parseOwnerRecord_(PropertiesService.getScriptProperties().getProperty(key));
  const sheet = getMemberSheet_();
  assertMemberReadBound_(sheet);
  const size = sheet.getLastRow();
  if (size < 2) return unavailable;
  // Read only IDs until authorization has selected exactly one member. No
  // cache of mutable member data; manual ID changes/duplicates fail closed.
  const ids = sheet.getRange(2, 1, size - 1, 1).getValues();
  const seen = {};
  let target = 0;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === '' || ids[i][0] == null) continue;
    const id = normalizeMemberId_(ids[i][0]);
    if (seen[id]) return unavailable;
    seen[id] = true;
    if (id === record.id) target = i + 2;
  }
  if (!target) return unavailable;
  const row = sheet.getRange(target, 1, 1, 9).getValues()[0];
  if (normalizeMemberId_(row[0]) !== record.id) return unavailable;
  const member = memberRecord_(row);
  return { success: true, member: { id: member.id, name: 'Member #' + member.id,
    membershipType: member.membershipType, endDate: member.endDate, status: member.status,
    daysRemaining: Math.max(0, member.daysRemaining) } };
}

function memberHistoryEnabled_() {
  return PropertiesService.getScriptProperties().getProperty('MEMBER_HISTORY_ENABLED') === 'true';
}

// ==================== FRESH AUTH / MANAGED IDENTITY BRIDGE ====================

function stepUpTarget_(data, purpose) {
  if (!['deleteMember', 'restoreMember', 'issueMemberLookup', 'revokeMemberLookup'].includes(purpose)) return null;
  const id = normalizeMemberId_(data.memberId);
  const version = data.expectedVersion === undefined ? '' : data.expectedVersion;
  if (typeof version !== 'string' || (version && !/^[a-f0-9]{64}$/.test(version))) return null;
  return digestOwnerValue_(JSON.stringify([purpose, id, version, data.archiveOperationId || '']));
}

function issueOwnerStepUp_(session, target) {
  const properties = session.properties;
  const records = properties.getProperties();
  let active = 0;
  Object.keys(records).forEach(function (key) {
    if (!key.startsWith('OWNER_STEPUP_')) return;
    const saved = parseOwnerRecord_(records[key]);
    if (!saved || saved.expiresAt <= Date.now()) properties.deleteProperty(key); else active++;
  });
  if (active >= 20) return authFailure_('AUTH_BUSY', 'Please try again shortly.');
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  properties.setProperty('OWNER_STEPUP_' + digestOwnerValue_(token), JSON.stringify({ sessionKey: session.key, target: target, expiresAt: Date.now() + 60000 }));
  securityEvent_('step_up', 'SUCCESS');
  return { success: true, stepUpToken: token, expiresAt: Date.now() + 60000 };
}

function reauthenticateOwner_(data, session) {
  const config = ownerConfiguration_();
  if (!config || config.mode !== 'legacy') return authFailure_('MANAGED_AUTH_REQUIRED', 'Use the configured secure owner sign-in.');
  const input = { ownerId: config.ownerId, password: data.password };
  const target = stepUpTarget_(data, data.purpose);
  if (!target || !validOwnerPasswordInput_(input)) return authFailure_('INVALID_CREDENTIALS', 'Invalid credentials.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return authFailure_('AUTH_BUSY', 'Please try again shortly.');
  try {
    if (!validateOwnerSession_(data.sessionToken)) return authFailure_('UNAUTHORIZED', 'Session expired.');
    const failure = checkOwnerPassword_(input, config);
    return failure || issueOwnerStepUp_(session, target);
  } finally { lock.releaseLock(); }
}

function consumeOwnerStepUp_(data, session, purpose, force) {
  if (!force && !ownerSecurityPolicy_().stepUpRequired) return true;
  const target = stepUpTarget_(data, purpose);
  if (!target || typeof data.stepUpToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.stepUpToken)) return false;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return false;
  try {
    if (!validateOwnerSession_(data.sessionToken)) return false;
    const key = 'OWNER_STEPUP_' + digestOwnerValue_(data.stepUpToken);
    const record = parseOwnerRecord_(session.properties.getProperty(key));
    if (!record || record.sessionKey !== session.key || record.target !== target || record.expiresAt <= Date.now()) return false;
    session.properties.deleteProperty(key); // One action, one session, one member/version, one use.
    return true;
  } finally { lock.releaseLock(); }
}

function managedOwnerConfiguration_() {
  const config = ownerConfiguration_();
  if (!config || config.mode !== 'managed') return null;
  const key = config.properties.getProperty('OWNER_IDENTITY_SHARED_KEY');
  const installation = config.properties.getProperty('GYM_INSTALLATION_ID');
  const subject = config.properties.getProperty('OWNER_IDENTITY_SUBJECT');
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || typeof installation !== 'string' ||
      !/^[A-Za-z0-9_-]{16,64}$/.test(installation) || typeof subject !== 'string' || !subject || subject.length > 256) return null;
  return { config: config, key: key, installation: installation, subjectHash: digestOwnerValue_(subject) };
}

function beginOwnerIdentity_(data) {
  const managed = managedOwnerConfiguration_();
  if (!managed) return authFailure_('AUTH_UNAVAILABLE', 'Secure owner sign-in is unavailable.');
  const session = data.purpose === 'login' ? null : validateOwnerSession_(data.sessionToken);
  if (data.purpose !== 'login' && !session) return authFailure_('UNAUTHORIZED', 'Session expired.');
  const purpose = data.purpose === 'login' ? 'login' : stepUpTarget_(data, data.purpose);
  if (!purpose) return authFailure_('INVALID_REQUEST', 'Invalid sign-in request.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return authFailure_('AUTH_BUSY', 'Please try again shortly.');
  try {
    const saved = parseOwnerRecord_(managed.config.properties.getProperty('OWNER_IDENTITY_CHALLENGES'));
    const entries = Array.isArray(saved) ? saved.filter(function (item) { return item && item.expiresAt > Date.now(); }).slice(0, 8) : [];
    if (entries.length >= 8) { securityEvent_('identity', 'RATE_LIMITED'); return authFailure_('AUTH_BUSY', 'Please try again shortly.'); }
    const challenge = { id: (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), nonce: (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''),
      purpose: purpose, installationId: managed.installation, expiresAt: Date.now() + 120000 };
    entries.push({ ...challenge, sessionKey: session ? session.key : null });
    managed.config.properties.setProperty('OWNER_IDENTITY_CHALLENGES', JSON.stringify(entries));
    return { success: true, challenge: challenge };
  } finally { lock.releaseLock(); }
}

function completeOwnerIdentity_(data) {
  const managed = managedOwnerConfiguration_();
  const proof = data.proof;
  const invalid = function () { securityEvent_('identity', 'REJECTED'); return authFailure_('INVALID_IDENTITY', 'Secure sign-in could not be verified.'); };
  if (!managed || !proof || typeof proof !== 'object' || proof.v !== 1 ||
      proof.installationId !== managed.installation || proof.subjectHash !== managed.subjectHash ||
      !/^[a-f0-9]{64}$/.test(proof.id) || !/^[a-f0-9]{64}$/.test(proof.nonce) ||
      typeof proof.purpose !== 'string' || !/^(login|[a-f0-9]{64})$/.test(proof.purpose) ||
      typeof proof.signature !== 'string' || !/^[a-f0-9]{64}$/.test(proof.signature) ||
      !Number.isSafeInteger(proof.authenticatedAt) || proof.authenticatedAt > Date.now() + 5000 || proof.authenticatedAt < Date.now() - 300000 ||
      !Number.isSafeInteger(proof.expiresAt) || proof.expiresAt <= Date.now() || proof.expiresAt > Date.now() + 65000) return invalid();
  const message = JSON.stringify([proof.v, proof.installationId, proof.subjectHash, proof.id, proof.nonce, proof.purpose, proof.authenticatedAt, proof.expiresAt]);
  const expected = Utilities.computeHmacSha256Signature(message, managed.key, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join('');
  let mismatch = 0;
  for (let i = 0; i < 64; i++) mismatch |= expected.charCodeAt(i) ^ proof.signature.charCodeAt(i);
  if (mismatch) return invalid();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return authFailure_('AUTH_BUSY', 'Please try again shortly.');
  try {
    const saved = parseOwnerRecord_(managed.config.properties.getProperty('OWNER_IDENTITY_CHALLENGES'));
    const entries = Array.isArray(saved) ? saved.filter(function (item) { return item && item.expiresAt > Date.now(); }) : [];
    const index = entries.findIndex(function (item) { return item.id === proof.id && item.nonce === proof.nonce && item.purpose === proof.purpose; });
    if (index < 0) return invalid();
    const challenge = entries[index];
    const session = challenge.sessionKey ? validateOwnerSession_(data.sessionToken) : null;
    if (challenge.sessionKey && (!session || session.key !== challenge.sessionKey)) return invalid();
    entries.splice(index, 1);
    managed.config.properties.setProperty('OWNER_IDENTITY_CHALLENGES', JSON.stringify(entries));
    securityEvent_('identity', 'SUCCESS');
    if (!session) securityEvent_('login', 'SUCCESS');
    return session ? issueOwnerStepUp_(session, challenge.purpose) : issueOwnerSession_(managed.config);
  } finally { lock.releaseLock(); }
}

// ==================== GATED WRITE-AHEAD HISTORY / RESTORE ====================

function assertBackupRestoreVerified_() {
  const properties = PropertiesService.getScriptProperties();
  const verified = properties.getProperty('BACKUP_RESTORE_VERIFIED_AT');
  const reference = properties.getProperty('BACKUP_RESTORE_REFERENCE');
  const timestamp = typeof verified === 'string' ? Date.parse(verified) : NaN;
  if (!Number.isFinite(timestamp) || timestamp > Date.now() || timestamp < Date.now() - 30 * 86400000 ||
      typeof reference !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(reference)) {
    membershipError_('BACKUP_REQUIRED', 'A recent independent backup restore verification is required before enabling history.');
  }
}

function historyStore_() {
  assertBackupRestoreVerified_();
  const properties = PropertiesService.getScriptProperties();
  const book = properties.getProperty('MEMBER_HISTORY_SPREADSHEET_ID');
  const tab = properties.getProperty('MEMBER_HISTORY_SHEET_NAME');
  if (typeof book !== 'string' || !/^[A-Za-z0-9_-]+$/.test(book) || book === properties.getProperty('SPREADSHEET_ID') ||
      typeof tab !== 'string' || !tab.trim()) membershipError_('HISTORY_UNAVAILABLE', 'History storage is unavailable.');
  let sheet;
  try { sheet = SpreadsheetApp.openById(book).getSheetByName(tab); } catch (_) { membershipError_('HISTORY_UNAVAILABLE', 'History storage is unavailable.'); }
  if (!sheet || sheet.getLastRow() > 50000) membershipError_('HISTORY_UNAVAILABLE', 'History storage is unavailable.');
  const rows = sheet.getDataRange().getValues();
  const header = ['Operation ID', 'Member ID', 'Action', 'State', 'Intent', 'Before', 'After', 'At', 'Notification Journal', 'Result'];
  if (JSON.stringify(rows[0]) !== JSON.stringify(header)) membershipError_('HISTORY_UNAVAILABLE', 'History storage is unavailable.');
  return { sheet: sheet, rows: rows };
}

function historyContext_(action, data) {
  if (!memberHistoryEnabled_()) return null;
  if (!data || typeof data.operationId !== 'string' || !/^(?:[a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(data.operationId)) {
    membershipError_('OPERATION_ID_REQUIRED', 'A unique operation ID is required. Refresh the application.');
  }
  const intent = digestOwnerValue_(JSON.stringify([action, data.member || null, data.memberId || null,
    data.membershipType || null, data.startDate || null, data.expectedVersion || null, data.archiveOperationId || null]));
  const store = historyStore_();
  const existing = store.rows.slice(1).filter(function (row) { return row[0] === data.operationId; });
  if (existing.length > 1) membershipError_('HISTORY_REVIEW_REQUIRED', 'History requires owner reconciliation.');
  if (existing.length) {
    const row = existing[0];
    if (row[2] !== action || row[4] !== intent) membershipError_('OPERATION_CONFLICT', 'Operation ID was already used for different details.');
    if (row[3] !== 'COMMITTED') membershipError_('HISTORY_REVIEW_REQUIRED', 'An interrupted operation requires owner reconciliation before retrying.');
    const result = parseOwnerRecord_(row[9]);
    if (!result || result.success !== true) membershipError_('HISTORY_REVIEW_REQUIRED', 'History requires owner reconciliation.');
    return { replay: result };
  }
  if (store.rows.slice(1).some(function (row) { return !['COMMITTED', 'CANCELLED'].includes(row[3]); })) {
    membershipError_('HISTORY_REVIEW_REQUIRED', 'An interrupted operation requires owner reconciliation before further changes.');
  }
  return { sheet: store.sheet, operationId: data.operationId, action: action, intent: intent };
}

function serializedHistoryRow_(row) {
  if (row === null) return 'null';
  if (!Array.isArray(row) || row.length !== 9) membershipError_('HISTORY_UNAVAILABLE', 'Member row has an unexpected structure.');
  const value = JSON.stringify(row.map(function (cell, index) { return index === 6 || index === 7 ? formatDate(cell) : cell; }));
  if (value.length > 20000) membershipError_('HISTORY_UNAVAILABLE', 'Member row exceeds the safe history size.');
  return value;
}

function prepareHistoryMutation_(history, id, before, after, sheet, sourceRow) {
  if (!history) return;
  const row = history.sheet.getLastRow() + 1;
  if (row > history.sheet.getMaxRows()) history.sheet.insertRowsAfter(history.sheet.getMaxRows(), 1);
  history.row = row;
  history.sheet.getRange(row, 1, 1, 10).setNumberFormat('@');
  history.sheet.getRange(row, 1, 1, 10).setValues([[
    history.operationId, id, history.action, 'PENDING', history.intent,
    serializedHistoryRow_(before), serializedHistoryRow_(after), new Date().toISOString(),
    JSON.stringify({ notice: PropertiesService.getScriptProperties().getProperty('EXPIRY_NOTICE_' + id) || '',
      beforeFormats: before && sheet ? sheet.getRange(sourceRow, 1, 1, 9).getNumberFormats()[0] : null,
      phoneDisplay: before && sheet ? sheet.getRange(sourceRow, 3).getDisplayValues()[0][0] : '' }), ''
  ]]);
  SpreadsheetApp.flush(); // Durable intent before touching the live member values.
}

function finishHistoryMutation_(history, result) {
  if (!history) return;
  SpreadsheetApp.flush(); // Complete the member write before committing its journal.
  history.sheet.getRange(history.row, 10).setValue(JSON.stringify(result));
  history.sheet.getRange(history.row, 4).setValue('COMMITTED');
  SpreadsheetApp.flush();
}

function decodeHistoryRow_(serialized, id, metadata) {
  const row = parseOwnerRecord_(serialized);
  if (!Array.isArray(row) || row.length !== 9 || normalizeMemberId_(row[0]) !== id) membershipError_('RESTORE_CONFLICT', 'Archived member is invalid.');
  if (typeof row[1] !== 'string' || /[\u0000-\u001f]/.test(row[1])) membershipError_('RESTORE_CONFLICT', 'Archived name is invalid.');
  const input = validateMemberInput_({ name: row[1], phone: normalizePhone_(row[2], metadata.phoneDisplay), age: row[3], weight: row[4], membershipType: row[5], startDate: row[6] });
  const end = parseMembershipDate_(row[7]);
  if (formatDate(end) < formatDate(input.start)) membershipError_('RESTORE_CONFLICT', 'Archived dates are invalid.');
  return [row[0], row[1], row[2], row[3], row[4], row[5], input.start, end, row[8]];
}

function historyMetadata_(value) {
  const metadata = parseOwnerRecord_(value);
  if (!metadata || typeof metadata.notice !== 'string' || typeof metadata.phoneDisplay !== 'string' || metadata.phoneDisplay.length > 100 || (metadata.beforeFormats !== null &&
      (!Array.isArray(metadata.beforeFormats) || metadata.beforeFormats.length !== 9 ||
       metadata.beforeFormats.some(function (format) { return typeof format !== 'string' || format.length > 256; })))) {
    membershipError_('RESTORE_CONFLICT', 'History metadata is invalid.');
  }
  if (metadata.notice) {
    const notice = parseOwnerRecord_(metadata.notice);
    if (!notice || !/^[a-f0-9]{64}$/.test(notice.term) || !['pending', 'sent', 'failed'].includes(notice.status) ||
        !Number.isInteger(notice.attempts) || notice.attempts < 1 || notice.attempts > 3 || !Number.isFinite(notice.attemptedAt)) {
      membershipError_('RESTORE_CONFLICT', 'Archived notification journal requires manual review.');
    }
  }
  return metadata;
}

function restoreMember_(data, session) {
  if (!memberHistoryEnabled_()) return authFailure_('HISTORY_UNAVAILABLE', 'History restoration is not enabled.');
  if (!consumeOwnerStepUp_(data, session, 'restoreMember', true)) return authFailure_('REAUTHENTICATION_REQUIRED', 'Confirm restoration with a fresh sign-in.');
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('EXPIRY_EMAIL_ENABLED') === 'true' || data.notificationReconciliationConfirmed !== true) {
    return authFailure_('NOTIFICATION_REVIEW_REQUIRED', 'Disable expiry email and reconcile the notification journal before restoration.');
  }
  const id = normalizeMemberId_(data.memberId);
  return withMemberWriteLock_(function () {
    const history = historyContext_('restore', data);
    if (history.replay) return history.replay;
    const store = historyStore_();
    const matches = store.rows.slice(1).filter(function (row) { return row[0] === data.archiveOperationId && row[1] === id && row[3] === 'COMMITTED'; });
    if (matches.length !== 1 || !['update', 'renew', 'delete'].includes(matches[0][2])) membershipError_('RESTORE_CONFLICT', 'No restorable history entry.');
    const archived = matches[0];
    const metadata = historyMetadata_(archived[8]);
    if (!metadata.beforeFormats) membershipError_('RESTORE_CONFLICT', 'Archived cell formats are missing.');
    const after = decodeHistoryRow_(archived[5], id, metadata);
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    const index = rows.findIndex(function (row, position) { return position > 0 && row[0] !== '' && normalizeMemberId_(row[0]) === id; });
    const before = index > 0 ? rows[index] : null;
    // Never overwrite intervening work, or resurrect over an existing ID.
    if (serializedHistoryRow_(before) !== archived[6] || (before && (!data.expectedVersion || data.expectedVersion !== memberVersion_(before)))) {
      membershipError_('RESTORE_CONFLICT', 'Current member differs from the archived operation. Refresh and review before restoring.');
    }
    const high = rememberHighestId_(rows);
    properties.setProperty('MEMBER_ID_HIGH_WATER_MARK', String(Math.max(high, Number(id))));
    prepareHistoryMutation_(history, id, before, after, sheet, index + 1);
    const target = index > 0 ? index + 1 : sheet.getLastRow() + 1;
    if (target > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
    sheet.getRange(target, 1, 1, 9).setNumberFormats([metadata.beforeFormats]);
    sheet.getRange(target, 1, 1, 9).setValues([after]);
    if (metadata.notice) properties.setProperty('EXPIRY_NOTICE_' + id, metadata.notice); else properties.deleteProperty('EXPIRY_NOTICE_' + id);
    revokeLookupForMember_(id);
    finishHistoryMutation_(history, { success: true, memberId: id });
    securityEvent_('restore', 'SUCCESS', id);
    return { success: true, memberId: id };
  });
}

// Editor-only reconciliation. No HTTP route. Verify actual before/after images;
// never label an ambiguous partial write committed merely to unblock the UI.
function reconcileMemberHistory(operationId, resolution) {
  if (!memberHistoryEnabled_() || !['applied', 'not-applied'].includes(resolution)) throw new Error('Invalid history reconciliation.');
  return withMemberWriteLock_(function () {
    const store = historyStore_();
    const matches = store.rows.map(function (row, index) { return { row: row, index: index }; })
      .filter(function (entry) { return entry.index > 0 && entry.row[0] === operationId; });
    if (matches.length !== 1 || matches[0].row[3] !== 'PENDING') throw new Error('Pending history entry required.');
    const entry = matches[0];
    const rows = memberRows_(getMemberSheet_());
    const current = rows.slice(1).find(function (row) { return row[0] !== '' && normalizeMemberId_(row[0]) === entry.row[1]; }) || null;
    const expected = entry.row[resolution === 'applied' ? 6 : 5];
    if (serializedHistoryRow_(current) !== expected) throw new Error('Current data does not match the selected history state.');
    if (resolution === 'not-applied' && current) {
      const metadata = historyMetadata_(entry.row[8]);
      if (!metadata.beforeFormats) throw new Error('Original cell formats unavailable.');
      const index = rows.indexOf(current);
      getMemberSheet_().getRange(index + 1, 1, 1, 9).setNumberFormats([metadata.beforeFormats]);
    }
    if (resolution === 'applied') {
      const result = { success: true, memberId: entry.row[1] };
      if (entry.row[2] === 'renew' && current) result.newEndDate = formatDate(current[7]);
      store.sheet.getRange(entry.index + 1, 10).setValue(JSON.stringify(result));
    }
    store.sheet.getRange(entry.index + 1, 4).setValue(resolution === 'applied' ? 'COMMITTED' : 'CANCELLED');
    securityEvent_('restore', 'SUCCESS', entry.row[1]);
    return { success: true };
  });
}
