/**
 * Ingest: «بينات: أسئلة وأجوبة عن الإسلام» (Osoul Center) — see bayyinat/parse.ts for why the
 * questions are read from the publisher's platform bayenat.net rather than from the PDF.
 *
 *   npm run ingest:bayyinat -- --limit=10      small trial batch (default)
 *   npm run ingest:bayyinat -- --all           all Osoul Center items (~263)
 *   options: --concurrency=2 --delay=500 --refresh --out=data/ingest/bayyinat
 *
 * Saves every page unchanged under <out>/raw/, writes <out>/qa.jsonl (one line per question and
 * language) and <out>/report.json. Translations are discovered from each item's «ترجمات» list.
 */
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { intArg, parseArgs, progress, writeJson, writeJsonl, detach } from './lib/cli.ts';
import { Fetcher, mapAll } from './lib/fetcher.ts';
import { RELATED_BOOK, parseQaPage, parseSourcePage, sourcePageUrl, type BayyinatQa } from './bayyinat/parse.ts';

export interface BayyinatRecord extends BayyinatQa {
  /** Arabic item this record belongs to */
  sourceItemId: string;
  /** The book in the reference document this platform is linked to — see RELATED_BOOK. Not a claim that this item is in the book. */
  relatedBook: typeof RELATED_BOOK;
  raw: { file: string; sha256: string };
  fetchedAt: string;
}

const args = parseArgs();
const OUT = path.resolve(args.out ?? 'data/ingest/bayyinat');
const LIMIT = args.all ? Infinity : intArg(args.limit, 10);
const fetcher = new Fetcher({ rawDir: path.join(OUT, 'raw'), concurrency: intArg(args.concurrency, 2), delayMs: intArg(args.delay, 500), refresh: args.refresh === 'true' });
const doc = (body: Buffer) => parseHTML(body.toString('utf8')).document;

async function main() {
  const started = new Date().toISOString();
  const errors: Array<{ url: string; stage: string; message: string }> = [];
  console.log(`Bayyinat (bayenat.net, Osoul Center items) → ${OUT}`);

  // 1. Listing pages
  const first = parseSourcePage(doc((await fetcher.get(sourcePageUrl(1))).body));
  const items = new Set(first.items);
  for (let p = 2; p <= first.lastPage && items.size < LIMIT; p++) {
    try {
      for (const u of parseSourcePage(doc((await fetcher.get(sourcePageUrl(p))).body)).items) items.add(u);
    } catch (err) {
      errors.push({ url: sourcePageUrl(p), stage: 'listing', message: (err as Error).message });
    }
  }
  const urls = [...items].slice(0, LIMIT);
  console.log(`  listing pages: ${first.lastPage}, items found: ${items.size}, processing ${urls.length}${Number.isFinite(LIMIT) ? ' (trial batch; use --all for everything)' : ''}`);

  // 2. Arabic items
  const records: BayyinatRecord[] = [];
  const now = () => new Date().toISOString();
  const add = (qa: BayyinatQa, sourceItemId: string, file: string, sha: string) =>
    records.push(detach({ ...qa, sourceItemId, relatedBook: RELATED_BOOK, raw: { file, sha256: sha }, fetchedAt: now() }));

  const ar = await mapAll(
    urls,
    async (url) => {
      const page = await fetcher.get(url);
      const qa = parseQaPage(doc(page.body), url);
      if (!qa.question || (!qa.shortAnswer && !qa.detailedAnswer)) throw new Error('question or answer missing on the page');
      add(qa, qa.id, page.file, page.sha256);
    },
    progress('questions')
  );
  ar.forEach((r, i) => r instanceof Error && errors.push({ url: urls[i], stage: 'question', message: r.message }));

  // 3. Translations
  const jobs = records.flatMap((r) => r.translations.map((t) => ({ id: r.id, url: t.url })));
  const tr = await mapAll(
    jobs,
    async (job) => {
      const page = await fetcher.get(job.url);
      const qa = parseQaPage(doc(page.body), job.url);
      if (!qa.question) throw new Error('empty translation page');
      add(qa, job.id, page.file, page.sha256);
    },
    progress('translations')
  );
  tr.forEach((r, i) => r instanceof Error && errors.push({ url: jobs[i].url, stage: 'translation', message: r.message }));

  // 4. Output
  records.sort((a, b) => Number(a.sourceItemId) - Number(b.sourceItemId) || (a.language === 'ar' ? -1 : 1));
  writeJsonl(path.join(OUT, 'qa.jsonl'), records);
  const byLanguage = records.reduce<Record<string, number>>((acc, r) => ((acc[r.language] = (acc[r.language] ?? 0) + 1), acc), {});
  const report = {
    source: 'bayenat.net/ar/sources/11 — منصة بينات، مؤلفات مركز أصول',
    relatedBook: RELATED_BOOK,
    startedAt: started,
    finishedAt: now(),
    trialBatch: Number.isFinite(LIMIT),
    listingPages: first.lastPage,
    itemsFound: items.size,
    itemsProcessed: urls.length,
    questions: records.filter((r) => r.language === 'ar').length,
    withShortAnswer: records.filter((r) => r.shortAnswer).length,
    withDetailedAnswer: records.filter((r) => r.detailedAnswer).length,
    quranQuotes: records.reduce((n, r) => n + r.quotes.filter((q) => q.kind === 'quran').length, 0),
    otherQuotes: records.reduce((n, r) => n + r.quotes.filter((q) => q.kind !== 'quran').length, 0),
    translationLinksFound: jobs.length,
    translationsExtracted: records.filter((r) => r.language !== 'ar').length,
    byLanguage,
    authors: records.reduce<Record<string, number>>((acc, r) => ((acc[r.author ?? '—'] = (acc[r.author ?? '—'] ?? 0) + 1), acc), {}),
    httpRequests: fetcher.requests,
    reusedSavedPages: fetcher.cacheHits,
    errors,
  };
  writeJson(path.join(OUT, 'report.json'), report);
  console.log(`✓ ${report.questions} questions, ${report.translationsExtracted} translations, ${report.quranQuotes} Quran quotations, ${errors.length} error(s).`);
}

main().catch((err) => {
  console.error('\n✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
