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

  try {

    if (!e || !e.postData || typeof e.postData.contents !== 'string' ||
        e.postData.contents.length > 16384) {
      return createResponse(authFailure_('INVALID_REQUEST', 'Invalid request'));
    }
    const data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.action !== 'string') {
      return createResponse(authFailure_('INVALID_REQUEST', 'Invalid request'));
    }
    if (data.action === 'login') return createResponse(loginOwner_(data));
    const session = validateOwnerSession_(data.sessionToken);
    if (!session) return createResponse(authFailure_('UNAUTHORIZED', 'Session expired or invalid. Please log in.'));
    if (data.action === 'logout') {
      session.properties.deleteProperty(session.key);
      return createResponse({ success: true });
    }

    switch (data.action) {

      // Protected member fetch (login never returns member records).
      case 'getAll':
        return handleGetAllMembers();

      // CREATE MEMBER
      case 'addMember':
        return createResponse(addMember(data.member));

      // UPDATE MEMBER
      case 'updateMember':
        return createResponse(updateMember(data.member));

      // RENEW MEMBER
      case 'renewMember':
        return createResponse(renewMember(data));

      // DELETE MEMBER
      case 'deleteMember':
        return createResponse(deleteMember(data.memberId, data.expectedVersion));

      default:

        return createResponse({
          success: false,
          error: 'Invalid action'
        });
    }

  } catch (err) {

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
  if (expected !== undefined && expected !== memberVersion_(row)) {
    membershipError_('STALE_MEMBER', 'This member changed in Sheets or another session. Refresh and reopen the form before saving.');
  }
}

function handleMemberLookup(memberId) {
  if (!memberId) return createResponse({ success: false, error: 'Member ID required' });
  const id = normalizeMemberId_(memberId);
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

function addMember(m) {
  const input = validateMemberInput_(m);
  return withMemberWriteLock_(function () {
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    const next = rememberHighestId_(rows) + 1;
    if (!Number.isSafeInteger(next)) membershipError_('INVALID_ID_COUNTER', 'Member ID limit reached.');
    // Reserve before any Sheet write. Failed writes can leave gaps, never reused IDs.
    PropertiesService.getScriptProperties().setProperty('MEMBER_ID_HIGH_WATER_MARK', String(next));
    const row = sheet.getLastRow() + 1;
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
    sheet.getRange(row, 1).setNumberFormat('@');
    sheet.getRange(row, 3).setNumberFormat('@');
    sheet.getRange(row, 7, 1, 2).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(row, 1, 1, 9).setValues([[
      String(next), input.name, input.phone, m.age, m.weight, m.membershipType,
      input.start, input.end, false
    ]]);
    return { success: true, memberId: String(next) };
  });
}

function updateMember(m) {
  const input = validateMemberInput_(m);
  const id = normalizeMemberId_(m.id);
  return withMemberWriteLock_(function () {
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === '' || rows[i][0] == null || normalizeMemberId_(rows[i][0]) !== id) continue;
      // A contact-only edit must preserve a manually extended or renewed expiry.
      assertMemberVersion_(rows[i], m.version);
      const unchangedTerm = formatDate(rows[i][6]) === m.startDate && rows[i][5] === m.membershipType;
      const end = unchangedTerm ? parseMembershipDate_(formatDate(rows[i][7])) : input.end;
      sheet.getRange(i + 1, 3).setNumberFormat('@');
      sheet.getRange(i + 1, 7, 1, 2).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(i + 1, 2, 1, 8).setValues([[
        input.name, input.phone, m.age, m.weight, m.membershipType, input.start, end,
        unchangedTerm ? rows[i][8] : false
      ]]);
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
      sheet.getRange(i + 1, 7, 1, 2).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(i + 1, 6, 1, 4).setValues([[data.membershipType, start, end, false]]);
      return { success: true, newEndDate: formatDate(end) };
    }
    return { success: false, error: 'Member not found' };
  });
}

function deleteMember(memberId, expectedVersion) {
  const id = normalizeMemberId_(memberId);
  return withMemberWriteLock_(function () {
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === '' || rows[i][0] == null || normalizeMemberId_(rows[i][0]) !== id) continue;
      // Seed before deleting even when no member has been created by this version.
      assertMemberVersion_(rows[i], expectedVersion);
      rememberHighestId_(rows);
      sheet.deleteRow(i + 1);
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
