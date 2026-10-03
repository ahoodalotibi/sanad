import type { SupportedLanguage } from '../types';

export interface LanguageMeta {
  code: SupportedLanguage;
  /** Name in the language itself — shown in the switcher */
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  /** BCP-47 tag used for dates and speech */
  locale: string;
}

export const LANGUAGES: readonly LanguageMeta[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', locale: 'en-GB' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl', locale: 'ur-PK' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', dir: 'ltr', locale: 'bn-BD' },
] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function getLanguage(code: SupportedLanguage): LanguageMeta {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function directionOf(code: SupportedLanguage): 'ltr' | 'rtl' {
  return getLanguage(code).dir;
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && LANGUAGES.some((l) => l.code === value);
}
