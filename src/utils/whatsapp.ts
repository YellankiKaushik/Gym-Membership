import { isMembershipDate } from './membership';

export function indianWhatsAppNumber(phone: string): string | null {
  const value = phone.trim();
  if (!/^\+?[\d ()-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (value.startsWith('+') && !/^91[6-9]\d{9}$/.test(digits)) return null;
  if (/^[6-9]\d{9}$/.test(digits)) return '91' + digits;
  return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function whatsAppReminder(member: { name: string; phone: string; endDate: string }, gymName: string) {
  const phone = indianWhatsAppNumber(member.phone);
  if (!phone) return { url: null, message: null, error: member.phone.trim()
    ? 'WhatsApp unavailable: enter a valid Indian mobile number (10 digits, optionally +91).'
    : 'WhatsApp unavailable: add a phone number in Edit Member.' };
  if (!isMembershipDate(member.endDate)) return { url: null, message: null, error: 'WhatsApp unavailable: correct the membership expiry date.' };
  if (!member.name.trim() || !gymName.trim()) return { url: null, message: null, error: 'WhatsApp unavailable: correct the member or gym name.' };
  const expiry = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(member.endDate + 'T00:00:00+05:30'));
  const message = `Hello ${member.name.trim()}, your ${gymName.trim()} membership expires on ${expiry}. Please contact the gym to renew your membership. Thank you.`;
  return { url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`, message, error: null };
}
