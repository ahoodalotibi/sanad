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

/**
 * Minimal robots.txt reader: the rules for "User-agent: *" (and for a group naming "sanad").
 * Returns the disallowed path prefixes and the crawl delay, if any.
 */
export function parseRobots(text: string, agent = 'sanad'): { disallow: string[]; crawlDelayMs: number | null } {
  const groups: Array<{ agents: string[]; disallow: string[]; delay: number | null }> = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], disallow: [], delay: null }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === 'disallow' && val) cur.disallow.push(val);
    if (key === 'crawl-delay' && Number(val) > 0) cur.delay = Number(val) * 1000;
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a))) ?? groups.find((g) => g.agents.includes('*'));
  return { disallow: mine?.disallow ?? [], crawlDelayMs: mine?.delay ?? null };
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
  private robots = new Map<string, Promise<{ disallow: string[]; crawlDelayMs: number | null }>>();

  /** Fetches and caches robots.txt rules per origin; a missing robots.txt allows everything. */
  private rulesFor(origin: string) {
    if (!this.robots.has(origin)) {
      this.robots.set(
        origin,
        fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': this.opts.userAgent } })
          .then(async (r) => (r.ok ? parseRobots(await r.text()) : { disallow: [], crawlDelayMs: null }))
          .catch(() => ({ disallow: [], crawlDelayMs: null }))
      );
    }
    return this.robots.get(origin)!;
  }

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
    const u = new URL(url);
    const rules = await this.rulesFor(u.origin);
    if (rules.disallow.some((d) => (u.pathname + u.search).startsWith(d))) throw new FetchError(url, null, 'disallowed by robots.txt');
    if (rules.crawlDelayMs && rules.crawlDelayMs > this.opts.delayMs) (this.opts as { delayMs: number }).delayMs = rules.crawlDelayMs;
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
          if (err instanceof FetchError && err.message === 'disallowed by robots.txt') throw err;
          if (err instanceof FetchError && (err.status === 404 || (err.status !== null && err.status < 500 && err.status !== 429))) throw err;
          lastError = err instanceof FetchError ? err : new FetchError(url, null, err instanceof Error ? err.message : String(err));
        }
      }
      throw lastError ?? new FetchError(url, null, 'unknown error');
    });
  }
}

/**
 * Runs `fn` over items with at most `limit` in flight (the fetcher also rate-limits network calls);
 * collects errors instead of stopping. The limit matters when pages come from the local cache:
 * without it every saved page would be read and parsed at the same time.
 */
export async function mapAll<T, R>(items: T[], fn: (item: T, i: number) => Promise<R>, onProgress?: (done: number, total: number) => void, limit = 8): Promise<Array<R | Error>> {
  const results: Array<R | Error> = new Array(items.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = err instanceof Error ? err : new Error(String(err));
      } finally {
        done++;
        onProgress?.(done, items.length);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
