import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock3, Users } from "lucide-react";

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "quiet";
}) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}
export function StatusBadge({
  status,
  expiring = false,
}: {
  status: "Active" | "Expired";
  expiring?: boolean;
}) {
  const Icon = expiring
    ? Clock3
    : status === "Active"
      ? CheckCircle2
      : AlertCircle;
  return (
    <span
      className={`status-badge ${expiring ? "warning" : status === "Active" ? "positive" : "negative"}`}
    >
      <Icon size={14} aria-hidden="true" />
      {expiring ? "Expiring Soon" : status}
    </span>
  );
}
export function Alert({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`alert ${success ? "alert-success" : "alert-danger"}`}
      role={success ? "status" : "alert"}
    >
      <Icon size={19} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Users size={25} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
