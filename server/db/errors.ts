import type { PostgrestError } from '@supabase/supabase-js';

/** Error thrown by the repository layer; keeps Postgres/PostgREST codes for callers. */
export class DbError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly hint: string | undefined;

  constructor(operation: string, cause: Pick<PostgrestError, 'message'> & Partial<PostgrestError>) {
    super(`${operation} failed: ${cause.message}`);
    this.name = 'DbError';
    this.code = cause.code || undefined;
    this.details = cause.details || undefined;
    this.hint = cause.hint || undefined;
  }

  /** Postgres unique_violation */
  get isUniqueViolation(): boolean {
    return this.code === '23505';
  }

  /** Postgres foreign_key_violation */
  get isForeignKeyViolation(): boolean {
    return this.code === '23503';
  }
}

type AnyResult = { data: unknown; error: PostgrestError | null };

/** Returns data or throws DbError. Use when a row MUST exist. */
export function unwrap<R extends AnyResult>(operation: string, result: R): NonNullable<R['data']> {
  if (result.error) throw new DbError(operation, result.error);
  if (result.data === null || result.data === undefined) {
    throw new DbError(operation, { message: 'no data returned', code: 'PGRST116' });
  }
  return result.data as NonNullable<R['data']>;
}

/** Returns data (possibly null) or throws DbError. Use with .maybeSingle(). */
export function unwrapMaybe<R extends AnyResult>(operation: string, result: R): NonNullable<R['data']> | null {
  if (result.error) throw new DbError(operation, result.error);
  return (result.data ?? null) as NonNullable<R['data']> | null;
}

/** Throws on error for operations whose payload is not needed. */
export function check(operation: string, result: { error: PostgrestError | null }): void {
  if (result.error) throw new DbError(operation, result.error);
}
