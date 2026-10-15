import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ShieldCheck,
  Loader2,
  Dumbbell,
} from "lucide-react";
import { lookupMember, getApiUrl } from "../api/gymApi";
import { gymConfig } from "../config/gymConfig";
import type { PublicMember } from "../types/member";
import { isMembershipDate } from "../utils/membership";
import { Alert, Button, StatusBadge } from "../components/ui";
import { formatDate } from "../utils/presentation";

export default function MemberLookup() {
  const [memberId, setMemberId] = useState("");
  const [member, setMember] = useState<PublicMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setMember(null);
    if (
      !/^\d+$/.test(memberId.trim()) ||
      !Number.isSafeInteger(Number(memberId)) ||
      Number(memberId) < 1
    ) {
      setError("Enter your numeric Member ID, for example 1.");
      return;
    }
    if (!getApiUrl()) {
      setError(
        "Membership lookup is currently unavailable. Please contact the gym.",
      );
      return;
    }
    const version = ++request.current;
    setLoading(true);
    setError(null);
    const response = await lookupMember(memberId.trim());
    if (version !== request.current) return;
    if (
      response.success &&
      response.member &&
      isMembershipDate(response.member.endDate)
    )
      setMember(response.member);
    else
      setError(
        response.error === "Member not found"
          ? "No membership found. Check your ID or contact the gym."
          : "Could not load your membership. Please try again or contact the gym.",
      );
    setLoading(false);
  };
  const expiring =
    member?.status === "Active" &&
    typeof member.daysRemaining === "number" &&
    member.daysRemaining >= 0 &&
    member.daysRemaining <= 7;
  return (
    <div className="lookup-page">
      <section
        className="lookup-hero page-container"
        aria-labelledby="lookup-title"
      >
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="accent-line" />
            YOUR NEXT SESSION STARTS HERE
          </p>
          <h1 id="lookup-title" aria-label="Check your membership">
            Check your <br />
            membership<span className="brand-period">.</span>
          </h1>
          <p className="hero-description">
            One less thing between you and your next session. Check your plan,
            see your status, and get back to training.
          </p>
          <div className="hero-signoff">
            <Dumbbell size={20} aria-hidden="true" />
            <span>{gymConfig.gym.description}</span>
          </div>
        </div>
        <div className="lookup-column">
          <form
            onSubmit={handleSearch}
            className="lookup-form surface"
            aria-busy={loading}
          >
            <div className="section-kicker">YOUR MEMBERSHIP, AT A GLANCE</div>
            <h2>Ready for your next session?</h2>
            <p className="text-secondary">
              Your membership details are one ID away.
            </p>
            <label htmlFor="member-id">Member ID</label>
            <input
              id="member-id"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={16}
              aria-invalid={!!error}
              aria-describedby={error ? "lookup-error" : "lookup-help"}
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              disabled={loading}
              placeholder="Enter your ID, e.g. 1"
              className="field"
            />
            <Button variant="primary" disabled={loading} className="full-width">
              {loading ? (
                <Loader2 className="spin" size={18} aria-hidden="true" />
              ) : null}
              {loading ? "Checking…" : "Check Membership"}
              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </Button>
            <p id="lookup-help" className="privacy-note">
              <ShieldCheck size={17} aria-hidden="true" />
              Only your membership details are shown. Your personal information
              stays private.
            </p>
          </form>
          {error && (
            <div id="lookup-error">
              <Alert>{error}</Alert>
            </div>
          )}
          <div aria-live="polite" aria-busy={loading}>
            {member && (
              <section
                className="membership-result surface"
                aria-label="Membership result"
              >
                <div className="result-heading">
                  <div>
                    <p className="section-kicker">MEMBERSHIP DETAILS</p>
                    <h2>Member #{member.id}</h2>
                  </div>
                  <StatusBadge status={member.status} expiring={expiring} />
                </div>
                <div className="result-days">
                  <strong>{Math.max(0, member.daysRemaining ?? 0)}</strong>
                  <span>days remaining</span>
                  <CalendarDays size={25} aria-hidden="true" />
                </div>
                <dl className="result-details">
                  <div>
                    <dt>Membership plan</dt>
                    <dd>{member.membershipType}</dd>
                  </div>
                  <div>
                    <dt>Expiry date (inclusive)</dt>
                    <dd>{formatDate(member.endDate)}</dd>
                  </div>
                </dl>
                {expiring && (
                  <p className="result-note">
                    {member.daysRemaining === 0
                      ? "Valid through today."
                      : "Your renewal is coming up."}{" "}
                    Contact the gym to keep your training going.
                  </p>
                )}
                {member.status === "Expired" && (
                  <p className="result-note">
                    Your membership has ended. Contact the gym to renew.
                  </p>
                )}
              </section>
            )}
          </div>
          <p className="lookup-help">
            Not sure of your ID? Your gym team can help.
          </p>
        </div>
      </section>
      <section
        className="gallery-section page-container"
        aria-labelledby="gallery-title"
      >
        <div className="gallery-heading">
          <div>
            <p className="eyebrow">A SPACE TO SHOW UP FOR YOURSELF</p>
            <h2 id="gallery-title">Inside {gymConfig.gym.name}</h2>
          </div>
          <a
            href={gymConfig.address.mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            Find your gym
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="gallery-grid">
          {gymConfig.gallery.map((src, i) => (
            <figure key={src}>
              <img
                src={src}
                alt={`${gymConfig.gym.name} training space ${i + 1}`}
                loading="lazy"
                width={640}
                height={400}
              />
              <figcaption>
                <span>{String(i + 1).padStart(2, "0")}</span>{" "}
                {
                  ["Build your strength", "Find your focus", "Keep showing up"][
                    i % 3
                  ]
                }
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
