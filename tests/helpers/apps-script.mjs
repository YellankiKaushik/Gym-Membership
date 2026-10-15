import { readFileSync } from 'node:fs';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import vm from 'node:vm';

const vendor = readFileSync(new URL('../../backend/Bcrypt.gs', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../../backend/Auth.gs', import.meta.url), 'utf8');
const code = readFileSync(new URL('../../backend/Code.gs', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('../../backend/generated/FitZone_Complete.gs', import.meta.url), 'utf8');
const hashing = vm.createContext({ crypto: webcrypto, setTimeout, clearTimeout });
vm.runInContext(vendor, hashing);
export const password = 'Synthetic-owner-password!';
export const ownerId = 'synthetic-gym-owner';
export const verifier = hashing.bcrypt.hashSync(password, 12);

export function createBackend(overrides = {}, options = {}) {
  let clock = options.now ?? Date.parse('2026-10-14T12:00:00+05:30');
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const properties = options.shared?.properties || new Map(Object.entries({
    OWNER_ID: ownerId, OWNER_PASSWORD_HASH: verifier, ADMIN_EMAIL: 'owner@example.invalid', EXPIRY_EMAIL_ENABLED: 'true',
    SPREADSHEET_ID: 'SYNTHETIC-STAGING-BOOK', MEMBER_SHEET_NAME: 'Members', ...overrides,
  }).filter(([, value]) => value !== undefined));
  const rows = options.shared?.rows || [
    ['ID', 'Name', 'Phone', 'Age', 'Weight', 'Plan', 'Start', 'End', 'Notified'],
    ['001', 'Synthetic Member', '9999999999', 30, 70, '3 Months', new Date('2026-07-15'), new Date('2026-10-15'), false],
  ];
  const state = options.shared?.state || { maxRows: options.maxRows || 1000, formats: [], flushes: 0, failWrites: false, sheetReads: 0, sheetWrites: 0, spreadsheetOpens: [], tabSelections: [],
    emails: [], logs: [], lockHeld: false, lockAvailable: true };
  const sheet = {
    getName: () => options.sheetName || 'Members',
    getLastRow: () => rows.length,
    getMaxRows: () => state.maxRows,
    insertRowsAfter: (_, count) => { state.maxRows += count; },
    getDataRange: () => ({ getValues: () => { state.sheetReads++; return rows.map(row => [...row]); } }),
    appendRow: row => { state.sheetWrites++; rows.push(row); },
    deleteRow: row => { state.sheetWrites++; rows.splice(row - 1, 1); },
    getRange: (row, column, count = 1, width = 1) => ({
      getDisplayValues: () => rows.slice(row - 1, row - 1 + count).map(values =>
        values.slice(column - 1, column - 1 + width).map((value, j) =>
          column + j === 3 && options.phoneDisplays?.[rows.indexOf(values) + 1] !== undefined
            ? options.phoneDisplays[rows.indexOf(values) + 1] : String(value))),
      setNumberFormat: format => { state.formats.push({ row, column, count, width, format }); },
      setValue(value) { state.sheetWrites++; if (state.failWrites) throw new Error('Synthetic Sheet write failure'); rows[row - 1][column - 1] = value; },
      setValues(values) {
        state.sheetWrites++;
        if (state.failWrites) throw new Error('Synthetic Sheet write failure');
        if (values.length !== count) throw new Error('Wrong range height');
        values.forEach((valuesRow, i) => valuesRow.forEach((value, j) => { rows[row - 1 + i] ||= []; rows[row - 1 + i][column - 1 + j] = value; }));
      },
    }),
  };
  const store = {
    getProperty: key => properties.get(key) ?? null,
    setProperty: (key, value) => { options.beforePropertyWrite?.(key, value); properties.set(key, String(value));
      if (key === 'MEMBER_ID_HIGH_WATER_MARK') options.onCounterWrite?.();
      return store; },
    deleteProperty: key => { properties.delete(key); return store; },
    getProperties: () => Object.fromEntries(properties),
  };
  // Intentionally omit Node modules, Web Crypto and timers in the GAS context.
  // Password verification must work with the same synchronous vendor API as Apps Script.
  const context = vm.createContext({
    Date: ClockDate,
    PropertiesService: { getScriptProperties: () => store },
    SpreadsheetApp: {
      flush: () => { state.flushes++; },
      openById: id => {
        state.spreadsheetOpens.push(id);
        if (id !== 'SYNTHETIC-STAGING-BOOK') throw new Error('Private Google error for ' + id);
        return { getSheetByName: name => {
          state.tabSelections.push(name);
          return name === sheet.getName() ? sheet : null;
        } };
      },
      getActiveSheet: () => { throw new Error('Active Sheet unavailable in web app'); },
      getActiveSpreadsheet: () => { throw new Error('Active spreadsheet unavailable in web app'); },
    },
    console: { log: value => state.logs.push(String(value)) },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()],
      getUuid: randomUUID,
      parseDate: value => new Date(value + 'T00:00:00+05:30'),
      formatDate: value => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(value)),
    },
    LockService: { getScriptLock: () => {
      let acquired = false;
      return {
        tryLock: () => {
          if (!state.lockAvailable || state.lockHeld) return false;
          acquired = true; state.lockHeld = true; return true;
        },
        releaseLock: () => { if (acquired) { acquired = false; state.lockHeld = false; } },
      };
    } },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ text, setMimeType() { return this; } }),
    },
    GmailApp: { sendEmail: (...args) => { options.onEmail?.(...args); if (state.failEmail) throw new Error('Synthetic rejected email'); state.emails.push(args); } },
  });
  const files = { 'Bcrypt.gs': vendor, 'Auth.gs': auth, 'Code.gs': code };
  const format = options.format || (process.env.FITZONE_TEST_BACKEND === 'bundle' ? 'bundle' : 'source');
  if (format === 'bundle' && !options.fileOrder) {
    vm.runInContext(bundle, context, { filename: 'FitZone_Complete.gs' });
  } else {
    for (const filename of options.fileOrder || ['Bcrypt.gs', 'Auth.gs', 'Code.gs']) {
      vm.runInContext(files[filename], context, { filename });
    }
  }
  const decode = response => JSON.parse(response.text);
  return {
    context, properties, rows, state, Date: ClockDate,
    advance: milliseconds => { clock += milliseconds; },
    post: value => decode(context.doPost({ postData: { contents: JSON.stringify(value) } })),
    rawPost: event => decode(context.doPost(event)),
    get: parameter => decode(context.doGet({ parameter })),
    login: () => decode(context.doPost({ postData: { contents: JSON.stringify({ action: 'login', ownerId, password }) } })),
  };
}
