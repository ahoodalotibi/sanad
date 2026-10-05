/**
 * Ingest: «معجم السنة النبوية» on Al-Jamharah (islamic-content.com) — hadith with grade, takhrij,
 * explanation, word meanings, benefits, references, and the human translations the site links to.
 *
 *   npm run ingest:hadith -- --limit=20                    trial batch (default 20 hadiths)
 *   npm run ingest:hadith -- --all                          every hadith listed in the ~190 topics
 *   npm run ingest:hadith -- --all --langs=en,ur,fr,id      only some translation languages (faster)
 *   options: --concurrency=2 --delay=500 --refresh --out=data/ingest/jamharah-hadith
 *
 * Pages are read politely (robots.txt respected, limited concurrency) and saved unchanged in raw/.
 * Output: hadith.jsonl (one line per page: the Arabic hadith and each translation) and report.json.
 */
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { intArg, parseArgs, progress, writeJson, writeJsonl, detach } from './lib/cli.ts';
import { Fetcher, mapAll } from './lib/fetcher.ts';
import { JAMHARAH, parseHadithIndex, parseHadithPage, parseTopicPage, type HadithPage } from './jamharah/hadith-parse.ts';

export interface HadithRecord extends HadithPage {
  language: string;
  /** Arabic page id this record belongs to */
  sourceHadithId: string;
  topics: string[];
  raw: { file: string; sha256: string };
  fetchedAt: string;
}

const args = parseArgs();
const OUT = path.resolve(args.out ?? 'data/ingest/jamharah-hadith');
const LIMIT = args.all ? Infinity : intArg(args.limit, 20);
const LANGS = args.langs ? new Set(args.langs.split(',').map((s) => s.trim())) : null;
const fetcher = new Fetcher({ rawDir: path.join(OUT, 'raw'), concurrency: intArg(args.concurrency, 2), delayMs: intArg(args.delay, 500), refresh: args.refresh === 'true' });
const doc = (body: Buffer) => parseHTML(body.toString('utf8')).document;

async function main() {
  const started = new Date().toISOString();
  const errors: Array<{ url: string; stage: string; message: string }> = [];
  console.log(`Al-Jamharah — معجم السنة النبوية → ${OUT}`);

  // 1. Topics → hadith pages
  const topics = parseHadithIndex(doc((await fetcher.get(`${JAMHARAH}/hadeeths`)).body));
  const hadithTopics = new Map<string, Set<string>>();
  const topicNames = new Map<string, string>();
  for (const t of topics) {
    if (hadithTopics.size >= LIMIT) break;
    try {
      const page = doc((await fetcher.get(t)).body);
      const name = (page.querySelector('h1, h2')?.textContent ?? '').replace(/\s+/g, ' ').trim();
      topicNames.set(t, name);
      for (const h of parseTopicPage(page)) hadithTopics.set(h.id, new Set([...(hadithTopics.get(h.id) ?? []), name || t]));
    } catch (err) {
      errors.push({ url: t, stage: 'topic', message: (err as Error).message });
    }
  }
  const ids = [...hadithTopics.keys()].slice(0, LIMIT);
  console.log(`  topics: ${topics.length}, hadiths found: ${hadithTopics.size}, processing ${ids.length}${Number.isFinite(LIMIT) ? ' (trial batch; use --all for everything)' : ''}`);

  // 2. Arabic hadith pages
  const records: HadithRecord[] = [];
  const now = () => new Date().toISOString();
  const ar = await mapAll(
    ids,
    async (id) => {
      const url = `${JAMHARAH}/t/${id}`;
      const page = await fetcher.get(url);
      const h = parseHadithPage(doc(page.body), url);
      if (!h.text) throw new Error('no hadith text on the page');
      records.push(detach({ ...h, language: 'ar', sourceHadithId: id, topics: [...(hadithTopics.get(id) ?? [])], raw: { file: page.file, sha256: page.sha256 }, fetchedAt: now() }));
    },
    progress('hadiths (ar)')
  );
  ar.forEach((r, i) => r instanceof Error && errors.push({ url: `${JAMHARAH}/t/${ids[i]}`, stage: 'hadith', message: r.message }));

  // 3. Translations listed on each Arabic page
  const unknownLanguages = new Map<string, number>();
  const jobs = records.flatMap((r) =>
    r.translations.flatMap((t) => {
      if (!t.language) {
        unknownLanguages.set(t.name, (unknownLanguages.get(t.name) ?? 0) + 1);
        return [];
      }
      return LANGS && !LANGS.has(t.language) ? [] : [{ arId: r.id, language: t.language, url: t.url, topics: r.topics }];
    })
  );
  const tr = await mapAll(
    jobs,
    async (job) => {
      const page = await fetcher.get(job.url);
      const h = parseHadithPage(doc(page.body), job.url);
      if (!h.text) throw new Error('empty translation page');
      records.push(detach({ ...h, language: job.language, sourceHadithId: job.arId, topics: job.topics, raw: { file: page.file, sha256: page.sha256 }, fetchedAt: now() }));
    },
    progress('translations')
  );
  tr.forEach((r, i) => r instanceof Error && errors.push({ url: jobs[i].url, stage: 'translation', message: r.message }));

  // 4. Output
  records.sort((a, b) => Number(a.sourceHadithId) - Number(b.sourceHadithId) || (a.language === 'ar' ? -1 : b.language === 'ar' ? 1 : a.language.localeCompare(b.language)));
  writeJsonl(path.join(OUT, 'hadith.jsonl'), records);
  const arabic = records.filter((r) => r.language === 'ar');
  const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc), {});
  const report = {
    source: 'islamic-content.com — معجم السنة النبوية (الجمهرة)',
    startedAt: started,
    finishedAt: now(),
    trialBatch: Number.isFinite(LIMIT),
    topics: topics.length,
    hadithsFound: hadithTopics.size,
    hadithsProcessed: arabic.length,
    grades: count(arabic, (r) => r.grade ?? '— missing'),
    withoutGradeOrTakhrij: arabic.filter((r) => !r.grade || !r.takhrij).map((r) => r.url),
    withExplanation: arabic.filter((r) => r.explanation).length,
    translationsByLanguage: count(records.filter((r) => r.language !== 'ar'), (r) => r.language),
    unknownLanguageNames: Object.fromEntries(unknownLanguages),
    httpRequests: fetcher.requests,
    reusedSavedPages: fetcher.cacheHits,
    errors,
  };
  writeJson(path.join(OUT, 'report.json'), report);
  console.log(`✓ ${arabic.length} hadiths, ${records.length - arabic.length} translations (${Object.entries(report.translationsByLanguage).map(([k, v]) => `${k}:${v}`).join(' ')}), ${errors.length} error(s).`);
}

main().catch((err) => {
  console.error('\n✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
