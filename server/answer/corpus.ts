/**
 * The approved corpus the answer path reads from: built by `npm run corpus:build` from the
 * ingested files, and containing ONLY items that passed the validation checks
 * (scripts/corpus/validate.ts). Loaded once at server start.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

export interface HadithVersion {
  url: string;
  text: string;
  explanation: string | null;
}

export interface HadithItem {
  kind: 'hadith';
  id: string; // "t:72602"
  url: string;
  grade: string;
  gradeEnum: 'sahih' | 'hasan';
  takhrij: string;
  topics: string[];
  ar: HadithVersion & { wordMeanings: Array<{ word: string; meaning: string }>; benefits: string[] };
  /** Published translations by language code */
  tr: Record<string, HadithVersion>;
}

export interface QaVersion {
  url: string;
  question: string;
  similar: string[];
  shortAnswer: string;
  detailedAnswer: string;
}

export interface QaItem {
  kind: 'qa';
  id: string; // "bayenat:724"
  url: string;
  category: string | null;
  relatedBook: { url: string; title: string } | null;
  ar: QaVersion;
  tr: Record<string, QaVersion>;
}

export interface TermVersion {
  url: string;
  title: string;
  sections: Array<{ label: string; text: string }>;
}

export interface TermItem {
  kind: 'term';
  id: string; // "word:196"
  url: string;
  categories: string[];
  ar: TermVersion;
  tr: Record<string, TermVersion>;
}

export type CorpusItem = HadithItem | QaItem | TermItem;

export interface Corpus {
  builtAt: string;
  sources: Record<string, { name: string; url: string }>;
  items: CorpusItem[];
}

export const SOURCE_NAMES: Corpus['sources'] = {
  hadith: { name: 'الجمهرة — معجم السنة النبوية', url: 'https://islamic-content.com/hadeeths' },
  qa: { name: 'منصة بينات — مركز أصول', url: 'https://bayenat.net/ar/sources/11' },
  term: { name: 'الجمهرة — معجم المصطلحات الشرعية', url: 'https://islamic-content.com/dictionary' },
};

export function loadCorpus(file: string): Corpus {
  const raw = fs.readFileSync(file);
  const json = file.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  return JSON.parse(json) as Corpus;
}

export function writeCorpus(file: string, corpus: Corpus) {
  fs.writeFileSync(file, zlib.gzipSync(Buffer.from(JSON.stringify(corpus)), { level: 9 }));
}

/** Languages the corpus actually has content in (from the data, not a fixed list). */
export function corpusLanguages(corpus: Corpus): Record<string, number> {
  const out: Record<string, number> = { ar: corpus.items.length };
  for (const it of corpus.items) for (const l of Object.keys(it.tr)) out[l] = (out[l] ?? 0) + 1;
  return out;
}
