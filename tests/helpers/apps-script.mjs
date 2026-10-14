import { readFileSync } from 'node:fs';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import vm from 'node:vm';

const vendor = readFileSync(new URL('../../backend/Bcrypt.gs', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../../backend/Auth.gs', import.meta.url), 'utf8');
const code = readFileSync(new URL('../../backend/Code.gs', import.meta.url), 'utf8');
const hashing = vm.createContext({ crypto: webcrypto, setTimeout, clearTimeout });
vm.runInContext(vendor, hashing);
export const password = 'Synthetic-owner-password!';
export const ownerId = 'synthetic-gym-owner';
export const verifier = hashing.bcrypt.hashSync(password, 12);

export function createBackend(overrides = {}, options = {}) {
  let clock = Date.parse('2026-10-14T12:00:00+05:30');
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const properties = new Map(Object.entries({
    OWNER_ID: ownerId, OWNER_PASSWORD_HASH: verifier, ADMIN_EMAIL: 'owner@example.invalid', ...overrides,
  }).filter(([, value]) => value !== undefined));
  const rows = [
    ['ID', 'Name', 'Phone', 'Age', 'Weight', 'Plan', 'Start', 'End', 'Notified'],
    ['001', 'Synthetic Member', '9999999999', 30, 70, '3 Months', new Date('2026-07-15'), new Date('2026-10-15'), false],
  ];
  const state = { sheetReads: 0, sheetWrites: 0, emails: [], logs: [], lockHeld: false, lockAvailable: true };
  const sheet = {
    getName: () => 'Members',
    getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }),
    appendRow: row => { state.sheetWrites++; rows.push(row); },
    deleteRow: row => { state.sheetWrites++; rows.splice(row - 1, 1); },
    getRange: (row, column, count = 1, width = 1) => ({
      getDisplayValues: () => rows.slice(row - 1, row - 1 + count).map(values =>
        values.slice(column - 1, column - 1 + width).map(String)),
      setValue(value) { state.sheetWrites++; rows[row - 1][column - 1] = value; },
      setValues(values) {
        state.sheetWrites++;
        if (values.length !== count) throw new Error('Wrong range height');
        values.forEach((valuesRow, i) => valuesRow.forEach((value, j) => { rows[row - 1 + i][column - 1 + j] = value; }));
      },
    }),
  };
  const getSheet = () => { state.sheetReads++; return sheet; };
  const store = {
    getProperty: key => properties.get(key) ?? null,
    setProperty: (key, value) => { properties.set(key, String(value)); return store; },
    deleteProperty: key => { properties.delete(key); return store; },
    getProperties: () => Object.fromEntries(properties),
  };
  // Intentionally omit Node modules, Web Crypto and timers in the GAS context.
  // Password verification must work with the same synchronous vendor API as Apps Script.
  const context = vm.createContext({
    Date: ClockDate,
    PropertiesService: { getScriptProperties: () => store },
    SpreadsheetApp: { getActiveSheet: getSheet, getActiveSpreadsheet: () => ({
      getActiveSheet: getSheet, getId: () => 'SYNTHETIC-STAGING-BOOK',
    }) },
    console: { log: value => state.logs.push(String(value)) },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()],
      getUuid: randomUUID,
      formatDate: value => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(value)),
    },
    LockService: { getScriptLock: () => ({
      tryLock: () => { state.lockHeld = state.lockAvailable; return state.lockAvailable; },
      releaseLock: () => { state.lockHeld = false; },
    }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ text, setMimeType() { return this; } }),
    },
    GmailApp: { sendEmail: (...args) => state.emails.push(args) },
  });
  const files = { 'Bcrypt.gs': vendor, 'Auth.gs': auth, 'Code.gs': code };
  for (const filename of options.fileOrder || ['Bcrypt.gs', 'Auth.gs', 'Code.gs']) {
    vm.runInContext(files[filename], context, { filename });
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
