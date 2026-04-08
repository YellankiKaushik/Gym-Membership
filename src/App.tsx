import { useState } from 'react';
import Setup from './pages/Setup';
import MemberLookup from './pages/MemberLookup';
import AdminPanel from './pages/Adminpanel';
import { gymConfig } from './config/gymConfig';

export default function App() {
  const [mode, setMode] = useState<'setup' | 'member' | 'admin'>(
    localStorage.getItem('gymApiUrl') ? 'member' : 'setup'
  );

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617] text-white flex flex-col">

      {/* HEADER */}
      <header className="h-24 flex items-center justify-between px-8 border-b border-white/10">
        {/* LEFT — BRAND + TRAINER */}
        <div className="flex flex-col">
          <div className="text-3xl font-extrabold tracking-wide">
            {gymConfig.gym.name}
          </div>

          <div className="text-xs text-purple-300/70">
            {gymConfig.gym.tagline}
          </div>

          {/* TRAINER UNDER BRAND */}
          <div className="mt-1 text-sm text-emerald-400">
            {gymConfig.trainer.name} · {gymConfig.trainer.title}
          </div>
        </div>

        {/* RIGHT — NAV */}
        <nav className="flex gap-6 text-sm font-medium">
          <button
            onClick={() => setMode('member')}
            className={`transition ${mode === 'member'
                ? 'text-emerald-400'
                : 'text-purple-300 hover:text-white'
              }`}
          >
            Member Lookup
          </button>

          <button
            onClick={() => setMode('admin')}
            className={`transition ${mode === 'admin'
                ? 'text-emerald-400'
                : 'text-purple-300 hover:text-white'
              }`}
          >
            Admin Panel
          </button>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        {mode === 'setup' && <Setup onComplete={() => setMode('member')} />}
        {mode === 'member' && <MemberLookup />}
        {mode === 'admin' && <AdminPanel />}
      </main>

      {/* FOOTER */}
      <footer className="h-16 flex items-center justify-center border-t border-white/10 text-sm">
        <a
          href={gymConfig.address.mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-purple-300 hover:text-white transition"
        >
          <span className="text-lg">📍</span>
          {gymConfig.address.label}
        </a>
      </footer>
    </div>
  );
}
