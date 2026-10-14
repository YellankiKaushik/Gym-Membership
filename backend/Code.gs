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

    return createResponse({
      success: false,
      code: err && err.message === 'MEMBER_SHEET_UNAVAILABLE' ? 'MEMBER_SHEET_UNAVAILABLE' : 'REQUEST_FAILED',
      error: err && err.message === 'MEMBER_SHEET_UNAVAILABLE'
        ? 'Member Sheet unavailable. Check spreadsheet and tab configuration or access.'
        : 'Unable to complete request'
    });
  }
}

// ==================== READ ====================

function handleMemberLookup(memberId) {

  if (!memberId) {

    return createResponse({
      success: false,
      error: 'Member ID required'
    });
  }

  const sheet = getMemberSheet_();
  const rows = sheet.getDataRange().getValues();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < rows.length; i++) {

    if (!rows[i][0]) continue;

    if (
      String(rows[i][0]).trim() ===
      String(memberId).trim()
    ) {

      const end = new Date(rows[i][7]);
      end.setHours(0, 0, 0, 0);

      const days = Math.ceil(
        (end - today) / 86400000
      );

      return createResponse({
        success: true,
        member: {
          id: rows[i][0],
          name: rows[i][1],
          phone: maskPhone(rows[i][2]),
          membershipType: rows[i][5],
          startDate: formatDate(rows[i][6]),
          endDate: formatDate(end),
          status: days >= 0 ? 'Active' : 'Expired',
          daysRemaining: Math.max(days, 0)
        }
      });
    }
  }

  return createResponse({
    success: false,
    error: 'Member not found'
  });
}

function handleGetAllMembers() {

  const sheet = getMemberSheet_();
  const rows = sheet.getDataRange().getValues();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const members = [];

  for (let i = 1; i < rows.length; i++) {

    if (!rows[i][0]) continue;

    const end = new Date(rows[i][7]);
    end.setHours(0, 0, 0, 0);

    const days = Math.ceil(
      (end - today) / 86400000
    );

    members.push({
      id: rows[i][0],
      name: rows[i][1],
      phone: rows[i][2],
      age: rows[i][3],
      weight: rows[i][4],
      membershipType: rows[i][5],
      startDate: formatDate(rows[i][6]),
      endDate: formatDate(end),
      status: days >= 0 ? 'Active' : 'Expired',
      daysRemaining: days
    });
  }

  return createResponse({
    success: true,
    members
  });
}

// ==================== CREATE ====================

function addMember(m) {

  const name = String(m.name || '').trim();
  const phone = String(m.phone || '').trim();

  if (name === '' || phone === '') {

    return {
      success: false,
      error: 'Name and Phone are required'
    };
  }

  if (!/^\d{10}$/.test(phone)) {

    return {
      success: false,
      error: 'Phone must be exactly 10 digits'
    };
  }

  const sheet = getMemberSheet_();

  // GENERATE UNIQUE ID
  const generatedId = generateNextId(sheet);

  // CALCULATE END DATE
  const end = calculateEndDate(
    new Date(m.startDate),
    m.membershipType
  );

  // SAVE
  sheet.appendRow([
    generatedId,
    name,
    phone,
    m.age,
    m.weight,
    m.membershipType,
    new Date(m.startDate),
    end,
    false
  ]);

  return {
    success: true,
    memberId: generatedId
  };
}

function generateNextId(sheet) {

  const rows = sheet.getDataRange().getValues();

  let maxId = 0;

  for (let i = 1; i < rows.length; i++) {

    const currentId = parseInt(rows[i][0], 10);

    if (!isNaN(currentId)) {
      maxId = Math.max(maxId, currentId);
    }
  }

  return String(maxId + 1).padStart(3, '0');
}

// ==================== UPDATE ====================

