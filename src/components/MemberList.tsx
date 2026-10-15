import { Edit2, RefreshCw, Trash2 } from "lucide-react";
import type { Member } from "../types/member";
import { membershipState } from "../utils/membership";
import { formatDate } from "../utils/presentation";
import { Button, StatusBadge } from "./ui";
import WhatsAppReminder from "./WhatsAppReminder";

type Props = {
  members: Member[];
  busy: boolean;
  onEdit: (member: Member) => void;
  onRenew: (member: Member) => void;
  onDelete: (member: Member) => void;
};
export default function MemberList({
  members,
  busy,
  onEdit,
  onRenew,
  onDelete,
}: Props) {
  return (
    <div className="member-list">
      <div className="member-list-labels" aria-hidden="true">
        <span>Member / contact</span>
        <span>Membership</span>
        <span>Expiry / status</span>
        <span>Manage membership</span>
      </div>
      {members.map((member) => {
        const state = membershipState(member.endDate);
        return (
          <article
            className="member-row"
            key={member.id}
            aria-labelledby={`member-heading-${member.id}`}
          >
            <div className="member-identity">
              <span className="member-avatar" aria-hidden="true">
                {member.name.trim().slice(0, 1).toUpperCase()}
              </span>
              <div>
                <span className="member-id">#{member.id}</span>
                <h3 id={`member-heading-${member.id}`}>
                  {member.name || "Unnamed member"}
                </h3>
                <p className="member-contact">
                  {member.phone || "No phone number"}
                </p>
              </div>
            </div>
            <div className="member-plan">
              <span className="mobile-label">Membership</span>
              <strong>{member.membershipType}</strong>
              <span className="plan-note">
                Started {formatDate(member.startDate)}
              </span>
            </div>
            <div className="member-expiry">
              <span className="mobile-label">Expiry (inclusive)</span>
              <strong>{formatDate(member.endDate)}</strong>
              <StatusBadge
                status={state.status}
                expiring={state.expiringSoon}
              />
              <span className="expiry-note">
                {state.status === "Expired"
                  ? "Membership ended"
                  : state.daysRemaining === 0
                    ? "Valid through today"
                    : `${state.daysRemaining} days left`}
              </span>
            </div>
            <div className="member-actions">
              <Button
                onClick={() => onRenew(member)}
                disabled={busy}
                aria-label={`Renew ${member.name}`}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Renew
              </Button>
              <Button
                onClick={() => onEdit(member)}
                disabled={busy}
                aria-label={`Edit ${member.name}`}
              >
                <Edit2 size={15} aria-hidden="true" />
                Edit
              </Button>
              <WhatsAppReminder member={member} />
              <Button
                variant="quiet"
                className="delete-action"
                onClick={() => onDelete(member)}
                disabled={busy}
                aria-label={`Delete ${member.name}`}
              >
                <Trash2 size={15} aria-hidden="true" />
                Delete
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
