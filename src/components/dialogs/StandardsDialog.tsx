import { CornerDownLeft, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APPROVED_SOURCES } from '../../data/approvedSources';
import { TERMINOLOGY_DICTIONARY } from '../../data/terminology';
import { BENCHMARK_TEST_CASES } from '../../data/testCases';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { LevelBadge } from '../ui/LevelBadge';
import { Tabs } from '../ui/Tabs';

type Tab = 'sources' | 'terms' | 'tests';

/** Reference material from the project's data files: approved sources, terminology, and the reference test questions. */
export function StandardsDialog({ open, onClose, onRunTest }: { open: boolean; onClose: () => void; onRunTest: (question: string) => void }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>('sources');
  useEffect(() => {
    if (open) setTab('sources');
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title={t.standards.title} width="lg">
      <Tabs
        label={t.standards.title}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'sources', label: t.standards.tabSources },
          { value: 'terms', label: t.standards.tabTerms },
          { value: 'tests', label: t.standards.tabTests, count: BENCHMARK_TEST_CASES.length },
        ]}
      />

      {tab === 'sources' && (
        <ul className="divide-y divide-almond pb-2">
          {APPROVED_SOURCES.map((s) => (
            <li key={s.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p lang="ar" dir="rtl" className="text-start text-[1.05rem] text-forest">
                    {s.nameAr}
                  </p>
                  <p lang="en" dir="ltr" className="mt-0.5 text-start text-sm text-matcha-ink">
                    {s.name}
                  </p>
                  {s.notes && (
                    <p lang="ar" dir="rtl" className="mt-1.5 text-start text-sm text-carob-ink">
                      {s.notes}
                    </p>
                  )}
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 shrink-0 text-matcha-ink hover:text-forest" aria-label={`${s.name} (${t.home.openSource})`}>
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'terms' && (
        <div className="pb-2">
          <p className="mb-4 text-[0.95rem] text-matcha-ink">{t.standards.termsIntro}</p>
          <dl className="divide-y divide-almond">
            {TERMINOLOGY_DICTIONARY.map((term) => (
              <div key={term.id} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                <dt lang="ar" dir="rtl" className="font-scripture text-start text-[1.5rem] leading-snug text-forest">
                  {term.termAr}
                </dt>
                <dd>
                  <p lang="en" dir="ltr" className="text-start font-semibold text-forest">
                    {term.termEn}
                  </p>
                  {lang !== 'en' && (
                    <p lang={lang} className="text-forest/85">
                      {lang === 'ur' ? term.termUr : term.termBn}
                    </p>
                  )}
                  <p lang="ar" dir="rtl" className="mt-1.5 text-start text-sm text-carob-ink">
                    {term.guidelineAr}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === 'tests' && (
        <div className="pb-2">
          <p className="mb-4 text-[0.95rem] text-matcha-ink">{t.standards.testsIntro}</p>
          <ul className="divide-y divide-almond">
            {BENCHMARK_TEST_CASES.map((tc) => {
              const question = lang === 'ur' ? tc.questionUr : lang === 'bn' ? tc.questionBn : tc.questionEn;
              return (
                <li key={tc.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <LevelBadge level={tc.targetTier} />
                    <p className="mt-2 text-[1.02rem] text-forest">{question}</p>
                    <p className="ui-text mt-1 text-sm text-matcha-ink">
                      {t.standards.expected}:{' '}
                      <span lang="ar" dir="rtl" className="inline-block">
                        {tc.expectedBehaviorAr}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    iconEnd={<CornerDownLeft className="size-4 rtl:-scale-x-100" />}
                    onClick={() => {
                      onRunTest(question);
                      onClose();
                    }}
                  >
                    {t.standards.run}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
