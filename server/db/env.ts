/**
 * Supabase configuration, read ONLY from environment variables.
 * Values are never logged; errors list missing variable NAMES only.
 *
 * Supported key names (Supabase dashboard → Project Settings → API Keys):
 *   SUPABASE_SECRET_KEY       new-style secret key (sb_secret_…)      — preferred
 *   SUPABASE_SERVICE_ROLE_KEY legacy service_role JWT                  — fallback
 *   SUPABASE_PUBLISHABLE_KEY  new-style publishable key (sb_publishable_…) — preferred
 *   SUPABASE_ANON_KEY         legacy anon JWT                          — fallback
 */
import { z } from 'zod';

export class SupabaseConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Supabase is not configured. Missing or invalid environment variables: ${missing.join(', ')}`);
    this.name = 'SupabaseConfigError';
  }
}

export interface SupabaseEnv {
  url: string;
  secretKey: string;
  publishableKey: string | null;
}

type Env = Record<string, string | undefined>;

const nonEmpty = z.string().trim().min(1);

function pick(env: Env, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function readSupabaseEnv(env: Env = process.env): SupabaseEnv {
  const missing: string[] = [];

  const url = pick(env, 'SUPABASE_URL');
  if (!url || !z.url({ protocol: /^https?$/ }).safeParse(url).success) missing.push('SUPABASE_URL');

  const secretKey = pick(env, 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!secretKey || !nonEmpty.safeParse(secretKey).success) missing.push('SUPABASE_SECRET_KEY');

  if (missing.length > 0) throw new SupabaseConfigError(missing);

  return {
    url: url!.replace(/\/+$/, ''),
    secretKey: secretKey!,
    publishableKey: pick(env, 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY') ?? null,
  };
}

export function isSupabaseConfigured(env: Env = process.env): boolean {
  try {
    readSupabaseEnv(env);
    return true;
  } catch {
    return false;
  }
}
