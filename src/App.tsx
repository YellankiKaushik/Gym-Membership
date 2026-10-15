import { useState } from "react";
import { Dumbbell, ArrowUpRight, MapPin } from "lucide-react";
import MemberLookup from "./pages/MemberLookup";
import AdminPanel from "./pages/Adminpanel";
import { gymConfig } from "./config/gymConfig";

export default function App() {
  const [mode, setMode] = useState<"member" | "admin">("member");
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="page-container header-inner">
          <div className="brand">
            <span className="brand-mark">
              {gymConfig.logo ? (
                <img src={gymConfig.logo} alt="" />
              ) : (
                <Dumbbell aria-hidden="true" />
              )}
            </span>
            <div className="brand-copy">
              <p className="brand-name">
                {gymConfig.gym.name}
                <span className="brand-period">.</span>
              </p>
              <p className="brand-tagline">{gymConfig.gym.tagline}</p>
            </div>
          </div>
          <nav aria-label="Main navigation" className="main-nav">
            {(["member", "admin"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setMode(view)}
                aria-current={mode === view ? "page" : undefined}
              >
                {view === "member" ? "Member Lookup" : "Owner Dashboard"}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="main-content">
        {mode === "member" ? <MemberLookup /> : <AdminPanel />}
      </main>
      <footer className="site-footer">
        <div className="page-container footer-inner">
          <div>
            <p className="footer-brand">
              {gymConfig.gym.name}
              <span className="brand-period">.</span>
            </p>
            <p>
              {gymConfig.trainer.name} · {gymConfig.trainer.title}
            </p>
          </div>
          <div className="footer-contact">
            <a
              href={gymConfig.address.mapLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={16} aria-hidden="true" />
              {gymConfig.address.label}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            {gymConfig.contact.phone && <p>{gymConfig.contact.phone}</p>}
            {gymConfig.contact.email && <p>{gymConfig.contact.email}</p>}
          </div>
        </div>
      </footer>
    </div>
  );
}
