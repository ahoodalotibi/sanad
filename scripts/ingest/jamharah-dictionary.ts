/**
 * Ingest: Al-Jamharah dictionary of Islamic terms — https://islamic-content.com/dictionary
 * (listed in «المرجعية والحزمة العلمية والبيانات», p.4: «الترجمة والمصطلحات»).
 *
 *   npm run ingest:dictionary -- --limit=20                 small trial batch (default when no limit/all is given)
 *   npm run ingest:dictionary -- --categories=1792,1063     only some subject categories
 *   npm run ingest:dictionary -- --all                      the whole dictionary (~14k entries + translations)
 *   options: --concurrency=3 --delay=300 --refresh --out=data/ingest/jamharah-dictionary
 *
 * There is no documented API: the script reads the public HTML pages
 * (/dictionary → /dictionary/term/{category} → /dictionary/word/{id} → /dictionary/word/{id}/{lang}).
 * Every page is saved unchanged under <out>/raw/. Extracted entries go to <out>/entries.jsonl,
 * one line per (word, language). Translations are discovered from each entry's own
 * «ترجمة هذا المصطلح متوفرة باللغات التالية» list — no language list is assumed.
 */
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { intArg, parseArgs, progress, writeJson, writeJsonl, detach } from './lib/cli.ts';
import { Fetcher, mapAll } from './lib/fetcher.ts';
import { JAMHARAH_ORIGIN, parseCategoryPage, parseDictionaryIndex, parseWordPage, wordUrl, type DictionaryCategory, type DictionaryEntry } from './jamharah/parse.ts';

export interface DictionaryRecord extends DictionaryEntry {
  /** Arabic entry this record belongs to (same as wordId) */
  sourceWordId: string;
  raw: { file: string; sha256: string };
  fetchedAt: string;
}

const args = parseArgs();
const OUT = path.resolve(args.out ?? 'data/ingest/jamharah-dictionary');
const LIMIT = args.all ? Infinity : intArg(args.limit, 20);
const ONLY = args.categories ? new Set(args.categories.split(',').map((s) => s.trim())) : null;

const fetcher = new Fetcher({
  rawDir: path.join(OUT, 'raw'),
  concurrency: intArg(args.concurrency, 3),
  delayMs: intArg(args.delay, 300),
  refresh: args.refresh === 'true',
});
const doc = (body: Buffer) => parseHTML(body.toString('utf8')).document;

async function main() {
  const started = new Date();
  const errors: Array<{ url: string; stage: string; message: string }> = [];
  console.log(`Al-Jamharah dictionary → ${OUT}`);

  // 1. Categories
  const index = await fetcher.get(`${JAMHARAH_ORIGIN}/dictionary`);
  let categories = parseDictionaryIndex(doc(index.body));
  if (ONLY) categories = categories.filter((c) => ONLY.has(c.id));
  if (categories.length === 0) throw new Error('No dictionary categories found — the page layout may have changed.');
  console.log(`  categories: ${categories.map((c) => `${c.name} (${c.id})`).join('، ')}`);

  // 2. Word ids per category (a word can belong to several categories)
  const wordCategories = new Map<string, DictionaryCategory[]>();
  const perCategory: Record<string, number> = {};
  for (const cat of categories) {
    try {
      const page = await fetcher.get(cat.url);
      const ids = parseCategoryPage(doc(page.body));
      perCategory[`${cat.id} ${cat.name}`] = ids.length;
      for (const id of ids) wordCategories.set(id, [...(wordCategories.get(id) ?? []), cat]);
    } catch (err) {
      errors.push({ url: cat.url, stage: 'category', message: (err as Error).message });
    }
  }
  const wordIds = [...wordCategories.keys()].sort((a, b) => Number(a) - Number(b)).slice(0, LIMIT);
  console.log(`  words listed: ${wordCategories.size} — processing ${wordIds.length}${Number.isFinite(LIMIT) ? ' (trial batch; use --all for everything)' : ''}`);

  // 3. Arabic entries
  const records: DictionaryRecord[] = [];
  const now = () => new Date().toISOString();
  const arabic = await mapAll(
    wordIds,
    async (id) => {
      const url = wordUrl(id);
      const page = await fetcher.get(url);
      const entry = parseWordPage(doc(page.body), url);
      if (entry.sections.length === 0) throw new Error('no published definition on the page');
      const rec: DictionaryRecord = { ...entry, sourceWordId: id, raw: { file: page.file, sha256: page.sha256 }, fetchedAt: now() };
      records.push(detach(rec));
    },
    progress('arabic entries')
  );
  arabic.forEach((r, i) => r instanceof Error && errors.push({ url: wordUrl(wordIds[i]), stage: 'entry', message: r.message }));

  // 4. Translations discovered on each Arabic entry
  const jobs = records.flatMap((r) => r.translations.map((t) => ({ wordId: r.wordId, language: t.language, url: t.url })));
  const translated = await mapAll(
    jobs,
    async (job) => {
      const page = await fetcher.get(job.url);
      const entry = parseWordPage(doc(page.body), job.url);
      if (entry.sections.length === 0 && !entry.title) throw new Error('empty translation page');
      records.push(detach({ ...entry, sourceWordId: job.wordId, raw: { file: page.file, sha256: page.sha256 }, fetchedAt: now() }));
    },
    progress('translations')
  );
  translated.forEach((r, i) => r instanceof Error && errors.push({ url: jobs[i].url, stage: 'translation', message: r.message }));

  // 5. Output
  records.sort((a, b) => Number(a.wordId) - Number(b.wordId) || (a.language === 'ar' ? -1 : b.language === 'ar' ? 1 : a.language.localeCompare(b.language)));
  writeJsonl(path.join(OUT, 'entries.jsonl'), records);

  const byLanguage: Record<string, number> = {};
  for (const r of records) byLanguage[r.language] = (byLanguage[r.language] ?? 0) + 1;
  const report = {
    source: 'islamic-content.com/dictionary (الجمهرة — معجم المصطلحات الشرعية)',
    startedAt: started.toISOString(),
    finishedAt: now(),
    trialBatch: Number.isFinite(LIMIT),
    categories: perCategory,
    wordsListed: wordCategories.size,
    wordsProcessed: wordIds.length,
    arabicEntries: records.filter((r) => r.language === 'ar').length,
    translationLinksFound: jobs.length,
    translationsExtracted: records.filter((r) => r.language !== 'ar').length,
    entriesByLanguage: byLanguage,
    sectionsByLabel: records.flatMap((r) => r.sections).reduce<Record<string, number>>((acc, s) => ((acc[s.label] = (acc[s.label] ?? 0) + 1), acc), {}),
    httpRequests: fetcher.requests,
    reusedSavedPages: fetcher.cacheHits,
    errors,
  };
  writeJson(path.join(OUT, 'report.json'), report);
  console.log(
    `✓ ${report.arabicEntries} Arabic entries, ${report.translationsExtracted} translations (${Object.entries(byLanguage)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ')}), ${errors.length} error(s). Report: ${path.relative(process.cwd(), path.join(OUT, 'report.json'))}`
  );
}

main().catch((err) => {
  console.error('\n✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
