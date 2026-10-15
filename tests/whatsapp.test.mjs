import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

const bundle = await build({ entryPoints: ['src/utils/whatsapp.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, Date, Intl });
const ui = module.exports;

test('WhatsApp accepts Indian mobiles with country prefix and common formatting', () => {
  for (const phone of ['9876543210', '+91 98765 43210', '919876543210', '(98765) 43210', '+91-98765-43210']) {
    assert.equal(ui.indianWhatsAppNumber(phone), '919876543210');
  }
});

test('WhatsApp rejects missing, foreign, truncated, ambiguous and malformed phone numbers', () => {
  for (const phone of ['', '0000000000', '1234567890', '987654321', '09876543210', '+1 9876543210',
    '9876543210123', 'call9876543210', '9876543210ext1', '91+9876543210', '+9876543210', '9.876543210e9']) {
    assert.equal(ui.indianWhatsAppNumber(phone), null);
  }
});

test('personalized official click-to-chat URL has the actual gym, name and expiry and safely encodes text', () => {
  const result = ui.whatsAppReminder({ name: 'Rahul & Example', phone: '9876543210', endDate: '2026-10-20' }, 'FitZone Gym');
  const url = new URL(result.url);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/919876543210');
  assert.equal(url.searchParams.get('text'), 'Hello Rahul & Example, your FitZone Gym membership expires on 20 October 2026. Please contact the gym to renew your membership. Thank you.');
  assert.equal(result.error, null);
});

test('invalid phone or expiry returns actionable error without generating a URL', () => {
  const member = { name: 'STAGING ONLY Example', phone: '', endDate: '2026-10-20' };
  assert.match(ui.whatsAppReminder(member, 'Example Gym').error, /add a phone/);
  assert.equal(ui.whatsAppReminder({ ...member, phone: '9876543210', endDate: '2026-02-31' }, 'Example').url, null);
});