function updateMember(m) {

  const name = String(m.name || '').trim();
  const phone = String(m.phone || '').trim();

  if (!m.id) {

    return {
      success: false,
      error: 'ID required'
    };
  }

  if (name === '' || phone === '') {

    return {
      success: false,
      error: 'Name and Phone are required'
    };
  }

  if (!/^\d{10}$/.test(phone)) {

    return {
      success: false,
      error: 'Phone must be exactly 10 digits'
    };
  }

  const sheet = getMemberSheet_();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {

    if (
      String(rows[i][0]).trim() ===
      String(m.id).trim()
    ) {

      const start = new Date(
        m.startDate || rows[i][6]
      );

      const membershipType =
        m.membershipType || rows[i][5];

      const end = calculateEndDate(
        start,
        membershipType
      );

      // COLUMN STRUCTURE
      // A = ID
      // B = Name
      // C = Phone
      // D = Age
      // E = Weight
      // F = Membership Type
      // G = Start Date
      // H = End Date
      // I = Notified Flag

      sheet.getRange(i + 1, 2).setValue(name);
      sheet.getRange(i + 1, 3).setValue(phone);
      sheet.getRange(i + 1, 4).setValue(m.age);
      sheet.getRange(i + 1, 5).setValue(m.weight);
      sheet.getRange(i + 1, 6).setValue(membershipType);
      sheet.getRange(i + 1, 7).setValue(start);
      sheet.getRange(i + 1, 8).setValue(end);

      // RESET NOTIFICATION FLAG
      sheet.getRange(i + 1, 9).setValue(false);

      return {
        success: true
      };
    }
  }

  return {
    success: false,
    error: 'Member not found'
  };
}

// ==================== RENEW ====================

function renewMember(data) {

  const sheet = getMemberSheet_();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {

    if (
      String(rows[i][0]).trim() ===
      String(data.memberId).trim()
    ) {

      const start = new Date(data.startDate);

      const end = calculateEndDate(
        start,
        data.membershipType
      );

      // UPDATE MEMBERSHIP DATA

      sheet.getRange(i + 1, 6)
        .setValue(data.membershipType);

      sheet.getRange(i + 1, 7)
        .setValue(start);

      sheet.getRange(i + 1, 8)
        .setValue(end);

      // RESET NOTIFIED FLAG

      sheet.getRange(i + 1, 9)
        .setValue(false);

      return {
        success: true
      };
    }
  }

  return {
    success: false,
    error: 'Member not found'
  };
}
// ==================== DELETE ====================

function deleteMember(memberId) {

  const sheet = getMemberSheet_();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {

    if (
      String(rows[i][0]).trim() ===
      String(memberId).trim()
    ) {

      sheet.deleteRow(i + 1);

      return {
        success: true
      };
    }
  }

  return {
    success: false,
    error: 'Member not found'
  };
}

// ==================== EMAIL ====================

function checkMembershipExpiries(testMode = false) {

  const sheet = getMemberSheet_();

  const rows = sheet.getDataRange().getValues();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alerts = [];
  const notifiedStates = [];

  for (let i = 1; i < rows.length; i++) {

    // SKIP EMPTY ROWS
    if (!rows[i][0]) {

      notifiedStates.push([rows[i][8]]);
      continue;
    }

    const end = new Date(rows[i][7]);

    // INVALID DATE GUARD
    if (isNaN(end.getTime())) {

      notifiedStates.push([rows[i][8]]);
      continue;
    }

    end.setHours(0, 0, 0, 0);

    const days = Math.ceil(
      (end - today) / 86400000
    );

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

function calculateEndDate(start, type) {

  const d = new Date(start);

  if (type === '3 Months') {
    d.setMonth(d.getMonth() + 3);
  }

  if (type === '6 Months') {
    d.setMonth(d.getMonth() + 6);
  }

  if (type === '1 Year') {
    d.setFullYear(d.getFullYear() + 1);
  }

  return d;
}

function formatDate(d) {

  return Utilities.formatDate(
    new Date(d),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

function maskPhone(p) {
  const phone = String(p || '');
  return phone.length > 4 ? 'XXXXXX' + phone.slice(-4) : 'XXXX';
}

function createResponse(obj) {

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
