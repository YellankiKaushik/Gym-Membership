import { MessageCircle } from "lucide-react";
import { gymConfig } from "../config/gymConfig";
import { whatsAppReminder } from "../utils/whatsapp";
export default function WhatsAppReminder({
  member,
}: {
  member: { name: string; phone: string; endDate: string };
}) {
  const reminder = whatsAppReminder(member, gymConfig.gym.name);
  if (!reminder.url)
    return (
      <p className="whatsapp-unavailable" role="status">
        {reminder.error}
      </p>
    );
  return (
    <a
      href={reminder.url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={`WhatsApp reminder for ${member.name}`}
      className="btn btn-secondary whatsapp-link"
    >
      <MessageCircle size={15} aria-hidden="true" />
      WhatsApp
    </a>
  );
}
