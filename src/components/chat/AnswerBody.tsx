/**
 * The anatomy of an evidence-backed answer. Scripture, approved translation and
 * Sanad's generated explanation are always visually separate (reference standard:
 * "يفرق بين النص الشرعي والشرح المولد"), and the sources follow as numbered evidence.
 */
import { ExternalLink } from 'lucide-react';
import type { Citation, SanadResponse } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';
import { Star } from '../ui/Brand';

function SectionLabel({ children }: { children: string }) {
  return <p className="ui-text mb-2 text-[0.8rem] font-semibold text-carob-ink">{children}</p>;
}

export function ScriptureBlock({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <figure className="relative rounded-[var(--radius-md)] bg-almond/70 px-5 pt-4 pb-5 sm:px-7">
      <figcaption className="ui-text mb-1 flex items-center gap-2 text-[0.8rem] font-semibold text-carob-ink">
        <Star size={10} className="text-chai" />
        {t.chat.original}
      </figcaption>
      <blockquote lang="ar" className="scripture text-[1.6rem] text-forest sm:text-[1.85rem]">
        {text}
      </blockquote>
    </figure>
  );
}

export function EvidenceList({ citations }: { citations: Citation[] }) {
  const { t } = useI18n();
  if (citations.length === 0) return null;
  return (
    <section aria-label={t.chat.sources} className="border-t border-almond pt-4">
      <SectionLabel>{t.chat.sources}</SectionLabel>
      <ol className="space-y-3">
        {citations.map((c, i) => (
          <li key={`${c.sourceName}-${i}`} className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-oat text-xs font-semibold text-matcha-ink" lang="en">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] leading-snug text-forest">{c.sourceName}</p>
              <p className="mt-0.5 text-sm text-matcha-ink">{c.reference}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {c.hadithGrade && (
                  <span className="ui-text text-[0.8rem] text-carob-ink">
                    {t.chat.grade}: <span className="font-semibold">{c.hadithGrade}</span>
                  </span>
                )}
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ui-text inline-flex items-center gap-1 text-[0.85rem] font-medium text-matcha-ink underline decoration-pistache underline-offset-4 hover:text-forest hover:decoration-matcha"
                  >
                    {t.chat.openSource}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AnswerBody({ response }: { response: SanadResponse }) {
  const { t } = useI18n();
  const explanation = response.aiExplanation || response.answerText;
  return (
    <div className="space-y-5">
      {response.scriptureOriginal && <ScriptureBlock text={response.scriptureOriginal} />}

      {response.translationApproved && (
        <div>
          <SectionLabel>{response.translationStatus === 'approximate' ? t.chat.translationApproximate : t.chat.translation}</SectionLabel>
          <p className="border-s-2 border-pistache ps-4 text-[1.02rem] text-forest/95">{response.translationApproved}</p>
        </div>
      )}

      {explanation && (
        <div>
          <SectionLabel>{t.chat.explanation}</SectionLabel>
          <div className="max-w-[68ch] text-[1.05rem] whitespace-pre-line text-forest">{renderInlineBold(explanation)}</div>
          {response.citations.length > 0 && <p className="ui-text mt-2 text-[0.8rem] text-matcha-ink">{t.chat.explanationNote}</p>}
        </div>
      )}

      <EvidenceList citations={response.citations} />
    </div>
  );
}

/** Renders **bold** segments from engine text as <strong>, everything else as plain text (no HTML injection). */
function renderInlineBold(text: string) {
  const cleaned = text.replace(/👉\s?/g, '');
  return cleaned.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
