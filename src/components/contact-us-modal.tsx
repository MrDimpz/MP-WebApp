import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Mail, X } from 'lucide-react';

const CONTACT_EMAIL = 'admin@missingpiecepuzzles.fun';

interface ContactUsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactUsModal({ open, onClose }: ContactUsModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const mailtoHref = useMemo(() => {
    const cleanSubject = subject.trim() || 'Enquiry — The Missing Piece';
    const cleanBody = message.trim();
    const params = new URLSearchParams();
    params.set('subject', cleanSubject);
    if (cleanBody) params.set('body', cleanBody);
    return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
  }, [subject, message]);

  const gmailHref = useMemo(() => {
    const cleanSubject = subject.trim() || 'Enquiry — The Missing Piece';
    const cleanBody = message.trim();
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: CONTACT_EMAIL,
      su: cleanSubject,
    });
    if (cleanBody) params.set('body', cleanBody);
    return `https://mail.google.com/mail/?${params.toString()}`;
  }, [subject, message]);

  if (!open) return null;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard permissions are blocked
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-us-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#F6C915]/40 bg-[#faf8f4] dark:bg-[#1a062b] text-[#2B0938] dark:text-[#F5F3F7] shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close contact dialog"
          className="absolute top-4 right-4 p-2 rounded-full text-[#2B0938]/70 dark:text-purple-200/75 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#F6C915] text-[#2B0938] flex items-center justify-center shrink-0 border border-[#2B0938]/20">
            <Mail size={20} />
          </div>
          <div>
            <h2
              id="contact-us-modal-title"
              className="text-lg font-bold tracking-tight leading-tight"
            >
              Contact Us
            </h2>
            <p className="text-xs text-[#2B0938]/70 dark:text-purple-200/75">
              Send an email to The Missing Piece team
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#2B0938]/15 dark:border-[#F6C915]/25 bg-white/80 dark:bg-[#12031f] px-3.5 py-2.5 flex items-center justify-between gap-2 mb-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#2B0938]/60 dark:text-purple-300/70">
              Email Address
            </div>
            <div className="text-sm font-mono font-bold text-[#2B0938] dark:text-[#F6C915] truncate">
              {CONTACT_EMAIL}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyEmail}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#2B0938]/20 dark:border-[#F6C915]/35 px-2.5 py-1.5 text-xs font-semibold hover:bg-[#F6C915] hover:text-[#2B0938] transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label
              htmlFor="contact-subject"
              className="block text-xs font-semibold mb-1 text-[#2B0938]/80 dark:text-purple-200/85"
            >
              Subject (optional)
            </label>
            <input
              id="contact-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Feedback, puzzle idea, or support"
              className="w-full rounded-xl border border-[#2B0938]/20 dark:border-[#F6C915]/25 bg-white dark:bg-[#12031f] px-3 py-2 text-sm text-[#2B0938] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F6C915]"
            />
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="block text-xs font-semibold mb-1 text-[#2B0938]/80 dark:text-purple-200/85"
            >
              Message (optional)
            </label>
            <textarea
              id="contact-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              className="w-full rounded-xl border border-[#2B0938]/20 dark:border-[#F6C915]/25 bg-white dark:bg-[#12031f] px-3 py-2 text-sm text-[#2B0938] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F6C915] resize-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href={mailtoHref}
            className="w-full py-3 px-4 rounded-xl bg-[#F6C915] hover:brightness-105 font-bold text-sm flex items-center justify-center border border-[#2B0938]/25 shadow-md transition-all"
          >
            <span className="inline-flex items-center justify-center gap-2 text-[#2B0938]">
              <Mail size={16} />
              <span>Send email to {CONTACT_EMAIL}</span>
            </span>
          </a>

          <a
            href={gmailHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl border border-[#2B0938]/20 dark:border-[#F6C915]/30 hover:bg-black/5 dark:hover:bg-white/10 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Open in Gmail</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
