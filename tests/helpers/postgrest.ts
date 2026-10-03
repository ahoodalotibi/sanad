/**
 * Runs a real PostgREST in front of a test database, mounted at /rest/v1 like
 * Supabase, so repositories are tested through supabase-js end to end.
 * Enabled when POSTGREST_BIN points to a PostgREST binary.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';

import type { TestDatabase } from './db.ts';

export const POSTGREST_BIN = process.env.POSTGREST_BIN;

const AUTHENTICATOR_PASSWORD = 'authenticator-test-only';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signJwt(secret: string, claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims }));
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export interface TestApi {
  url: string;
  serviceKey: string;
  anonKey: string;
  userToken: (userId: string) => string;
  stop: () => Promise<void>;
}

export async function startPostgrest(db: TestDatabase): Promise<TestApi> {
  if (!POSTGREST_BIN) throw new Error('POSTGREST_BIN is not set');

  // Supabase's "authenticator" login role, which PostgREST switches from into the API roles.
  await db.query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticator') then
        create role authenticator login noinherit password '${AUTHENTICATOR_PASSWORD}';
      end if;
    end $$;
    grant anon, authenticated, service_role to authenticator;`);

  const jwtSecret = randomBytes(32).toString('hex');
  const pgrstPort = await freePort();
  const dbUrl = new URL(db.url);
  dbUrl.username = 'authenticator';
  dbUrl.password = AUTHENTICATOR_PASSWORD;

  const proc: ChildProcess = spawn(POSTGREST_BIN, [], {
    env: {
      PGRST_DB_URI: dbUrl.toString(),
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',
      PGRST_JWT_SECRET: jwtSecret,
      PGRST_SERVER_HOST: '127.0.0.1',
      PGRST_SERVER_PORT: String(pgrstPort),
      PGRST_LOG_LEVEL: 'error',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  proc.stderr?.on('data', (d) => (stderr += d));

  // Mount PostgREST under /rest/v1 like Supabase.
  const proxy = http.createServer((req, res) => {
    const path = (req.url ?? '/').replace(/^\/rest\/v1/, '') || '/';
    const upstream = http.request(
      { host: '127.0.0.1', port: pgrstPort, path, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${pgrstPort}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      }
    );
    upstream.on('error', (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(upstream);
  });
  const proxyPort = await freePort();
  await new Promise<void>((resolve) => proxy.listen(proxyPort, '127.0.0.1', resolve));

  // Wait until PostgREST has loaded its schema cache.
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${pgrstPort}/languages?select=code&limit=1`);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline || proc.exitCode !== null) {
      proxy.close();
      proc.kill();
      throw new Error(`PostgREST did not start: ${stderr}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  return {
    url: `http://127.0.0.1:${proxyPort}`,
    serviceKey: signJwt(jwtSecret, { role: 'service_role' }),
    anonKey: signJwt(jwtSecret, { role: 'anon' }),
    userToken: (userId) => signJwt(jwtSecret, { role: 'authenticated', sub: userId }),
    async stop() {
      proc.kill();
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
      // make sure PostgREST's pool is gone before the database is dropped
      await new Promise((r) => setTimeout(r, 100));
    },
  };
}

