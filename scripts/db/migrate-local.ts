/**
 * Applies supabase/migrations/*.sql to a LOCAL PostgreSQL database.
 *
 * Usage:  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sanad npm run db:migrate:local
 *
 * For the real Supabase project use the Supabase CLI instead (`npm run db:push`),
 * which keeps its own migration history. This script refuses Supabase hosts so the
 * two histories can never get mixed up.
 */
import 'dotenv/config';
import { applyMigrations } from './migrations.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Example: postgresql://postgres:postgres@localhost:5432/sanad');
  process.exit(1);
}

if (/supabase\.(co|com|net)/i.test(new URL(url).hostname)) {
  console.error('Refusing to run against a Supabase host. Use `npm run db:push` (Supabase CLI) instead.');
  process.exit(1);
}

applyMigrations(url, { withSupabaseShim: true, log: console.log })
  .then(({ applied, skipped }) => {
    console.log(`\n✓ migrations applied: ${applied.length}, already up to date: ${skipped.length}`);
  })
  .catch((err) => {
    console.error('\n✗ migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
