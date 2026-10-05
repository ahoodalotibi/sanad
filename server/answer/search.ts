/**
 * BM25 search over the approved corpus. One index entry per (item, language version), so a
 * question in Urdu can match the Urdu translation, and Arabic/English keywords produced by the
 * understanding step can match the Arabic original or the English translation of the same item.
 */
import type { Corpus, CorpusItem } from './corpus.ts';
import { contentTokens } from './text.ts';

export interface SearchHit {
  item: CorpusItem;
  language: string;
  score: number;
  /** share of the query's content words found in this entry (0–1) */
  coverage: number;
  /** number of content words in the query that matched best */
  terms: number;
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

/**
 * Inverted index: for each word, the entries containing it and the weighted count. Searching touches
 * only the postings of the query's words, and memory stays small enough for a 512 MB server.
 */
export class SearchIndex {
  private items: CorpusItem[] = [];
  private entryItem: number[] = [];
  private entryLang: string[] = [];
  private lengths: number[] = [];
  /** word → [start, count] in the flat posting arrays */
  private postings = new Map<string, [number, number]>();
  private postIds = new Int32Array(0);
  private postTf = new Float32Array(0);
  private avgLength = 1;

  constructor(readonly corpus: Corpus) {
    let total = 0;
    const building = new Map<string, { ids: number[]; tf: number[] }>();
    corpus.items.forEach((item, itemIdx) => {
      this.items.push(item);
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
        const id = this.entryItem.length;
        this.entryItem.push(itemIdx);
        this.entryLang.push(lang);
        this.lengths.push(length);
        total += length;
        for (const [t, f] of tf) {
          let p = building.get(t);
          if (!p) building.set(t, (p = { ids: [], tf: [] }));
          p.ids.push(id);
          p.tf.push(f);
        }
      }
    });
    this.avgLength = total / Math.max(1, this.entryItem.length);
    let n = 0;
    for (const p of building.values()) n += p.ids.length;
    this.postIds = new Int32Array(n);
    this.postTf = new Float32Array(n);
    let at = 0;
    for (const [t, p] of building) {
      this.postIds.set(p.ids, at);
      this.postTf.set(p.tf, at);
      this.postings.set(t, [at, p.ids.length]);
      at += p.ids.length;
    }
    building.clear();
  }

  get size() {
    return this.entryItem.length;
  }

  /** Searches with one or more queries; an item's best-scoring language version represents it. */
  search(queries: string[], opts: { limit?: number; kinds?: CorpusItem['kind'][] } = {}): SearchHit[] {
    const N = this.entryItem.length;
    const best = new Map<number, SearchHit>();
    for (const q of queries) {
      const terms = [...new Set(contentTokens(q))];
      if (!terms.length) continue;
      const score = new Map<number, number>();
      const matched = new Map<number, number>();
      for (const t of terms) {
        const p = this.postings.get(t);
        if (!p) continue;
        const [start, count] = p;
        const idf = Math.log(1 + (N - count + 0.5) / (count + 0.5));
        for (let k = start; k < start + count; k++) {
          const id = this.postIds[k];
          if (opts.kinds && !opts.kinds.includes(this.items[this.entryItem[id]].kind)) continue;
          const f = this.postTf[k];
          score.set(id, (score.get(id) ?? 0) + (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * this.lengths[id]) / this.avgLength)));
          matched.set(id, (matched.get(id) ?? 0) + 1);
        }
      }
      for (const [id, sc] of score) {
        const itemIdx = this.entryItem[id];
        const coverage = matched.get(id)! / terms.length;
        const prev = best.get(itemIdx);
        if (!prev || sc > prev.score) best.set(itemIdx, { item: this.items[itemIdx], language: this.entryLang[id], score: sc, coverage: Math.max(coverage, prev?.coverage ?? 0), terms: terms.length });
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 10);
  }
}
