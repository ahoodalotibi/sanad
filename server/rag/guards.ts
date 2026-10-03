/**
 * Post-generation guards. The model's output is never trusted on its own:
 *  - every citation must point to a source that was actually provided
 *  - inline markers are renumbered to the final citation order; unknown markers are removed
 *  - at least one valid citation is required
 *  - quoted passages (and, outside Urdu answers, long Arabic-script runs) must appear in the
 *    provided sources — this blocks invented verses or hadith, even if a prompt injection
 *    persuaded the model to write one
 */
import type { SupportedLanguage } from '../../src/types/index.ts';
import { normalizeArabic } from '../db/normalize.ts';

export interface CitationCheck {
  ok: boolean;
  /** source keys in final order (index + 1 = number shown to the user) */
  orderedKeys: string[];
  /** answer text with [S#] replaced by [n] and unknown markers removed */
  text: string;
  invalidKeys: string[];
}

export function validateCitations(answer: string, citedKeys: string[], providedKeys: string[]): CitationCheck {
  const provided = new Set(providedKeys);
  const inline = [...answer.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]);
  const ordered: string[] = [];
  for (const k of [...inline, ...citedKeys]) if (provided.has(k) && !ordered.includes(k)) ordered.push(k);
  const invalidKeys = [...new Set([...inline, ...citedKeys].filter((k) => !provided.has(k)))];

  const text = answer
    .replace(/\[(S\d+)\]/g, (_m, key: string) => (ordered.includes(key) ? `[${ordered.indexOf(key) + 1}]` : ''))
    .replace(/[ \t]+([.,;:!?،؟۔])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return { ok: ordered.length > 0 && text.length > 0, orderedKeys: ordered, text, invalidKeys };
}

const comparable = (s: string) => (normalizeArabic(s) ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const QUOTED = /[«“"﴿]([^«»“”"﴿﴾]{15,}?)[»”"﴾]/g;
const ARABIC_RUN = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+(?:[\s،]+[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+){3,}/g;

/** Returns passages in the answer that look like quotations but are not in the sources. */
export function findUnsupportedQuotes(answer: string, sourceTexts: string[], language: SupportedLanguage): string[] {
  const haystack = comparable(sourceTexts.join(' \n '));
  const candidates = [...answer.matchAll(QUOTED)].map((m) => m[1]);
  // In Urdu answers the whole text is Arabic script, so only explicit quotations are checked.
  if (language !== 'ur') candidates.push(...[...answer.matchAll(ARABIC_RUN)].map((m) => m[0]));
  return candidates.filter((c) => {
    const needle = comparable(c);
    return needle.length > 0 && !haystack.includes(needle);
  });
}
