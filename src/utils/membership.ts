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

export type MembershipFilter = 'all' | 'active' | 'expiring' | 'expired';

export function membershipState(endDate: string, today = gymToday()) {
  const daysRemaining = Math.round((Date.parse(endDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
  const active = isMembershipDate(endDate) && daysRemaining >= 0;
  return { status: active ? 'Active' as const : 'Expired' as const,
    daysRemaining, expiringSoon: active && daysRemaining <= 7 };
}

type SearchableMember = { id: string; name: string; phone: string; endDate: string };

export function memberSummary(members: SearchableMember[], today = gymToday()) {
  const states = members.map(m => membershipState(m.endDate, today));
  return { total: members.length, active: states.filter(s => s.status === 'Active').length,
    expiring: states.filter(s => s.expiringSoon).length, expired: states.filter(s => s.status === 'Expired').length };
}

export function filterMembers<T extends SearchableMember>(members: T[], filter: MembershipFilter, search: string, today = gymToday()): T[] {
  const term = search.trim().toLowerCase();
  const phoneSearch = /^[+\d ()-]+$/.test(term) ? term.replace(/\D/g, '') : '';
  return members.filter(member => {
    const state = membershipState(member.endDate, today);
    const statusMatch = filter === 'all' || (filter === 'active' && state.status === 'Active') ||
      (filter === 'expired' && state.status === 'Expired') || (filter === 'expiring' && state.expiringSoon);
    const id = /^\d{1,9}$/.test(term) ? String(Number(term)) : term;
    return statusMatch && (!term || member.id.includes(term) || member.id === id ||
      member.name.toLowerCase().includes(term) || member.phone.includes(term) ||
      (!!phoneSearch && member.phone.replace(/\D/g, '').includes(phoneSearch)));
  }).sort((a, b) => a.endDate.localeCompare(b.endDate) || Number(a.id) - Number(b.id));
}
