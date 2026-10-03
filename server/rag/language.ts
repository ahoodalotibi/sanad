/**
 * Language routing.
 * Detection is script-based (deterministic and offline): Bengali has its own script;
 * Urdu and Arabic share a script, so Urdu is recognised by letters Arabic does not use
 * (ٹ ڈ ڑ ں ے ھ ہ ی ک گ …). The answer language is the language the user wrote in when
 * it is supported, otherwise the language chosen in the interface.
 */
import type { SupportedLanguage } from '../../src/types/index.ts';

export type DetectedLanguage = SupportedLanguage | 'ar' | 'unknown';

const BENGALI = /[ঀ-৿]/g;
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
// Letters/forms used in Urdu but not in standard Arabic: ٹ ڈ ڑ ں ے ۓ ھ ہ ۃ ی ک گ چ پ ژ and Urdu digits
const URDU_MARKERS = /[ٹڈڑںےۓھہۃیکگچپژ۰-۹]/g;
const LATIN = /[A-Za-z]/g;

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

export function detectLanguage(text: string): DetectedLanguage {
  const bn = count(text, BENGALI);
  const arabicScript = count(text, ARABIC_SCRIPT);
  const latin = count(text, LATIN);
  const max = Math.max(bn, arabicScript, latin);
  if (max === 0) return 'unknown';
  if (bn === max) return 'bn';
  if (arabicScript === max) return count(text, URDU_MARKERS) > 0 ? 'ur' : 'ar';
  return 'en';
}

export function resolveAnswerLanguage(detected: DetectedLanguage, uiLanguage: SupportedLanguage): SupportedLanguage {
  return detected === 'en' || detected === 'ur' || detected === 'bn' ? detected : uiLanguage;
}

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ur: 'Urdu (اردو), in Nastaliq-friendly standard Urdu',
  bn: 'Bengali (বাংলা)',
};
