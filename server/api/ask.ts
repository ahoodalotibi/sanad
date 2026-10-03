/**
 * POST /api/ask — the only endpoint that answers questions.
 *  200 → SanadResponse (answer, no-reliable-answer, handoff or out-of-scope)
 *  400 → invalid input
 *  429 → rate limited
 *  503 → { code: 'RAG_NOT_CONFIGURED' } when OpenAI/Supabase env vars are missing
 *  500 → { code: 'RAG_FAILED' } (details are logged server-side, never returned)
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { answerQuestion, QueryError, type RagDeps } from '../rag/index.ts';

const Body = z.object({
  question: z.string().min(1).max(5000),
  language: z.enum(['en', 'ur', 'bn']),
});

/** Small in-memory fixed-window limiter (per client IP). Enough for a single-instance demo server. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const t = now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

export function createAskHandler(getDeps: () => RagDeps | null, opts: { limiter?: (key: string) => boolean; log?: (msg: string, err?: unknown) => void } = {}) {
  const limiter = opts.limiter ?? createRateLimiter(20, 60_000);
  const log = opts.log ?? ((msg, err) => console.error(msg, err instanceof Error ? err.message : err ?? ''));

  return async (req: Request, res: Response) => {
    if (!limiter(req.ip ?? 'unknown')) return res.status(429).json({ code: 'RATE_LIMITED' });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'INVALID_INPUT' });

    const deps = getDeps();
    if (!deps) return res.status(503).json({ code: 'RAG_NOT_CONFIGURED' });

    try {
      const { response, trace } = await answerQuestion({ question: parsed.data.question, uiLanguage: parsed.data.language }, deps);
      // Operational log without the question text (privacy): outcome, reason, confidence only.
      console.info(`[rag] outcome=${trace.outcome} reason=${trace.reason ?? '-'} lang=${trace.answerLanguage} retrieved=${trace.retrieved} context=${trace.contextIds.length} confidence=${trace.confidence?.score ?? 0}`);
      return res.json(response);
    } catch (err) {
      if (err instanceof QueryError) return res.status(400).json({ code: err.code === 'too_long' ? 'QUESTION_TOO_LONG' : 'INVALID_INPUT' });
      log('[rag] failed', err);
      return res.status(500).json({ code: 'RAG_FAILED' });
    }
  };
}
