export const MEMBERSHIP_PLANS = ['1 Month', '3 Months', '6 Months', '1 Year'] as const;
export type MembershipPlan = typeof MEMBERSHIP_PLANS[number];

export function isMembershipDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function gymToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function dayAfter(date: string): string {
  if (!isMembershipDate(date)) throw new Error('Invalid membership date');
  const next = new Date(date + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function suggestedRenewalStart(endDate: string, today = gymToday()): string {
  const next = dayAfter(endDate);
  return next > today ? next : today;
}

export function renewalDateError(start: string, currentEnd: string): string | null {
  if (!isMembershipDate(start)) return 'Enter a valid renewal start date as YYYY-MM-DD.';
  if (!isMembershipDate(currentEnd)) return 'Current expiry is invalid. Correct the member record first.';
  if (start <= currentEnd) return 'Renewal must start after the current end date to preserve paid time. Choose a later date.';
  return null;
}
