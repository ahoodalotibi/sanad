/**
 * Query normalisation: cleans what the user typed before it reaches retrieval or a model.
 *  - removes control characters, zero-width and bidi-override characters (used to hide text)
 *  - collapses whitespace, enforces a length limit
 *  - produces a separate search form (Arabic-normalised, lower-cased, without punctuation)
 */
import { normalizeArabic } from '../db/normalize.ts';

export class QueryError extends Error {
  constructor(readonly code: 'empty' | 'too_long', message: string) {
    super(message);
    this.name = 'QueryError';
  }
}

export interface NormalizedQuery {
  /** cleaned question, safe to show to the model (still treated as untrusted data) */
  text: string;
  /** form used for full-text search */
  search: string;
}

const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const PUNCTUATION = /[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~«»“”‘’…،؛؟۔।]/g;

export function normalizeQuery(raw: string, maxChars: number): NormalizedQuery {
  const text = (raw ?? '').normalize('NFC').replace(HIDDEN, '').replace(/\s+/g, ' ').trim();
  if (!text) throw new QueryError('empty', 'The question is empty');
  if (text.length > maxChars) throw new QueryError('too_long', `The question is longer than ${maxChars} characters`);
  const search = (normalizeArabic(text.replace(PUNCTUATION, ' ')) ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return { text, search };
}
