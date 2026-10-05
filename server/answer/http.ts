/**
 * HTTP layer for the answer path.
 *   POST /api/ask   { question, uiLanguage?, history?, clarifications? } → AskResponse
 *   GET  /api/meta  → which content languages exist, whether the model is enabled
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { createRateLimiter } from '../api/ask.ts';
import { corpusLanguages, loadCorpus, type Corpus } from './corpus.ts';
import { createLlm, readLlmSettings, type Llm } from './llm.ts';
import { answer } from './pipeline.ts';
import { SearchIndex } from './search.ts';

const Body = z.object({
  question: z.string().trim().min(1).max(1000),
  uiLanguage: z.string().max(10).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) })).max(10).optional(),
  clarifications: z.number().int().min(0).max(5).optional(),
});

export interface AnswerService {
  corpus: Corpus | null;
  index: SearchIndex | null;
  llm: Llm | null;
  error: string | null;
}

export function createAnswerService(corpusFile = process.env.CORPUS_FILE || path.resolve('data/corpus/corpus.json.gz')): AnswerService {
  const settings = readLlmSettings();
  const llm = settings ? createLlm(settings) : null;
  if (!fs.existsSync(corpusFile)) return { corpus: null, index: null, llm, error: `corpus not found at ${corpusFile} — run npm run corpus:build` };
  const corpus = loadCorpus(corpusFile);
  const index = new SearchIndex(corpus);
  console.log(`[answer] corpus: ${corpus.items.length} items, ${index.size} language versions; model: ${settings ? settings.model : 'none (rules only)'}`);
  return { corpus, index, llm, error: null };
}

export function askHandler(service: AnswerService, limiter = createRateLimiter(20, 60_000)) {
  return async (req: Request, res: Response) => {
    if (!limiter(req.ip ?? 'unknown')) return res.status(429).json({ code: 'RATE_LIMITED' });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'INVALID_INPUT' });
    if (!service.corpus || !service.index) return res.status(503).json({ code: 'CORPUS_MISSING' });
    try {
      const { response, trace } = await answer(parsed.data, { corpus: service.corpus, index: service.index, llm: service.llm, log: console.warn });
      // operational log without the question text (privacy)
      console.info(`[ask] ${response.kind} lang=${trace.language} cat=${trace.category} model=${trace.usedModel} selected=${trace.selected.join(',') || '-'}`);
      return res.json(response);
    } catch (err) {
      console.error('[ask] failed', err instanceof Error ? err.message : err);
      return res.status(500).json({ code: 'ASK_FAILED' });
    }
  };
}

export function metaHandler(service: AnswerService) {
  return (_req: Request, res: Response) =>
    res.json({
      ready: !!service.corpus,
      model: !!service.llm,
      items: service.corpus?.items.length ?? 0,
      languages: service.corpus ? corpusLanguages(service.corpus) : {},
      builtAt: service.corpus?.builtAt ?? null,
    });
}
