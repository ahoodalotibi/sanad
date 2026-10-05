/**
 * Builds the served corpus (data/corpus/corpus.json.gz) from the ingested files, keeping only
 * items that pass the validation gate. Writes data/corpus/report.json with every rejection reason.
 *
 *   npm run corpus:build
 *   npm run corpus:build -- --in=data/ingest --out=data/corpus
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readJsonl, writeJson } from '../ingest/lib/cli.ts';
import { corpusLanguages, SOURCE_NAMES, writeCorpus, type Corpus, type CorpusItem } from '../../server/answer/corpus.ts';
import { validateHadith, validateQa, validateTerms, type Verdict } from './validate.ts';
import type { HadithRecord } from '../ingest/jamharah-hadith.ts';
import type { BayyinatRecord } from '../ingest/bayyinat.ts';
import type { DictionaryRecord } from '../ingest/jamharah-dictionary.ts';

const args = parseArgs();
const IN = path.resolve(args.in ?? 'data/ingest');
const OUT = path.resolve(args.out ?? 'data/corpus');

function summarise<T extends CorpusItem>(name: string, verdicts: Verdict<T>[]) {
  const accepted = verdicts.filter((v): v is Extract<Verdict<T>, { ok: true }> => v.ok);
  const rejected = verdicts.filter((v): v is Extract<Verdict<T>, { ok: false }> => !v.ok);
  const reasons: Record<string, number> = {};
  for (const r of rejected) for (const why of r.reasons) reasons[why.replace(/^\d+ /, 'N ').replace(/: .*/, '')] = (reasons[why.replace(/^\d+ /, 'N ').replace(/: .*/, '')] ?? 0) + 1;
  console.log(`  ${name}: ${accepted.length} accepted, ${rejected.length} rejected`);
  return {
    items: accepted.map((a) => a.item),
    report: { accepted: accepted.length, rejected: rejected.length, rejectionReasons: reasons, rejectedItems: rejected, warnings: accepted.filter((a) => a.warnings.length).map((a) => ({ id: a.item.id, warnings: a.warnings })) },
  };
}

function main() {
  console.log(`Building corpus from ${IN}`);
  const hadith = summarise('hadith', validateHadith(readJsonl<HadithRecord>(path.join(IN, 'jamharah-hadith/hadith.jsonl'))));
  const qa = summarise('bayyinat', validateQa(readJsonl<BayyinatRecord>(path.join(IN, 'bayyinat/qa.jsonl'))));
  const terms = summarise('dictionary', validateTerms(readJsonl<DictionaryRecord>(path.join(IN, 'jamharah-dictionary/entries.jsonl'))));
  const corpus: Corpus = { builtAt: new Date().toISOString(), sources: SOURCE_NAMES, items: [...hadith.items, ...qa.items, ...terms.items] };
  if (corpus.items.length === 0) throw new Error('No item passed validation — nothing to serve. Run the ingestion scripts first.');
  fs.mkdirSync(OUT, { recursive: true });
  writeCorpus(path.join(OUT, 'corpus.json.gz'), corpus);
  writeJson(path.join(OUT, 'report.json'), { builtAt: corpus.builtAt, languages: corpusLanguages(corpus), hadith: hadith.report, bayyinat: qa.report, dictionary: terms.report });
  console.log(`✓ ${corpus.items.length} items → ${path.relative(process.cwd(), path.join(OUT, 'corpus.json.gz'))}; languages: ${JSON.stringify(corpusLanguages(corpus))}`);
}

try {
  main();
} catch (err) {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
}
