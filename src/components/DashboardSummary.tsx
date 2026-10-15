import { Users, CircleCheck, Clock3, CircleAlert } from "lucide-react";
export default function DashboardSummary({
  stats,
}: {
  stats: { total: number; active: number; expiring: number; expired: number };
}) {
  return (
    <section className="summary-grid" aria-label="Membership summary">
      {(
        [
          [
            "Total Members",
            stats.total,
            Users,
            "neutral",
            "Your gym community",
          ],
          [
            "Active Members",
            stats.active,
            CircleCheck,
            "positive",
            "Including expiring soon",
          ],
          [
            "Expiring Soon",
            stats.expiring,
            Clock3,
            "warning",
            "Today through the next 7 days",
          ],
          [
            "Expired Members",
            stats.expired,
            CircleAlert,
            "negative",
            "Ready for a fresh start",
          ],
        ] as const
      ).map(([label, count, Icon, tone, note]) => (
        <article
          className="summary-card surface"
          key={label}
          aria-label={`${label}: ${count}`}
        >
          <div className="summary-top">
            <p>{label}</p>
            <span className={`summary-icon ${tone}`}>
              <Icon size={19} aria-hidden="true" />
            </span>
          </div>
          <p className="summary-number">{count}</p>
          <p className="summary-note">{note}</p>
        </article>
      ))}
    </section>
  );
}
