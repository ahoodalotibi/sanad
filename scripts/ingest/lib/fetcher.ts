/**
 * Polite HTTP fetching for ingestion scripts.
 *  - Saves every downloaded response body unchanged under <rawDir>, so the original is always kept.
 *  - Re-uses the saved copy on the next run (resumable, and the source site is not hit twice)
 *    unless `refresh` is set.
 *  - Limited concurrency, a small delay between requests, retries with back-off on errors/429.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface FetcherOptions {
  rawDir: string;
  concurrency?: number;
  delayMs?: number;
  refresh?: boolean;
  userAgent?: string;
  retries?: number;
}

export interface FetchedFile {
  url: string;
  /** Path of the saved original, relative to rawDir */
  file: string;
  sha256: string;
  bytes: number;
  fromCache: boolean;
  contentType: string | null;
}

export class FetchError extends Error {
  constructor(
    readonly url: string,
    readonly status: number | null,
    message: string
  ) {
    super(message);
  }
}

export const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

/** Maps a URL to a stable file path, e.g. https://x.com/a/b?c=1 → x.com/a/b__c=1.html */
export function urlToFile(url: string, ext = '.html'): string {
  const u = new URL(url);
  const clean = (s: string) => s.replace(/[^A-Za-z0-9._=-]+/g, '_');
  const parts = u.pathname.split('/').filter(Boolean).map(clean);
  const last = (parts.pop() ?? 'index') + (u.search ? `__${clean(u.search.slice(1))}` : '');
  return path.join(clean(u.hostname), ...parts, last.endsWith(ext) ? last : last + ext);
}

export class Fetcher {
  private active = 0;
  private queue: Array<() => void> = [];
  private lastStart = 0;
  readonly opts: Required<FetcherOptions>;
  requests = 0;
  cacheHits = 0;

  constructor(opts: FetcherOptions) {
    this.opts = {
      concurrency: 3,
      delayMs: 300,
      refresh: false,
      retries: 4,
      userAgent: 'SANAD-hackathon-ingest/1.0 (+https://github.com/ahoodalotibi/sanad; non-commercial research)',
      ...opts,
    };
    fs.mkdirSync(this.opts.rawDir, { recursive: true });
  }

  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.opts.concurrency) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    try {
      const wait = this.lastStart + this.opts.delayMs - Date.now();
      this.lastStart = Date.now() + Math.max(0, wait);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }

  /** Downloads `url` (or re-uses the saved original) and returns the saved file. */
  async get(url: string, ext = '.html'): Promise<FetchedFile & { body: Buffer }> {
    const file = urlToFile(url, ext);
    const full = path.join(this.opts.rawDir, file);
    if (!this.opts.refresh && fs.existsSync(full)) {
      const body = fs.readFileSync(full);
      this.cacheHits++;
      return { url, file, body, sha256: sha256(body), bytes: body.length, fromCache: true, contentType: null };
    }
    return this.slot(async () => {
      let lastError: FetchError | null = null;
      for (let attempt = 0; attempt <= this.opts.retries; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        try {
          this.requests++;
          const res = await fetch(url, { headers: { 'User-Agent': this.opts.userAgent, Accept: '*/*' }, redirect: 'follow' });
          if (res.status === 404) throw new FetchError(url, 404, 'not found');
          if (!res.ok) {
            lastError = new FetchError(url, res.status, `HTTP ${res.status}`);
            if (res.status === 429 || res.status >= 500) continue;
            throw lastError;
          }
          const body = Buffer.from(await res.arrayBuffer());
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, body);
          return { url, file, body, sha256: sha256(body), bytes: body.length, fromCache: false, contentType: res.headers.get('content-type') };
        } catch (err) {
          if (err instanceof FetchError && (err.status === 404 || (err.status !== null && err.status < 500 && err.status !== 429))) throw err;
          lastError = err instanceof FetchError ? err : new FetchError(url, null, err instanceof Error ? err.message : String(err));
        }
      }
      throw lastError ?? new FetchError(url, null, 'unknown error');
    });
  }
}

/** Runs `fn` over items with the fetcher doing the rate limiting; collects errors instead of stopping. */
export async function mapAll<T, R>(items: T[], fn: (item: T, i: number) => Promise<R>, onProgress?: (done: number, total: number) => void): Promise<Array<R | Error>> {
  let done = 0;
  return Promise.all(
    items.map(async (item, i) => {
      try {
        return await fn(item, i);
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      } finally {
        done++;
        onProgress?.(done, items.length);
      }
    })
  );
}
