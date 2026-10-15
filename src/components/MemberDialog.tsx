import { useEffect, useRef } from 'react';

export default function MemberDialog({ children, busy, onClose }: {
  children: React.ReactNode; busy: boolean; onClose: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    content.current?.querySelector<HTMLElement>('input:not(:disabled),select,button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(content.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]') || []);
      if (!focusable.length) { event.preventDefault(); content.current?.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === content.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
    onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={content} role="dialog" aria-modal="true" aria-labelledby="member-dialog-title" aria-busy={busy} tabIndex={-1}
      className="w-full sm:max-w-md bg-slate-900 border border-white/20 rounded-3xl p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
      {children}
    </div>
  </div>;
}
