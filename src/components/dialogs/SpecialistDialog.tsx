import { CheckCircle2, Info } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { getLanguage } from '../../i18n/languages';
import type { SpecialistTicket } from '../../types';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Tabs } from '../ui/Tabs';

type Reason = SpecialistTicket['handoffReason'];
const REASONS: Reason[] = ['personal_fatwa', 'low_confidence_unverified', 'sensitive_dispute', 'out_of_scope'];

interface SpecialistDialogProps {
  open: boolean;
  onClose: () => void;
  initialQuery: string;
  initialReason: string;
  initialTab: 'new' | 'mine';
  /** Sources the conversation actually consulted for this question (empty if none). */
  consultedSources: string[];
  tickets: SpecialistTicket[];
  onSubmit: (ticket: SpecialistTicket) => void;
}

/**
 * Specialist handoff. Honest about the current state: requests are stored on this
 * device only (the backend delivery is a later phase), so the UI never claims they were sent.
 */
export function SpecialistDialog({ open, onClose, initialQuery, initialReason, initialTab, consultedSources, tickets, onSubmit }: SpecialistDialogProps) {
  const { t, lang } = useI18n();
  const s = t.specialist;
  const [tab, setTab] = useState<'new' | 'mine'>(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [reason, setReason] = useState<Reason>(REASONS.includes(initialReason as Reason) ? (initialReason as Reason) : 'personal_fatwa');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setQuery(initialQuery);
    setReason(REASONS.includes(initialReason as Reason) ? (initialReason as Reason) : 'personal_fatwa');
    setNotes('');
    setSaved(null);
  }, [open, initialQuery, initialReason, initialTab]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const id = `SND-L${Date.now().toString(36).toUpperCase().slice(-6)}`;
    onSubmit({
      id,
      userQuery: query.trim(),
      language: lang,
      handoffReason: reason,
      summary: s.reasons[reason],
      consultedSources,
      status: 'pending',
      createdAt: new Date().toISOString(),
      specialistNotes: notes.trim() || undefined,
    });
    setSaved(id);
  };

  const fieldClass =
    'w-full rounded-[var(--radius-md)] border border-oat bg-vanilla px-4 py-3 text-[1rem] text-forest outline-none transition-colors placeholder:text-matcha-ink/60 focus:border-matcha focus:bg-paper';

  return (
    <Dialog open={open} onClose={onClose} title={s.title} description={s.intro}>
      <Tabs
        label={s.title}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'new', label: s.tabNew },
          { value: 'mine', label: s.tabMine, count: tickets.length },
        ]}
      />

      {tab === 'new' &&
        (saved ? (
          <div className="py-8 text-center" role="status">
            <CheckCircle2 className="mx-auto size-10 text-matcha" aria-hidden />
            <p className="font-display mt-3 text-2xl text-forest">{s.savedTitle}</p>
            <p className="mt-1 text-matcha-ink">{s.savedBody}</p>
            <p className="mt-3 text-sm text-carob-ink">
              {s.reference}: <span lang="en" className="font-semibold">{saved}</span>
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setTab('mine')}>
                {s.tabMine}
              </Button>
              <Button onClick={onClose}>{t.nav.close}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 pb-2">
            <p className="flex gap-2.5 rounded-[var(--radius-md)] bg-almond/70 px-4 py-3 text-sm text-carob-ink">
              <Info className="mt-[0.2em] size-4 shrink-0" aria-hidden />
              <span>{s.previewNote}</span>
            </p>

            <div>
              <label htmlFor="sp-question" className="ui-text mb-1.5 block text-sm font-semibold text-forest">
                {s.question}
              </label>
              <textarea id="sp-question" required rows={4} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={s.questionPlaceholder} className={fieldClass} data-autofocus />
            </div>

            <fieldset>
              <legend className="ui-text mb-2 text-sm font-semibold text-forest">{s.reason}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {REASONS.map((r) => (
                  <label
                    key={r}
                    className={`ui-text flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-[0.95rem] transition-colors ${
                      reason === r ? 'border-matcha bg-paper text-forest' : 'border-oat text-forest/85 hover:border-pistache'
                    }`}
                  >
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#3F4D32]" />
                    {s.reasons[r]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="sp-notes" className="ui-text mb-1.5 block text-sm font-semibold text-forest">
                {s.notes}
              </label>
              <textarea id="sp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={s.notesPlaceholder} className={fieldClass} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="quiet" onClick={onClose}>
                {s.cancel}
              </Button>
              <Button type="submit" disabled={!query.trim()}>
                {s.submit}
              </Button>
            </div>
          </form>
        ))}

      {tab === 'mine' &&
        (tickets.length === 0 ? (
          <p className="py-10 text-center text-matcha-ink">{s.empty}</p>
        ) : (
          <ul className="divide-y divide-almond pb-2">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span lang="en" className="font-semibold text-forest">
                    {ticket.id}
                  </span>
                  <span className="ui-text rounded-full bg-almond px-2.5 py-0.5 text-xs text-carob-ink">{s.statusSaved}</span>
                </div>
                <p className="mt-2 text-[1rem] text-forest" lang={ticket.language} dir={getLanguage(ticket.language).dir}>
                  {ticket.userQuery}
                </p>
                <p className="ui-text mt-1.5 text-sm text-matcha-ink">
                  {s.reasons[ticket.handoffReason as Reason] ?? ticket.handoffReason} ·{' '}
                  <time dateTime={ticket.createdAt}>{new Date(ticket.createdAt).toLocaleString(getLanguage(lang).locale, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </p>
              </li>
            ))}
          </ul>
        ))}
    </Dialog>
  );
}
