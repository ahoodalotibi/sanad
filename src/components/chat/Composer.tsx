import { ArrowUp, Mic, Square } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { LANGUAGES } from '../../i18n/languages';
import { cx } from '../../lib/cx';
import { voiceService } from '../../services/voiceService';
import type { SupportedLanguage } from '../../types';

interface ComposerProps {
  onSend: (text: string, isVoice: boolean) => void;
  isLoading: boolean;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  /** Text to place in the box (e.g. "rephrase"); bump `draftKey` to apply it again. */
  draft?: string;
  draftKey?: number;
}

type VoiceIssue = 'unsupported' | 'denied' | 'failed' | null;

export function Composer({ onSend, isLoading, autoSpeak, onToggleAutoSpeak, draft, draftKey }: ComposerProps) {
  const { t, lang, setLang } = useI18n();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceIssue, setVoiceIssue] = useState<VoiceIssue>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const voiceSupported = voiceService.isSpeechSupported();

  // Apply an external draft (rephrase) and focus the box.
  useEffect(() => {
    if (draftKey === undefined) return;
    setText(draft ?? '');
    areaRef.current?.focus();
  }, [draft, draftKey]);

  // Auto-grow the textarea up to ~6 lines.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text, lang]);

  useEffect(() => () => voiceService.stopListening(), []);

  // Stop recording if the language changes mid-recording (recogniser language is fixed per session).
  useEffect(() => {
    if (recording) {
      voiceService.stopListening();
      setRecording(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const send = () => {
    const value = text.trim();
    if (!value || isLoading) return;
    onSend(value, false);
    setText('');
  };

  const toggleVoice = () => {
    setVoiceIssue(null);
    if (!voiceSupported) {
      setVoiceIssue('unsupported');
      return;
    }
    if (recording) {
      voiceService.stopListening();
      setRecording(false);
      return;
    }
    setRecording(true);
    voiceService.startListening(
      lang,
      (transcript, isFinal) => {
        setText(transcript);
        if (isFinal) {
          setRecording(false);
          if (transcript.trim().length > 3) {
            onSend(transcript.trim(), true);
            setText('');
          }
        }
      },
      (message) => {
        setRecording(false);
        setVoiceIssue(/denied|permission|not-allowed/i.test(message) ? 'denied' : /not supported/i.test(message) ? 'unsupported' : 'failed');
      },
      () => setRecording(false)
    );
  };

  const canSend = text.trim().length > 0 && !isLoading;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        className={cx(
          'rounded-[1.6rem] border bg-paper p-2 shadow-lift transition-colors duration-200',
          recording ? 'border-brick/40' : 'border-oat focus-within:border-matcha'
        )}
      >
        {recording && (
          <div className="ui-text flex items-center gap-2 px-3 pt-1.5 text-sm text-brick" aria-live="polite">
            <span className="size-2 animate-pulse rounded-full bg-brick" aria-hidden />
            {t.chat.voice.listening}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <label htmlFor="sanad-question" className="sr-only">
            {t.chat.placeholder}
          </label>
          <textarea
            id="sanad-question"
            ref={areaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={recording ? '' : t.chat.placeholder}
            readOnly={recording}
            className="scrollbar-quiet min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[1.05rem] text-forest outline-none placeholder:text-matcha-ink/70 focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isLoading}
            aria-pressed={recording}
            aria-label={recording ? t.chat.voice.stop : t.chat.voice.start}
            title={voiceSupported ? (recording ? t.chat.voice.stop : t.chat.voice.start) : t.chat.voice.unsupported}
            className={cx(
              'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
              recording ? 'pulse-ring bg-brick text-vanilla' : 'text-matcha-ink hover:bg-almond hover:text-forest',
              !voiceSupported && 'opacity-60'
            )}
          >
            {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label={t.chat.send}
            title={t.chat.send}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-forest text-vanilla transition-colors duration-200 hover:bg-forest-deep disabled:bg-almond disabled:text-matcha-ink/45"
          >
            <ArrowUp className="size-5" />
          </button>
        </div>
      </div>

      {voiceIssue && (
        <p role="status" className="ui-text mt-2 px-3 text-sm text-brick">
          {t.chat.voice[voiceIssue]}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-3 px-3">
        <label className="ui-text inline-flex cursor-pointer items-center gap-2 text-sm text-matcha-ink select-none">
          <input type="checkbox" checked={autoSpeak} onChange={onToggleAutoSpeak} className="peer sr-only" />
          <span
            aria-hidden
            className="relative h-5 w-9 rounded-full bg-oat transition-colors peer-checked:bg-matcha peer-focus-visible:ring-2 peer-focus-visible:ring-matcha/40 after:absolute after:top-0.5 after:start-0.5 after:size-4 after:rounded-full after:bg-paper after:shadow-sm after:transition-transform peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4"
          />
          {t.chat.readAloud}
        </label>

        {/* Language is also in the header; on phones the header switcher is hidden, so it lives here. */}
        <label className="ui-text flex items-center gap-2 text-sm text-matcha-ink sm:hidden">
          <span className="sr-only">{t.nav.language}</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as SupportedLanguage)}
            className="h-9 rounded-full border border-oat bg-paper px-3 text-sm leading-normal text-forest"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
