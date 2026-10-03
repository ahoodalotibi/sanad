/**
 * SANAD RAG — server only. Wires configuration, OpenAI and Supabase together.
 */
import { OpenAiProvider } from '../ai/openai.ts';
import { getServiceClient } from '../db/client.ts';
import { isSupabaseConfigured } from '../db/env.ts';
import { isRagConfigured, readOpenAiSettings, readRagSettings } from './config.ts';
import type { RagDeps } from './pipeline.ts';
import { createSupabaseRagStore } from './store.ts';

export { answerQuestion, type AskInput, type RagDeps, type RagResult, type RagTrace } from './pipeline.ts';
export { QueryError } from './query.ts';
export { isRagConfigured, readRagSettings, RagConfigError } from './config.ts';

let cached: RagDeps | null = null;

/** Production dependencies, built once from environment variables. Returns null when not configured. */
export function getRagDeps(): RagDeps | null {
  if (cached) return cached;
  if (!isRagConfigured() || !isSupabaseConfigured()) return null;
  cached = {
    ai: new OpenAiProvider(readOpenAiSettings()),
    store: createSupabaseRagStore(getServiceClient()),
    settings: readRagSettings(),
    includeTestData: false, // never expose synthetic test fixtures to users
  };
  return cached;
}
