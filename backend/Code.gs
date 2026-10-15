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
        return createResponse(deleteMember(data.memberId));

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
  const days = dateOrdinal_(endDate) - dateOrdinal_(todayDate_());
  return {
    id: normalizeMemberId_(row[0]), name: String(row[1] || ''),
    phone: normalizePhone_(row[2], displayedPhone), age: row[3], weight: row[4],
    membershipType: row[5], startDate: startDate, endDate: endDate,
    status: days >= 0 ? 'Active' : 'Expired', daysRemaining: days
  };
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
    delete member.age;
    delete member.weight;
    member.phone = maskPhone(member.phone);
    member.daysRemaining = Math.max(member.daysRemaining, 0);
    return createResponse({ success: true, member: member });
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
  const name = String(member.name || '').trim();
  const phone = normalizePhone_(member.phone);
  if (!name || !/^[\d ()+-]+$/.test(phone) || phone.replace(/\D/g, '').length !== 10) {
    membershipError_('INVALID_MEMBER', 'Name and a 10-digit phone are required.');
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
      const unchangedTerm = formatDate(rows[i][6]) === m.startDate && rows[i][5] === m.membershipType;
      const end = unchangedTerm ? parseMembershipDate_(formatDate(rows[i][7])) : input.end;
      sheet.getRange(i + 1, 3).setNumberFormat('@');
      sheet.getRange(i + 1, 7, 1, 2).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(i + 1, 2, 1, 8).setValues([[
        input.name, input.phone, m.age, m.weight, m.membershipType, input.start, end, false
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

function deleteMember(memberId) {
  const id = normalizeMemberId_(memberId);
  return withMemberWriteLock_(function () {
    const sheet = getMemberSheet_();
    const rows = memberRows_(sheet);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === '' || rows[i][0] == null || normalizeMemberId_(rows[i][0]) !== id) continue;
      // Seed before deleting even when no member has been created by this version.
      rememberHighestId_(rows);
      sheet.deleteRow(i + 1);
      return { success: true };
    }
    return { success: false, error: 'Member not found' };
  });
}

// ==================== EMAIL ====================

function checkMembershipExpiries(testMode = false) {

  const sheet = getMemberSheet_();

  const rows = sheet.getDataRange().getValues();

  const today = todayDate_();

  const alerts = [];
  const notifiedStates = [];

  for (let i = 1; i < rows.length; i++) {

    // SKIP EMPTY ROWS
    if (!rows[i][0]) {

      notifiedStates.push([rows[i][8]]);
      continue;
    }

    let end;
    try { end = formatDate(rows[i][7]); } catch (_) {
      notifiedStates.push([rows[i][8]]);
      continue;
    }
    const days = dateOrdinal_(end) - dateOrdinal_(today);

    const notified = rows[i][8];

    // ALREADY NOTIFIED
    if (!testMode && notified && days > 7) {

      notifiedStates.push([true]);
      continue;
    }

    // EXPIRED OR EXPIRING IN 7 DAYS
    if (days < 0 || days <= 7) {

      let statusText = '';

      if (days < 0) {

        statusText =
          `Expired ${Math.abs(days)} day(s) ago`;

      } else if (days === 0) {

        statusText = 'Expires today';

      } else {

        statusText =
          `Expires in ${days} day(s)`;
      }

      alerts.push({
        id: rows[i][0],
        name: rows[i][1],
        phone: rows[i][2],
        end: formatDate(end),
        status: statusText
      });

      notifiedStates.push([true]);

    } else {

      notifiedStates.push([
        notified || false
      ]);
    }
  }

  // BATCH UPDATE
  if (!testMode && notifiedStates.length > 0) {

    sheet
      .getRange(2, 9, notifiedStates.length, 1)
      .setValues(notifiedStates);
  }

  // SEND EMAIL
  if (alerts.length > 0) {
    sendAdminEmail(alerts);
  }
}

// ==================== EMAIL FORMAT ====================

function sendAdminEmail(list) {

  const email =
    PropertiesService
      .getScriptProperties()
      .getProperty('ADMIN_EMAIL');

  if (!email) return;

  let body =
    `Membership Alerts | ${CONFIG.GYM_NAME}\n\n`;

  list.forEach((m, i) => {

    body += `${i + 1}. ${m.name}\n`;
    body += `ID: ${m.id}\n`;
    body += `Phone: ${m.phone}\n`;
    body += `Status: ${m.status}\n`;
    body += `Ends: ${m.end}\n\n`;
  });

  body +=
    `— ${CONFIG.GYM_NAME}, ${CONFIG.LOCATION}`;

  GmailApp.sendEmail(
    email,
    `Membership Expiry Alert | ${CONFIG.GYM_NAME}`,
    body
  );
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
