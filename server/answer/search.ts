/**
 * BM25 search over the approved corpus. One index entry per (item, language version), so a
 * question in Urdu can match the Urdu translation, and Arabic/English keywords produced by the
 * understanding step can match the Arabic original or the English translation of the same item.
 */
import type { Corpus, CorpusItem } from './corpus.ts';
import { contentTokens } from './text.ts';

interface Entry {
  item: CorpusItem;
  language: string;
  /** term → weighted frequency */
  tf: Map<string, number>;
  length: number;
}

export interface SearchHit {
  item: CorpusItem;
  language: string;
  score: number;
  /** share of the query's content words found in this entry (0–1) */
  coverage: number;
}

const K1 = 1.2;
const B = 0.75;

function fieldsOf(item: CorpusItem, lang: string): Array<[string, number]> {
  if (item.kind === 'hadith') {
    const v = lang === 'ar' ? item.ar : item.tr[lang];
    return v ? [[v.text, 3], [v.explanation ?? '', 1], [lang === 'ar' ? item.topics.join(' ') : '', 1]] : [];
  }
  if (item.kind === 'qa') {
    const v = lang === 'ar' ? item.ar : item.tr[lang];
    return v ? [[v.question, 4], [v.similar.join(' '), 3], [v.shortAnswer, 1]] : [];
  }
  const v = lang === 'ar' ? item.ar : item.tr[lang];
  return v ? [[v.title, 5], [v.sections.map((s) => s.text).join(' '), 1]] : [];
}

export class SearchIndex {
  private entries: Entry[] = [];
  private df = new Map<string, number>();
  private avgLength = 1;

  constructor(readonly corpus: Corpus) {
    for (const item of corpus.items) {
      for (const lang of ['ar', ...Object.keys(item.tr)]) {
        const tf = new Map<string, number>();
        let length = 0;
        for (const [text, weight] of fieldsOf(item, lang)) {
          for (const t of contentTokens(text)) {
            tf.set(t, (tf.get(t) ?? 0) + weight);
            length += weight;
          }
        }
        if (length === 0) continue;
        this.entries.push({ item, language: lang, tf, length });
        for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      }
    }
    this.avgLength = this.entries.reduce((n, e) => n + e.length, 0) / Math.max(1, this.entries.length);
  }

  get size() {
    return this.entries.length;
  }

  /** Searches with one or more queries; an item's best-scoring language version represents it. */
  search(queries: string[], opts: { limit?: number; kinds?: CorpusItem['kind'][] } = {}): SearchHit[] {
    const N = this.entries.length;
    const best = new Map<string, SearchHit>();
    for (const q of queries) {
      const terms = [...new Set(contentTokens(q))];
      if (!terms.length) continue;
      for (const e of this.entries) {
        if (opts.kinds && !opts.kinds.includes(e.item.kind)) continue;
        let score = 0;
        let matched = 0;
        for (const t of terms) {
          const f = e.tf.get(t);
          if (!f) continue;
          matched++;
          const df = this.df.get(t) ?? 0;
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
          score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * e.length) / this.avgLength));
        }
        if (!matched) continue;
        const coverage = matched / terms.length;
        const prev = best.get(e.item.id);
        if (!prev || score > prev.score) best.set(e.item.id, { item: e.item, language: e.language, score, coverage: Math.max(coverage, prev?.coverage ?? 0) });
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 10);
  }
}
