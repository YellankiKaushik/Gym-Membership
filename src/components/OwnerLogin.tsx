import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { gymConfig } from "../config/gymConfig";
import { Alert, Button } from "./ui";

type Props = {
  ownerId: string;
  password: string;
  loading: boolean;
  error: string | null;
  onOwnerId: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
};
export default function OwnerLogin({
  ownerId,
  password,
  loading,
  error,
  onOwnerId,
  onPassword,
  onSubmit,
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <section
      className="login-page page-container"
      aria-labelledby="login-title"
    >
      <div className="login-story">
        <p className="eyebrow">THE BUSINESS BEHIND THE PROGRESS</p>
        <h2>
          A stronger gym.
          <br />A simpler day.
        </h2>
        <p>More time with your members. Less time managing memberships.</p>
        <div className="login-story-rule" />
        <p className="login-gym">
          {gymConfig.gym.name}
          <span className="brand-period">.</span>
        </p>
        <span>{gymConfig.gym.tagline}</span>
      </div>
      <div className="login-card surface">
        <span className="login-lock">
          <LockKeyhole size={24} aria-hidden="true" />
        </span>
        <p className="section-kicker">YOUR PRIVATE WORKSPACE</p>
        <h1 id="login-title">Owner Login</h1>
        <p className="text-secondary">
          Welcome back. Let's keep things moving.
        </p>
        <form onSubmit={onSubmit} aria-busy={loading}>
          <label htmlFor="owner-id">Owner ID</label>
          <input
            id="owner-id"
            className="field"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={ownerId}
            onChange={(e) => onOwnerId(e.target.value)}
            required
            maxLength={128}
            disabled={loading}
            placeholder="Enter your Owner ID"
          />
          <label htmlFor="owner-password">Password</label>
          <div className="password-field">
            <input
              id="owner-password"
              type={visible ? "text" : "password"}
              className="field"
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={72}
              value={password}
              onChange={(e) => onPassword(e.target.value)}
              disabled={loading}
              placeholder="Enter your password"
              aria-describedby={error ? "login-error" : undefined}
            />
            <Button
              type="button"
              variant="quiet"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              disabled={loading}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </div>
          {error && (
            <div id="login-error">
              <Alert>{error}</Alert>
            </div>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="full-width"
          >
            {loading ? (
              <Loader2 className="spin" size={18} aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
            {loading ? "Verifying…" : "Login"}
          </Button>
        </form>
        <p className="privacy-note">
          <ShieldCheck size={17} aria-hidden="true" />
          Secure owner access. Your session ends automatically after 30 minutes.
        </p>
      </div>
    </section>
  );
}
