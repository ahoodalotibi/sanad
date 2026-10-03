/**
 * Shared migration runner used by `db:migrate:local` and the database test suite.
 * Each migration runs in its own transaction and is recorded in
 * supabase_migrations.schema_migrations (the same table name the Supabase CLI uses).
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(here, '../../supabase/migrations');
export const SHIM_FILE = path.resolve(here, 'supabase-local-shim.sql');

export interface MigrationFile {
  version: string;
  name: string;
  file: string;
}

export async function listMigrations(dir = MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const entries = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return entries.map((file) => {
    const match = /^(\d{14})_(.+)\.sql$/.exec(file);
    if (!match) throw new Error(`Invalid migration file name: ${file} (expected <14-digit timestamp>_<name>.sql)`);
    return { version: match[1], name: match[2], file: path.join(dir, file) };
  });
}

export async function applyMigrations(
  connectionString: string,
  opts: { withSupabaseShim?: boolean; log?: (msg: string) => void } = {}
): Promise<{ applied: string[]; skipped: string[] }> {
  const log = opts.log ?? (() => {});
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    if (opts.withSupabaseShim) {
      await client.query(await readFile(SHIM_FILE, 'utf8'));
    }

    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        name    text,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows } = await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations');
    const done = new Set(rows.map((r) => r.version));

    for (const m of await listMigrations()) {
      if (done.has(m.version)) {
        skipped.push(m.version);
        continue;
      }
      const sql = await readFile(m.file, 'utf8');
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)', [m.version, m.name]);
        await client.query('commit');
        applied.push(m.version);
        log(`  ✓ ${m.version}_${m.name}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`${m.version}_${m.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await client.end();
  }

  return { applied, skipped };
}
