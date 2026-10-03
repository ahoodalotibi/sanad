/**
 * Supabase clients — SERVER ONLY.
 *
 *  getServiceClient()      secret key, bypasses RLS. Used by the API server and
 *                          ingestion scripts. Never expose it to the browser.
 *  createUserClient(jwt)   publishable key + the signed-in user's access token,
 *                          so every query runs under that user's RLS policies.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import { readSupabaseEnv, SupabaseConfigError, type SupabaseEnv } from './env.ts';

export type SanadDbClient = SupabaseClient<Database>;

if (typeof window !== 'undefined') {
  throw new Error('server/db must never be imported into browser code (it handles the Supabase secret key).');
}

const SERVER_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

let cachedServiceClient: SanadDbClient | null = null;

export function createServiceClient(config: SupabaseEnv = readSupabaseEnv()): SanadDbClient {
  return createClient<Database>(config.url, config.secretKey, {
    auth: SERVER_AUTH_OPTIONS,
    global: { headers: { 'x-application-name': 'sanad-server' } },
  });
}

/** Process-wide singleton for the service client. */
export function getServiceClient(): SanadDbClient {
  cachedServiceClient ??= createServiceClient();
  return cachedServiceClient;
}

export function createUserClient(accessToken: string, config: SupabaseEnv = readSupabaseEnv()): SanadDbClient {
  if (!config.publishableKey) throw new SupabaseConfigError(['SUPABASE_PUBLISHABLE_KEY']);
  return createClient<Database>(config.url, config.publishableKey, {
    auth: SERVER_AUTH_OPTIONS,
    global: { headers: { Authorization: `Bearer ${accessToken}`, 'x-application-name': 'sanad-server' } },
  });
}

export interface DbHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** Cheap connectivity check: reads the (tiny, public) languages table. */
export async function pingDatabase(client: SanadDbClient): Promise<DbHealth> {
  const started = performance.now();
  const { error } = await client.from('languages').select('code', { count: 'exact', head: true });
  const latencyMs = Math.round(performance.now() - started);
  return error ? { ok: false, latencyMs, error: error.message } : { ok: true, latencyMs };
}
