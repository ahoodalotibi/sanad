/**
 * TypeScript mirror of private.normalize_arabic() (migration 01).
 * Must stay byte-for-byte equivalent — tests/db/schema.test.ts compares both.
 */
const DIACRITICS = /[ً-ٰٟۖ-ۭـ]/g;
const LETTER_MAP: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي',
};
const LETTERS = new RegExp(`[${Object.keys(LETTER_MAP).join('')}]`, 'g');

export function normalizeArabic(input: string | null | undefined): string | null {
  const out = (input ?? '')
    .replace(DIACRITICS, '')
    .replace(LETTERS, (ch) => LETTER_MAP[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
  return out === '' ? null : out;
}

/** Same as term_aliases.alias_normalized: lower(normalize_arabic(alias)). */
export function normalizeAlias(alias: string): string | null {
  return normalizeArabic(alias)?.toLowerCase() ?? null;
}
