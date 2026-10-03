import { CornerDownLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BENCHMARK_TEST_CASES } from '../../data/testCases';
import { useI18n } from '../../i18n/I18nProvider';
import type { ChatMessage, SupportedLanguage } from '../../types';
import { Arch, Logo } from '../ui/Brand';
import { Composer } from './Composer';
import { AnswerMessage, LoadingMessage, UserMessage } from './Messages';

/** Suggested questions come from the reference document's own test questions (no invented content). */
const SUGGESTION_IDS = ['test-kaaba', 'test-quran-authorship', 'test-sword', 'test-tawhid-explain'];

function suggestionsFor(lang: SupportedLanguage): string[] {
  return BENCHMARK_TEST_CASES.filter((c) => SUGGESTION_IDS.includes(c.id)).map((c) =>
    lang === 'ur' ? c.questionUr : lang === 'bn' ? c.questionBn : c.questionEn
  );
}

interface ChatPageProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string, isVoice: boolean) => void;
  onRetry: (question: string) => void;
  onRequestSpecialist: (question: string, reason: string) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
}

export function ChatPage({ messages, isLoading, onSend, onRetry, onRequestSpecialist, autoSpeak, onToggleAutoSpeak }: ChatPageProps) {
  const { t, lang } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ text: string; key: number } | null>(null);
  const suggestions = useMemo(() => suggestionsFor(lang), [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

  // Each answer is paired with the question that produced it (for retry / specialist / rephrase).
  const questionFor = (index: number) => {
    for (let i = index - 1; i >= 0; i--) if (messages[i].sender === 'user') return messages[i].text;
    return '';
  };

  const empty = messages.length === 0 && !isLoading;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col sm:min-h-[calc(100dvh-4.5rem)]">
      <main id="main" className="flex-1 px-4 sm:px-6">
        {empty ? (
          <section className="mx-auto flex max-w-2xl flex-col items-center pt-10 pb-8 text-center sm:pt-16">
            <Arch className="w-32 sm:w-36">
              <Logo height={84} className="mt-6" decorative />
            </Arch>
            <h1 className="font-display mt-7 text-[2.1rem] leading-tight text-forest sm:text-[2.6rem]">{t.chat.emptyTitle}</h1>
            <p className="mt-3 max-w-lg text-[1.02rem] text-matcha-ink">{t.chat.emptyBody}</p>

            <div className="mt-10 w-full text-start">
              <p className="ui-text mb-3 text-sm font-semibold text-carob-ink">{t.chat.suggestions}</p>
              <ul className="divide-y divide-almond border-y border-almond">
                {suggestions.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => onSend(q, false)}
                      className="group flex w-full items-center justify-between gap-4 px-2 py-3.5 text-start text-[1.02rem] text-forest transition-colors hover:bg-almond/50"
                    >
                      <span>{q}</span>
                      <CornerDownLeft className="size-4 shrink-0 text-pistache transition-colors group-hover:text-matcha rtl:-scale-x-100" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <div className="mx-auto max-w-3xl space-y-9 pt-8 pb-10 sm:pt-10" aria-live="polite" aria-relevant="additions">
            {messages.map((m, i) =>
              m.sender === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AnswerMessage
                  key={m.id}
                  message={m}
                  question={questionFor(i)}
                  onRetry={onRetry}
                  onRequestSpecialist={onRequestSpecialist}
                  onRephrase={(q) => setDraft({ text: q, key: Date.now() })}
                />
              )
            )}
            {isLoading && <LoadingMessage />}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-vanilla from-70% to-vanilla/0 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <Composer
          onSend={onSend}
          isLoading={isLoading}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={onToggleAutoSpeak}
          draft={draft?.text}
          draftKey={draft?.key}
        />
      </div>
    </div>
  );
}
