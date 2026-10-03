import { AlertCircle, CircleSlash, Mic, RotateCcw, SearchX, UserRound, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ChatMessage, SupportedLanguage } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';
import { classifyResponse, suggestsSpecialist } from '../../lib/answerState';
import { cx } from '../../lib/cx';
import { voiceService } from '../../services/voiceService';
import { Button } from '../ui/Button';
import { LogoMark } from '../ui/Brand';
import { LevelBadge } from '../ui/LevelBadge';
import { AnswerBody, EvidenceList } from './AnswerBody';

const enter = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] as const } };

export function UserMessage({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  return (
    <motion.div {...enter} className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[75%]">
        <p className="rounded-[1.25rem] rounded-ee-md bg-almond px-4 py-2.5 text-[1.02rem] whitespace-pre-wrap text-forest">{message.text}</p>
        {message.inputType === 'voice' && (
          <p className="ui-text mt-1 flex items-center justify-end gap-1 text-xs text-matcha-ink">
            <Mic className="size-3" aria-hidden /> {t.chat.spoken}
          </p>
        )}
        <span className="sr-only">{t.chat.you}</span>
      </div>
    </motion.div>
  );
}

function SanadByline({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="flex items-center gap-2 text-forest">
        <LogoMark size={20} className="text-matcha" />
        <span className="font-display text-lg leading-none">{t.chat.sanad}</span>
      </span>
      {children}
    </div>
  );
}

function ListenButton({ text, lang }: { text: string; lang: SupportedLanguage }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => voiceService.stopSpeaking(), []);
  if (!voiceService.isTtsSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (playing) {
          voiceService.stopSpeaking();
          setPlaying(false);
        } else {
          setPlaying(true);
          voiceService.speak(text, lang, () => setPlaying(true), () => setPlaying(false));
        }
      }}
      aria-pressed={playing}
      className="ui-text ms-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.85rem] text-matcha-ink transition-colors hover:bg-almond hover:text-forest"
    >
      {playing ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      {playing ? t.chat.stopListening : t.chat.listen}
    </button>
  );
}

interface NoticeProps {
  tone: 'neutral' | 'warm' | 'error';
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/** Shared layout for non-answer outcomes: no reliable answer, handoff, out of scope, error. */
export function Notice({ tone, icon, title, children, actions }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cx(
        'rounded-[var(--radius-lg)] border px-5 py-5 sm:px-6',
        tone === 'neutral' && 'border-oat bg-paper',
        tone === 'warm' && 'border-chai/70 bg-[#FBF5EC]',
        tone === 'error' && 'border-brick/25 bg-brick-wash'
      )}
    >
      <div className="flex gap-4">
        <span
          className={cx(
            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full',
            tone === 'neutral' && 'bg-almond text-matcha-ink',
            tone === 'warm' && 'bg-chai/30 text-carob-ink',
            tone === 'error' && 'bg-brick/10 text-brick'
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={cx('font-display text-xl leading-snug', tone === 'error' ? 'text-brick' : 'text-forest')}>{title}</h3>
          {children && <div className="mt-1.5 max-w-[62ch] text-[0.98rem] text-forest/85">{children}</div>}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

interface AnswerMessageProps {
  message: ChatMessage;
  question: string;
  onRequestSpecialist: (question: string, reason: string) => void;
  onRetry: (question: string) => void;
  onRephrase: (question: string) => void;
}

export function AnswerMessage({ message, question, onRequestSpecialist, onRetry, onRephrase }: AnswerMessageProps) {
  const { t, lang } = useI18n();
  const s = t.chat.states;

  if (message.status === 'error') {
    return (
      <motion.article {...enter}>
        <Notice
          tone="error"
          icon={<AlertCircle className="size-5" />}
          title={s.errorTitle}
          actions={
            <Button size="sm" variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => onRetry(message.retryQuery ?? question)}>
              {s.retry}
            </Button>
          }
        >
          {s.errorBody}
        </Notice>
      </motion.article>
    );
  }

  const response = message.responseDetails;
  if (!response) return null;
  const state = classifyResponse(response);

  if (state === 'no_answer') {
    return (
      <motion.article {...enter}>
        <Notice
          tone="neutral"
          icon={<SearchX className="size-5" />}
          title={s.noAnswerTitle}
          actions={
            <>
              <Button size="sm" icon={<UserRound className="size-4" />} onClick={() => onRequestSpecialist(question, 'low_confidence_unverified')}>
                {s.noAnswerAction}
              </Button>
              <Button size="sm" variant="quiet" onClick={() => onRephrase(question)}>
                {s.rephrase}
              </Button>
            </>
          }
        >
          {s.noAnswerBody}
        </Notice>
      </motion.article>
    );
  }

  if (state === 'out_of_scope') {
    return (
      <motion.article {...enter}>
        <Notice tone="neutral" icon={<CircleSlash className="size-5" />} title={s.outOfScopeTitle}>
          {s.outOfScopeBody}
        </Notice>
      </motion.article>
    );
  }

  if (state === 'handoff') {
    return (
      <motion.article {...enter}>
        <SanadByline>
          <LevelBadge level="D" />
        </SanadByline>
        <Notice
          tone="warm"
          icon={<UserRound className="size-5" />}
          title={s.handoffTitle}
          actions={
            <Button size="sm" variant="warm" onClick={() => onRequestSpecialist(question, 'personal_fatwa')}>
              {s.handoffAction}
            </Button>
          }
        >
          {response.answerText || s.handoffBody}
        </Notice>
        {response.citations.length > 0 && (
          <div className="mt-4">
            <EvidenceList citations={response.citations} />
          </div>
        )}
      </motion.article>
    );
  }

  return (
    <motion.article {...enter} aria-label={t.chat.sanad}>
      <SanadByline>
        <LevelBadge level={response.contentLevel} />
        <ListenButton text={response.aiExplanation || response.answerText} lang={lang} />
      </SanadByline>
      <AnswerBody response={response} />
      {response.engine === 'legacy' && <p className="ui-text mt-4 text-[0.8rem] text-carob-ink">{t.chat.legacyNote}</p>}
      {suggestsSpecialist(response) && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-chai/60 bg-[#FBF5EC] px-4 py-3">
          <p className="text-[0.95rem] text-carob-ink">{response.handoffReason === 'personal_fatwa' ? s.specialistNote : s.specialistOffer}</p>
          <Button size="sm" variant="secondary" icon={<UserRound className="size-4" />} onClick={() => onRequestSpecialist(question, response.handoffReason ?? 'low_confidence_unverified')}>
            {s.noAnswerAction}
          </Button>
        </div>
      )}
    </motion.article>
  );
}

export function LoadingMessage() {
  const { t } = useI18n();
  return (
    <div aria-live="polite" className="space-y-3">
      <div className="flex items-center gap-2 text-forest">
        <LogoMark size={20} className="animate-pulse text-matcha" />
        <span className="ui-text text-[0.95rem] text-matcha-ink">{t.chat.loading}</span>
      </div>
      <div className="space-y-2.5" aria-hidden>
        <div className="skeleton h-16 rounded-[var(--radius-md)]" />
        <div className="skeleton h-3.5 w-11/12 rounded-full" />
        <div className="skeleton h-3.5 w-9/12 rounded-full" />
      </div>
    </div>
  );
}
