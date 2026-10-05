/**
 * Browser speech: recognition turns the asker's voice into text (they review it before sending),
 * synthesis reads a text from the sources aloud. Nothing is recorded or uploaded by Sanad.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { speechLocale } from '../i18n/languages';

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

const Ctor = (): (new () => Rec) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const canListen = () => !!Ctor();

/** Dictation: `text` grows while the person speaks; stop() keeps it. */
export function useDictation() {
  const rec = useRef<Rec | null>(null);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback((lang?: string) => {
    const C = Ctor();
    if (!C) return setError('unsupported');
    rec.current?.abort();
    const r = new C();
    if (lang) r.lang = speechLocale(lang);
    r.interimResults = true;
    r.continuous = true;
    let finalText = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript + ' ';
        else interim += res[0].transcript;
      }
      setText((finalText + interim).trim());
    };
    r.onerror = (e) => setError(e.error);
    r.onend = () => setListening(false);
    rec.current = r;
    setText('');
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  const cancel = useCallback(() => {
    rec.current?.abort();
    setText('');
    setListening(false);
  }, []);
  useEffect(() => () => rec.current?.abort(), []);
  return { listening, text, error, start, stop, cancel };
}

/** Reads a text aloud in its language; toggles off when called again. */
export function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const available = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const toggle = useCallback(
    (text: string, lang: string) => {
      if (!available) return;
      const s = window.speechSynthesis;
      if (s.speaking) {
        s.cancel();
        setSpeaking(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLocale(lang);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      s.speak(u);
    },
    [available]
  );
  useEffect(() => () => void (available && window.speechSynthesis.cancel()), [available]);
  return { speaking, toggle, available };
}
