import { MessageCircle } from 'lucide-react';
import { gymConfig } from '../config/gymConfig';
import { whatsAppReminder } from '../utils/whatsapp';

export default function WhatsAppReminder({ member }: { member: { name: string; phone: string; endDate: string } }) {
  const reminder = whatsAppReminder(member, gymConfig.gym.name);
  if (!reminder.url) return <p className="text-xs text-amber-200 mt-2" role="status">{reminder.error}</p>;
  return <a href={reminder.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
    aria-label={`WhatsApp reminder for ${member.name}`}
    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25">
    <MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp
  </a>;
}
