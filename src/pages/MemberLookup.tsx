import { useRef, useState } from 'react';
import { Search, Calendar, Award, Clock, Loader2, ShieldCheck } from 'lucide-react';
import { lookupMember, getApiUrl } from '../api/gymApi';
import { gymConfig } from '../config/gymConfig';
import type { PublicMember } from '../types/member';
import { isMembershipDate } from '../utils/membership';

export default function MemberLookup() {
  const [memberId, setMemberId] = useState('');
  const [member, setMember] = useState<PublicMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setMember(null);
    if (!/^\d+$/.test(memberId.trim()) || !Number.isSafeInteger(Number(memberId)) || Number(memberId) < 1) {
      setError('Enter your numeric Member ID, for example 1.'); return;
    }
    if (!getApiUrl()) { setError('Membership lookup is currently unavailable. Please contact the gym.'); return; }
    const version = ++request.current;
    setLoading(true); setError(null);
    const response = await lookupMember(memberId.trim());
    if (version !== request.current) return;
    if (response.success && response.member && isMembershipDate(response.member.endDate)) setMember(response.member);
    else setError(response.error === 'Member not found'
      ? 'No membership found. Check your ID or contact the gym.'
      : 'Could not load your membership. Please try again or contact the gym.');
    setLoading(false);
  };

  return <div className="bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 px-4 py-10 sm:py-14">
    <section className="max-w-lg mx-auto" aria-labelledby="lookup-title">
      <div className="mb-7 text-center">
        <p className="text-emerald-300 text-xs font-semibold tracking-widest uppercase">Your next session starts here</p>
        <h1 id="lookup-title" className="text-3xl sm:text-4xl font-bold mt-3">Check your membership</h1>
        <p className="text-slate-300 mt-3 text-sm">{gymConfig.gym.description}</p>
      </div>
      <form onSubmit={handleSearch} className="rounded-3xl border border-white/15 bg-white/5 p-5 sm:p-6">
        <label htmlFor="member-id" className="block text-sm font-medium mb-2">Member ID</label>
        <input id="member-id" type="text" inputMode="numeric" autoComplete="off" maxLength={16}
          value={memberId} onChange={event => setMemberId(event.target.value)} disabled={loading}
          placeholder="For example, 1" className="w-full px-4 py-3.5 bg-slate-950/60 border border-white/20 rounded-xl text-white" />
        <button disabled={loading} className="w-full mt-4 py-3.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          {loading ? 'Checking…' : 'Check Status'}
        </button>
        <p className="text-xs text-slate-400 mt-3 flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />Your contact details stay private. Contact the gym if you need your ID.</p>
      </form>
      {error && <p role="alert" className="mt-4 border border-red-400/30 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      <div aria-live="polite" aria-busy={loading}>
        {member && <div className="mt-5 rounded-3xl border border-white/15 bg-white/5 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Member #{member.id}</h2>
            <span className={`rounded-full px-3 py-1 text-sm ${member.status === 'Active' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-red-400/15 text-red-200'}`}>{member.status}</span>
          </div>
          <dl className="space-y-4 text-sm">
            <Detail icon={<Award className="h-4 w-4" />} label="Membership plan" value={member.membershipType} />
            <Detail icon={<Calendar className="h-4 w-4" />} label="Expiry date (inclusive)" value={new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(member.endDate + 'T00:00:00+05:30'))} />
            <Detail icon={<Clock className="h-4 w-4" />} label="Days remaining" value={String(member.daysRemaining ?? 0)} />
          </dl>
          {member.status === 'Active' && member.daysRemaining === 0 && <p className="text-sm text-amber-200">Valid through today. Contact the gym to renew.</p>}
        </div>}
      </div>
    </section>
    <section className="max-w-5xl mx-auto mt-14" aria-labelledby="gallery-title">
      <h2 id="gallery-title" className="text-xl font-semibold mb-5">Inside {gymConfig.gym.name}</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {gymConfig.gallery.map((src, i) => <img key={src} src={src} alt={`${gymConfig.gym.name} training space ${i + 1}`} loading="lazy" width={640} height={400} className="rounded-2xl object-cover w-full h-48 border border-white/10" />)}
      </div>
    </section>
  </div>;
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3"><span className="mt-1 text-emerald-300" aria-hidden="true">{icon}</span>
    <div className="min-w-0"><dt className="text-slate-400">{label}</dt><dd className="font-medium mt-0.5 break-words">{value}</dd></div></div>;
}
