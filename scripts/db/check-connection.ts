/**
 * `npm run db:check` — verifies the Supabase connection from your local .env
 * and that every SANAD table exists (i.e. migrations were pushed).
 * Prints only table names and counts — never keys.
 */
import 'dotenv/config';
import { createServiceClient, pingDatabase, readSupabaseEnv, SupabaseConfigError } from '../../server/db/index.ts';
import type { Database } from '../../server/db/database.types.ts';

const TABLES = [
  'languages', 'sources', 'documents',
  'quran_surahs', 'quran_ayahs', 'translation_editions', 'quran_translations',
  'hadith_collections', 'hadiths', 'hadith_translations',
  'terms', 'term_translations', 'term_aliases',
  'knowledge_chunks', 'chunk_references',
  'user_roles', 'specialists', 'specialist_languages',
  'conversations', 'messages', 'message_sources',
  'handoff_requests', 'handoff_consulted_sources', 'handoff_events',
  'eval_test_cases', 'eval_case_prompts', 'eval_runs', 'eval_results',
] as const satisfies readonly (keyof Database['public']['Tables'])[];

async function main() {
  let config;
  try {
    config = readSupabaseEnv();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      console.error(`✗ ${err.message}\n  Fill them in your local .env (see .env.example).`);
      process.exit(1);
    }
    throw err;
  }

  console.log(`Supabase project: ${new URL(config.url).hostname}`);
  const db = createServiceClient(config);

  const health = await pingDatabase(db);
  if (!health.ok) {
    console.error(`✗ cannot reach the database: ${health.error}`);
    console.error('  If the error mentions "languages", the migrations have not been pushed yet: npm run db:push');
    process.exit(1);
  }
  console.log(`✓ connected (${health.latencyMs} ms)`);

  let missing = 0;
  for (const table of TABLES) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      missing++;
      console.log(`  ✗ ${table.padEnd(26)} ${error.message}`);
    } else {
      console.log(`  ✓ ${table.padEnd(26)} ${count ?? 0} rows`);
    }
  }

  if (missing > 0) {
    console.error(`\n✗ ${missing} table(s) unavailable — run: npm run db:push`);
    process.exit(1);
  }
  console.log(`\n✓ all ${TABLES.length} tables reachable`);
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
