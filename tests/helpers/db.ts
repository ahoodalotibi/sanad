/**
 * Test helpers: each test file gets its own freshly-migrated throw-away database.
 * Requires TEST_DATABASE_URL (an admin connection to a local PostgreSQL with pgvector).
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { applyMigrations } from '../../scripts/db/migrations.ts';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

export type ApiRole = 'anon' | 'authenticated' | 'service_role';

export interface TestDatabase {
  url: string;
  name: string;
  pool: pg.Pool;
  query: <T extends pg.QueryResultRow = any>(sql: string, params?: unknown[]) => Promise<pg.QueryResult<T>>;
  /** Runs fn inside a transaction as an API role (optionally as a signed-in user), then rolls back. */
  asRole: <T>(role: ApiRole, userId: string | null, fn: (c: pg.PoolClient) => Promise<T>) => Promise<T>;
  drop: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  const name = `sanad_test_${randomBytes(4).toString('hex')}`;

  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  await applyMigrations(url.toString(), { withSupabaseShim: true });

  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  return {
    url: url.toString(),
    name,
    pool,
    query: (sql, params) => pool.query(sql, params as any[]),
    async asRole(role, userId, fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(`set local role ${role}`);
        await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
        return await fn(client);
      } finally {
        await client.query('rollback').catch(() => {});
        client.release();
      }
    },
    async drop() {
      await pool.end();
      const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
  };
}

/** Expects a query to fail with a given Postgres SQLSTATE (e.g. 23503 FK, 23514 check, 42501 privilege). */
export async function expectPgError(promise: Promise<unknown>, sqlstate: string): Promise<void> {
  try {
    await promise;
  } catch (err: any) {
    if (err?.code === sqlstate) return;
    throw new Error(`expected SQLSTATE ${sqlstate}, got ${err?.code}: ${err?.message}`);
  }
  throw new Error(`expected SQLSTATE ${sqlstate}, but the query succeeded`);
}
