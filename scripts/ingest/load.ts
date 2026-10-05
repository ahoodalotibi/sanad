/**
 * Loads extracted material into Supabase as DRAFTS (never published automatically).
 *
 *   npm run ingest:load -- --source=dictionary     data/ingest/jamharah-dictionary/entries.jsonl
 *   npm run ingest:load -- --source=bayyinat       data/ingest/bayyinat/qa.jsonl
 *   add --dry to run the whole mapping in memory without touching the database.
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY (server-side secret, see .env.example) and the
 * migrations applied (`npm run db:push`). Without them the script says so and changes nothing:
 * the extracted files remain the deliverable until the keys are available.
 * Safe to re-run: documents are matched on (source, external_ref) and unchanged ones are skipped.
 */
import 'dotenv/config';
import path from 'node:path';
import { parseArgs, readJsonl, writeJson } from './lib/cli.ts';
import { createMemoryIngestStore, createSupabaseIngestStore, type IngestStore } from './lib/store.ts';
import { loadDictionary } from './jamharah/load.ts';
import { loadBayyinat } from './bayyinat/load.ts';
import type { DictionaryRecord } from './jamharah-dictionary.ts';
import type { BayyinatRecord } from './bayyinat/extract.ts';

const args = parseArgs();
const SOURCES = {
  dictionary: { dir: 'data/ingest/jamharah-dictionary', file: 'entries.jsonl' },
  bayyinat: { dir: 'data/ingest/bayyinat', file: 'qa.jsonl' },
} as const;

async function main() {
  const key = args.source as keyof typeof SOURCES;
  if (!SOURCES[key]) throw new Error(`--source must be one of: ${Object.keys(SOURCES).join(', ')}`);
  const dir = path.resolve(args.dir ?? SOURCES[key].dir);
  const file = path.join(dir, SOURCES[key].file);
  const rows = readJsonl<unknown>(file);
  if (!rows.length) throw new Error(`Nothing to load: ${path.relative(process.cwd(), file)} is missing or empty. Run the extraction first.`);

  const url = process.env.SUPABASE_URL?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const dry = args.dry === 'true';
  let store: IngestStore;
  let target: string;
  if (dry) {
    store = createMemoryIngestStore().store;
    target = 'memory (dry run)';
  } else if (url && secret) {
    store = createSupabaseIngestStore(url, secret);
    target = new URL(url).host;
  } else {
    const msg = 'SUPABASE_URL / SUPABASE_SECRET_KEY are not set — nothing was inserted into the database. The extracted data is ready locally in ' + path.relative(process.cwd(), file);
    writeJson(path.join(dir, 'load-report.json'), { status: 'not_loaded', reason: msg, rows: rows.length, at: new Date().toISOString() });
    console.log(`⚠ ${msg}`);
    return;
  }

  console.log(`Loading ${rows.length} record(s) from ${path.relative(process.cwd(), file)} → ${target}`);
  const report: { documents: Record<string, number>; chunks: number; skipped: unknown[]; terms?: number; termTranslations?: number } =
    key === 'dictionary' ? await loadDictionary(rows as DictionaryRecord[], store) : await loadBayyinat(rows as BayyinatRecord[], store);
  writeJson(path.join(dir, dry ? 'load-report.dry.json' : 'load-report.json'), { status: dry ? 'dry_run' : 'loaded', target, at: new Date().toISOString(), ...report });
  const extra = report.terms !== undefined ? `, ${report.terms} terms, ${report.termTranslations} term translations` : '';
  console.log(`✓ ${JSON.stringify(report.documents)} documents, ${report.chunks} chunks${extra}, ${report.skipped.length} skipped`);
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
