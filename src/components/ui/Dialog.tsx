import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: 'md' | 'lg';
}

/**
 * Accessible modal: Escape closes, focus moves in on open and returns on close,
 * Tab is kept inside, background scroll is locked. Becomes a bottom sheet on mobile.
 */
export function Dialog({ open, onClose, title, description, children, width = 'md' }: DialogProps) {
  const { t, dir } = useI18n();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      const first =
        panel?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
      (first ?? panel)?.focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      returnFocus.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" dir={dir}>
          <motion.div
            className="absolute inset-0 bg-forest/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-paper shadow-lift outline-none sm:rounded-[1.75rem] ${
              width === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'
            }`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-almond px-6 pt-6 pb-4 sm:px-8">
              <div>
                <h2 id={titleId} className="font-display text-2xl text-forest">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 max-w-prose text-sm text-matcha-ink">
                    {description}
                  </p>
                )}
              </div>
              <IconButton label={t.nav.close} onClick={onClose} data-close size="sm" className="-me-2">
                <X className="size-5" />
              </IconButton>
            </div>
            <div className="scrollbar-quiet overflow-y-auto px-6 py-5 sm:px-8">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
