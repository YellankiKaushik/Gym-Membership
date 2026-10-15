import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import MemberLookup from './pages/MemberLookup';
import AdminPanel from './pages/Adminpanel';
import { gymConfig } from './config/gymConfig';

export default function App() {
  const [mode, setMode] = useState<'member' | 'admin'>('member');
  return <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col">
    <header className="border-b border-white/10 bg-slate-950/90">
      <div className="mx-auto max-w-6xl px-4 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {gymConfig.logo ? <img src={gymConfig.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl object-contain" />
            : <Dumbbell className="h-10 w-10 shrink-0 text-emerald-400" aria-hidden="true" />}
          <div className="min-w-0 break-words">
            <p className="text-2xl font-extrabold tracking-tight">{gymConfig.gym.name}</p>
            <p className="text-xs text-slate-300 mt-1">{gymConfig.gym.tagline}</p>
            <p className="text-xs text-emerald-300 mt-1">{gymConfig.trainer.name} · {gymConfig.trainer.title}</p>
          </div>
        </div>
        <nav aria-label="Main navigation" className="grid grid-cols-2 gap-2 sm:flex shrink-0">
          {(['member', 'admin'] as const).map(view => <button key={view} onClick={() => setMode(view)}
            aria-current={mode === view ? 'page' : undefined}
            className={`min-h-11 px-4 py-2 rounded-xl text-sm font-medium ${mode === view ? 'bg-emerald-400 text-slate-950' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}>
            {view === 'member' ? 'Member Lookup' : 'Owner Dashboard'}
          </button>)}
        </nav>
      </div>
    </header>
    <main className="flex-1 min-w-0">{mode === 'member' ? <MemberLookup /> : <AdminPanel />}</main>
    <footer className="border-t border-white/10 p-5 text-center text-sm text-slate-300 space-y-2 break-words">
      <a href={gymConfig.address.mapLink} target="_blank" rel="noopener noreferrer" className="inline-block hover:text-white">{gymConfig.address.label}</a>
      {gymConfig.contact.phone && <p>{gymConfig.contact.phone}</p>}
      {gymConfig.contact.email && <p>{gymConfig.contact.email}</p>}
    </footer>
  </div>;
}
