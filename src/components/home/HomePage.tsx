import { ArrowDown, ExternalLink, MessageCircleQuestion, ShieldOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { APPROVED_SOURCES, KNOWLEDGE_CHUNKS } from '../../data/approvedSources';
import { useI18n } from '../../i18n/I18nProvider';
import type { ContentLevel, SanadResponse, SupportedLanguage } from '../../types';
import { AnswerBody } from '../chat/AnswerBody';
import { Arch, Logo, LogoMark, Star } from '../ui/Brand';
import { Button } from '../ui/Button';
import { LevelBadge } from '../ui/LevelBadge';

const LEVELS: ContentLevel[] = ['A', 'B', 'C', 'D'];

/** Builds a real answer from the current knowledge base (not invented copy) for the "anatomy" section. */
function exampleAnswer(lang: SupportedLanguage): SanadResponse {
  const chunk = KNOWLEDGE_CHUNKS[0];
  return {
    answerText: '',
    scriptureOriginal: chunk.arabicScripture,
    translationApproved: lang === 'ur' ? chunk.urduTranslation : lang === 'bn' ? chunk.bengaliTranslation : chunk.englishTranslation,
    aiExplanation: lang === 'ur' ? chunk.explanationUr : lang === 'bn' ? chunk.explanationBn : chunk.explanationEn,
    contentLevel: chunk.contentLevel,
    contentLevelTitle: '',
    citations: [{ sourceName: chunk.sourceName, sourceCategory: chunk.category, reference: chunk.reference, url: chunk.url }],
    isOutOfScope: false,
    isSpecialistHandoffNeeded: false,
    confidenceScore: 1,
  };
}

export function HomePage({ onAsk }: { onAsk: () => void }) {
  const { t, lang } = useI18n();
  const reduceMotion = useReducedMotion();
  const example = useMemo(() => exampleAnswer(lang), [lang]);

  return (
    <main id="main">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 md:pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16 lg:pt-20 lg:pb-28">
        <div className="order-2 lg:order-1">
          <h1 className="font-display max-w-[16ch] text-[2.75rem] leading-[1.06] text-forest sm:text-[3.6rem] lg:text-[4.2rem]">
            {t.home.heroTitle}
          </h1>
          <p className="mt-6 max-w-[54ch] text-[1.12rem] text-forest/85">{t.home.heroBody}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button size="lg" onClick={onAsk} icon={<MessageCircleQuestion className="size-5" />}>
              {t.home.ctaAsk}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              iconEnd={<ArrowDown className="size-4" />}
              onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}
            >
              {t.home.ctaHow}
            </Button>
          </div>
          <p className="ui-text mt-8 flex max-w-[54ch] items-start gap-2 text-sm text-matcha-ink">
            <Star size={10} className="mt-[0.55em] shrink-0 text-chai" />
            {t.home.disclosure}
          </p>
        </div>

        <div className="order-1 mx-auto w-full max-w-[19rem] sm:max-w-[22rem] lg:order-2 lg:max-w-none">
          <Arch animate={!reduceMotion}>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
              className="mt-10 flex flex-col items-center"
            >
              <Logo height={224} className="max-sm:hidden" />
              <Logo height={176} className="sm:hidden" />
              <p lang="ar" dir="rtl" className="mt-5 text-[1.35rem] text-forest">
                {t.brand.sloganAr}
              </p>
              <p className="ui-text mt-1 px-6 text-center text-sm text-carob-ink">{t.brand.slogan}</p>
            </motion.div>
          </Arch>
        </div>
      </section>

      {/* ── How an answer is put together (a true sequence → numbered) ──── */}
      <section id="how" className="scroll-mt-24 border-t border-almond">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 className="font-display max-w-[22ch] text-[2.1rem] leading-tight text-forest sm:text-[2.6rem]">{t.home.stepsTitle}</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {t.home.steps.map((step, i) => (
              <li key={step.title} className="border-t border-matcha/40 pt-6">
                <span className="font-display text-[2.4rem] leading-none text-chai" lang="en">
                  {i + 1}
                </span>
                <h3 className="font-display mt-4 text-[1.4rem] leading-snug text-forest">{step.title}</h3>
                <p className="mt-2.5 text-[1rem] text-forest/80">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Answer anatomy (live component, real knowledge-base entry) ──── */}
      <section className="bg-almond/45">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-24">
          <div className="lg:pt-6">
            <h2 className="font-display text-[2.1rem] leading-tight text-forest sm:text-[2.6rem]">{t.home.exampleTitle}</h2>
            <p className="mt-4 max-w-[46ch] text-[1.05rem] text-forest/85">{t.home.exampleBody}</p>
          </div>
          <figure>
            <div className="rounded-[var(--radius-lg)] bg-paper p-5 shadow-lift sm:p-8">
              <div className="mb-4 flex items-center gap-2">
                <LogoMark size={20} className="text-matcha" />
                <span className="font-display text-lg leading-none">{t.chat.sanad}</span>
                <LevelBadge level={example.contentLevel} className="ms-2" />
              </div>
              <AnswerBody response={example} />
            </div>
            <figcaption className="ui-text mt-3 px-2 text-sm text-matcha-ink">{t.home.exampleCaption}</figcaption>
          </figure>
        </div>
      </section>

      {/* ── Levels of care + limits ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_0.65fr] lg:gap-16">
          <div>
            <h2 className="font-display text-[2.1rem] leading-tight text-forest sm:text-[2.6rem]">{t.home.levelsTitle}</h2>
            <p className="mt-4 max-w-[56ch] text-[1.05rem] text-forest/85">{t.home.levelsBody}</p>
            <dl className="mt-10 divide-y divide-almond border-y border-almond">
              {LEVELS.map((level) => (
                <div key={level} className="grid gap-x-6 gap-y-2 py-6 sm:grid-cols-[4rem_1fr]">
                  <dt className="font-display text-[2.6rem] leading-none text-matcha" lang="en">
                    {level}
                  </dt>
                  <dd>
                    <p className="font-display text-[1.35rem] leading-snug text-forest">{t.levels[level].name}</p>
                    <p className="mt-1.5 text-[0.98rem] text-forest/80">{t.levels[level].scope}</p>
                    <p className="mt-1.5 text-[0.98rem] text-carob-ink">{t.levels[level].handling}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className="self-start rounded-[var(--radius-lg)] bg-forest p-7 text-vanilla lg:sticky lg:top-28">
            <ShieldOff className="size-6 text-chai" aria-hidden />
            <h3 className="font-display mt-4 text-[1.6rem] leading-tight">{t.home.limitsTitle}</h3>
            <ul className="mt-5 space-y-4">
              {t.home.limits.map((item) => (
                <li key={item} className="flex gap-3 text-[0.98rem] text-vanilla/90">
                  <Star size={10} className="mt-[0.6em] shrink-0 text-chai" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* ── Approved references ─────────────────────────────────────────── */}
      <section className="border-t border-almond">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 className="font-display text-[2.1rem] leading-tight text-forest sm:text-[2.6rem]">{t.home.sourcesTitle}</h2>
          <p className="mt-4 max-w-[56ch] text-[1.05rem] text-forest/85">{t.home.sourcesBody}</p>
          <ul className="mt-10 grid gap-x-12 sm:grid-cols-2">
            {APPROVED_SOURCES.map((source) => (
              <li key={source.id} className="flex items-start justify-between gap-4 border-b border-almond py-4">
                <div className="min-w-0">
                  <p lang="ar" dir="rtl" className="text-start text-[1.02rem] text-forest">
                    {source.nameAr}
                  </p>
                  <p className="mt-0.5 text-sm text-matcha-ink" lang="en" dir="ltr">
                    {source.name}
                  </p>
                </div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-text mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-matcha-ink underline decoration-pistache underline-offset-4 hover:text-forest"
                >
                  {t.home.openSource}
                  <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">{source.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Closing invitation ──────────────────────────────────────────── */}
      <section className="bg-almond/45">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-[2rem] leading-tight text-forest">{t.home.finalTitle}</h2>
            <p className="mt-2 text-[1.05rem] text-forest/80">{t.home.finalBody}</p>
          </div>
          <Button size="lg" onClick={onAsk} icon={<MessageCircleQuestion className="size-5" />}>
            {t.home.ctaAsk}
          </Button>
        </div>
      </section>
    </main>
  );
}
