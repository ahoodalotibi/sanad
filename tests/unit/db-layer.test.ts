/** Unit tests for the database layer that need no database. */
import { describe, expect, it } from 'vitest';
import { isSupabaseConfigured, readSupabaseEnv, SupabaseConfigError } from '../../server/db/env.ts';
import { DbError, unwrap, unwrapMaybe } from '../../server/db/errors.ts';
import { normalizeAlias, normalizeArabic } from '../../server/db/normalize.ts';
import { toPgVector } from '../../server/db/repositories/chunks.ts';
import { hashSessionId } from '../../server/db/repositories/conversations.ts';

describe('readSupabaseEnv', () => {
  const valid = {
    SUPABASE_URL: 'https://example-ref.supabase.co/',
    SUPABASE_SECRET_KEY: 'sb_secret_test_value',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_value',
  };

  it('reads and normalises valid configuration', () => {
    expect(readSupabaseEnv(valid)).toEqual({
      url: 'https://example-ref.supabase.co',
      secretKey: 'sb_secret_test_value',
      publishableKey: 'sb_publishable_test_value',
    });
  });

  it('falls back to legacy key names', () => {
    const cfg = readSupabaseEnv({ SUPABASE_URL: valid.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'legacy-service', SUPABASE_ANON_KEY: 'legacy-anon' });
    expect(cfg.secretKey).toBe('legacy-service');
    expect(cfg.publishableKey).toBe('legacy-anon');
  });

  it('reports missing variable names without leaking any values', () => {
    try {
      readSupabaseEnv({ SUPABASE_URL: 'not a url', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_secretish' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SupabaseConfigError);
      expect((err as SupabaseConfigError).missing).toEqual(['SUPABASE_URL', 'SUPABASE_SECRET_KEY']);
      expect((err as Error).message).not.toContain('sb_publishable_secretish');
    }
    expect(isSupabaseConfigured({})).toBe(false);
    expect(isSupabaseConfigured(valid)).toBe(true);
  });
});

describe('result unwrapping', () => {
  it('returns data, maps errors to DbError with the SQLSTATE', () => {
    expect(unwrap('op', { data: [1], error: null })).toEqual([1]);
    expect(unwrapMaybe('op', { data: null, error: null })).toBeNull();
    const err = (() => {
      try {
        unwrap('sources.list', { data: null, error: { message: 'duplicate', code: '23505', details: '', hint: '', name: 'PostgrestError' } as any });
      } catch (e) {
        return e as DbError;
      }
    })();
    expect(err).toBeInstanceOf(DbError);
    expect(err?.isUniqueViolation).toBe(true);
    expect(err?.message).toBe('sources.list failed: duplicate');
    expect(() => unwrap('op', { data: null, error: null })).toThrow(DbError);
  });
});

describe('normalizeArabic', () => {
  it('removes diacritics and unifies letter forms', () => {
    expect(normalizeArabic('أَحْمَدُ')).toBe('احمد');
    expect(normalizeArabic('مُسْتَشْفَى')).toBe('مستشفي');
    expect(normalizeArabic('مَكْتَبَةٌ')).toBe('مكتبه');
    expect(normalizeArabic('   ')).toBeNull();
    expect(normalizeAlias('Tawhid ')).toBe('tawhid');
  });
});

describe('toPgVector', () => {
  it('accepts exactly 1536 finite numbers', () => {
    expect(toPgVector(new Array(1536).fill(0.5))).toMatch(/^\[0\.5(,0\.5){1535}\]$/);
    expect(() => toPgVector([1, 2, 3])).toThrow(RangeError);
    expect(() => toPgVector([...new Array(1535).fill(0), Number.NaN])).toThrow(RangeError);
  });
});

describe('hashSessionId', () => {
  it('stores only a SHA-256 hex digest and rejects weak ids', () => {
    const hash = hashSessionId('a-random-client-session-id-123');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('session');
    expect(() => hashSessionId('short')).toThrow(RangeError);
  });
});
