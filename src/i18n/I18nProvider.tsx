import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupportedLanguage } from '../types';
import { DEFAULT_LANGUAGE, getLanguage, isSupportedLanguage, type LanguageMeta } from './languages';
import { STRINGS, type Strings } from './strings';

interface I18nValue {
  lang: SupportedLanguage;
  meta: LanguageMeta;
  dir: 'ltr' | 'rtl';
  t: Strings;
  setLang: (lang: SupportedLanguage) => void;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = 'sanad.lang';

function readStoredLanguage(): SupportedLanguage | null {
  try {
    const value = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return isSupportedLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: SupportedLanguage }) {
  const [lang, setLang] = useState<SupportedLanguage>(() => initialLang ?? readStoredLanguage() ?? DEFAULT_LANGUAGE);
  const meta = getLanguage(lang);

  // Keep <html lang/dir> in sync so CSS (fonts, logical properties) and screen readers follow the language.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable — language still works for this session */
    }
  }, [lang, meta.dir]);

  const value = useMemo<I18nValue>(() => ({ lang, meta, dir: meta.dir, t: STRINGS[lang], setLang }), [lang, meta]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
