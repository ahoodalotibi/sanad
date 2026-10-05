/**
 * Search text utilities (matching only — stored texts are never altered).
 */

/** Arabic normalisation for matching: strips diacritics/tatweel, unifies alef/ya/ta-marbuta forms. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي');
}

const CJK = /[぀-ヿ㐀-鿿豈-﫿가-힯]/;

/** Tokens for any script: words of letters/marks/digits; CJK text becomes character bigrams. */
export function tokenize(text: string): string[] {
  const norm = normalizeArabic(text.normalize('NFKC').toLowerCase());
  const out: string[] = [];
  for (const m of norm.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    const w = m[0];
    if (CJK.test(w)) {
      const chars = [...w];
      if (chars.length === 1) out.push(w);
      for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
    } else if (w.length > 1 || /\p{N}/u.test(w)) out.push(stripArabicPrefix(w));
  }
  return out;
}

/** Light Arabic stemming for matching: drops a leading "ال"/"وال"/"بال"… so «الصلاة» matches «صلاة». */
function stripArabicPrefix(w: string): string {
  if (!/^[؀-ۿ]/.test(w)) return w;
  const m = /^(?:وال|فال|بال|كال|لل|ال)(.{2,})$/.exec(w);
  return m ? m[1] : w;
}

/** Very common words that carry no meaning for search (several languages). */
export const STOPWORDS = new Set(
  [
    // ar
    'في', 'من', 'على', 'الى', 'الي', 'عن', 'ما', 'ماذا', 'هل', 'لماذا', 'كيف', 'هو', 'هي', 'ان', 'او', 'ثم', 'لا', 'لم', 'لن', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'كان', 'قد', 'مع', 'كل', 'بين', 'و', 'يا',
    // en
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'why', 'how', 'who', 'do', 'does', 'did', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'it', 'this', 'that', 'be', 'can', 'about', 'with', 'i', 'you', 'me', 'my', 'we', 'muslims', 'islam',
    // ur
    'کیا', 'ہے', 'ہیں', 'کے', 'کی', 'کا', 'میں', 'سے', 'کو', 'اور', 'یہ', 'وہ', 'نے', 'پر',
    // fr / id / tr / es (a few)
    'le', 'la', 'les', 'de', 'des', 'du', 'est', 'et', 'que', 'pourquoi', 'yang', 'dan', 'apa', 'di', 'ini', 'itu', 'bir', 've', 'ne', 'mi', 'el', 'los', 'por', 'qué',
  ].map((w) => normalizeArabic(w))
);

export const contentTokens = (text: string) => tokenize(text).filter((t) => !STOPWORDS.has(t));

/**
 * Best-effort language detection by script and common words. Used only when no model is
 * configured; the model's detection is preferred when available.
 */
export function detectLanguage(text: string, fallback = 'en'): string {
  const counts = (re: RegExp) => (text.match(re) ?? []).length;
  const arabicScript = counts(/[؀-ۿ]/g);
  const total = counts(/\p{L}/gu) || 1;
  if (arabicScript / total > 0.5) {
    if (/[ٹڈڑںےۓھ]/.test(text) || /\b(کیا|ہے|ہیں|میں|کے|کی)\b/.test(text)) return 'ur';
    if (/[پچژگ]/.test(text) && /\b(است|چرا|چه|را|در)\b/.test(text)) return 'fa';
    return 'ar';
  }
  if (counts(/[ঀ-৿]/g) / total > 0.5) return 'bn';
  if (counts(/[ऀ-ॿ]/g) / total > 0.5) return 'hi';
  if (counts(/[Ѐ-ӿ]/g) / total > 0.5) return /[ўқғҳ]/i.test(text) ? 'uz' : 'ru';
  if (counts(/[一-鿿]/g) / total > 0.3) return 'zh';
  if (counts(/[஀-௿]/g) / total > 0.5) return 'ta';
  if (counts(/[ഀ-ൿ]/g) / total > 0.5) return 'ml';
  const lower = ` ${text.toLowerCase()} `;
  const score = (words: string[]) => words.reduce((n, w) => n + (lower.includes(` ${w} `) ? 1 : 0), 0);
  const latin: Array<[string, string[]]> = [
    ['en', ['the', 'is', 'what', 'why', 'how', 'do', 'does', 'and', 'of', 'to']],
    ['fr', ['le', 'la', 'les', 'est', 'pourquoi', 'que', 'des', 'du', 'et', 'qui']],
    ['id', ['apa', 'yang', 'dan', 'ini', 'itu', 'bagaimana', 'mengapa', 'adalah', 'di', 'tidak']],
    ['tr', ['ne', 'neden', 've', 'bir', 'bu', 'mi', 'mı', 'nasıl', 'için', 'nedir']],
    ['es', ['el', 'los', 'por', 'qué', 'es', 'que', 'cómo', 'una', 'del', 'las']],
    ['tl', ['ang', 'ng', 'sa', 'ano', 'bakit', 'paano', 'mga', 'ba', 'ay', 'na']],
    ['bs', ['je', 'li', 'šta', 'zašto', 'kako', 'su', 'u', 'na', 'da', 'se']],
  ];
  const best = latin.map(([l, w]) => [l, score(w)] as const).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : fallback;
}
