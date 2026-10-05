/** Interface preferences (language, text size, contrast) and hash routing. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dirOf, fontFor, leadingFor } from '../i18n/languages';
import { stringsFor, UI_LANGUAGES, type Strings } from '../i18n/strings';

const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode etc. — preferences just won't persist */
    }
  },
};

function initialUi(): string {
  const saved = typeof window !== 'undefined' ? store.get('sanad-ui') : null;
  if (saved) return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
  return UI_LANGUAGES.includes(nav) ? nav : 'en';
}

interface Prefs {
  ui: string;
  setUi(lang: string): void;
  /** true = the interface follows the language of the asker's question */
  uiAuto: boolean;
  setUiAuto(v: boolean): void;
  /** called with the detected language of each answer */
  follow(lang: string): void;
  /** answer language chosen by the asker; null = detect from the question */
  answerLang: string | null;
  setAnswerLang(lang: string | null): void;
  size: number;
  setSize(i: number): void;
  contrast: boolean;
  setContrast(v: boolean): void;
  t: Strings;
  dir: 'rtl' | 'ltr';
}

const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children, defaultUi }: { children: ReactNode; defaultUi?: string }) {
  const [ui, setUiState] = useState(() => defaultUi ?? initialUi());
  const [answerLang, setAnswerLang] = useState<string | null>(null);
  const [uiAuto, setUiAutoState] = useState(() => (typeof window !== 'undefined' ? store.get('sanad-ui-auto') !== '0' : true));
  const [size, setSizeState] = useState(() => Number(typeof window !== 'undefined' ? store.get('sanad-size') : 0) || 0);
  const [contrast, setContrastState] = useState(() => (typeof window !== 'undefined' ? store.get('sanad-contrast') === '1' : false));

  const value = useMemo<Prefs>(
    () => ({
      ui,
      setUi: (l) => {
        setUiState(l);
        store.set('sanad-ui', l);
        setUiAutoState(false);
        store.set('sanad-ui-auto', '0');
      },
      uiAuto,
      setUiAuto: (v) => {
        setUiAutoState(v);
        store.set('sanad-ui-auto', v ? '1' : '0');
      },
      follow: (lang) => {
        const base = lang.split('-')[0];
        if (uiAuto && UI_LANGUAGES.includes(base)) setUiState(base);
      },
      answerLang,
      setAnswerLang,
      size,
      setSize: (i) => {
        setSizeState(i);
        store.set('sanad-size', String(i));
      },
      contrast,
      setContrast: (v) => {
        setContrastState(v);
        store.set('sanad-contrast', v ? '1' : '0');
      },
      t: stringsFor(ui),
      dir: dirOf(ui),
    }),
    [ui, uiAuto, answerLang, size, contrast]
  );

  useEffect(() => {
    const html = document.documentElement;
    html.lang = ui;
    html.dir = dirOf(ui);
    html.style.setProperty('--ui-font', fontFor(ui));
    html.style.setProperty('--ui-leading', String(leadingFor(ui)));
    html.style.fontSize = ['100%', '112.5%', '125%'][size] ?? '100%';
    html.classList.toggle('hc', contrast);
  }, [ui, size, contrast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('PrefsProvider missing');
  return v;
}

/** "#/my/123" → ['my', '123'] */
export function useRoute(): string[] {
  const read = () => (typeof window === 'undefined' ? [] : window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean));
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
export const go = (path: string) => {
  window.location.hash = path.startsWith('#') ? path : '#/' + path.replace(/^\//, '');
};

export function formatDate(iso: string, ui: string, t: Strings): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  const time = d.toLocaleTimeString(ui, { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `${t.today}، ${time}`.replace('، ', ui === 'en' ? ', ' : '، ');
  if (days === 1) return t.yesterday;
  return d.toLocaleDateString(ui, { day: 'numeric', month: 'short', year: 'numeric' });
}
