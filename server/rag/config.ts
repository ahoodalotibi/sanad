/**
 * RAG configuration — server-side environment only. The UI never sees or sets thresholds.
 *
 *   OPENAI_API_KEY                required
 *   OPENAI_MODEL                  required  (chat / reasoning model used for classification + answers)
 *   OPENAI_EMBEDDING_MODEL        default text-embedding-3-small
 *   OPENAI_EMBEDDING_DIMENSIONS   default 1536 — must equal knowledge_chunks.embedding (vector(1536))
 *   OPENAI_TEMPERATURE            optional (omit for models that do not accept it)
 *   OPENAI_TIMEOUT_MS             default 30000
 *
 *   RAG_MIN_CONFIDENCE            default 0.45  best retrieved similarity required to answer at all
 *   RAG_MIN_CONTEXT_SIMILARITY    default 0.30  a chunk below this is never shown to the model
 *   RAG_MIN_SUPPORTING_SOURCES    default 1     number of usable chunks required to answer
 *   RAG_TOP_K                     default 8     chunks retrieved before filtering
 *   RAG_MAX_CONTEXT_CHUNKS        default 6     chunks given to the model
 *   RAG_MAX_QUESTION_CHARS        default 1000
 *
 * The thresholds must be calibrated on the real dataset with the 12 evaluation cases.
 */
import { z } from 'zod';
import { EMBEDDING_DIMENSIONS } from '../db/types.ts';
import type { OpenAiSettings } from '../ai/openai.ts';

export interface RagSettings {
  minConfidence: number;
  minContextSimilarity: number;
  minSupportingSources: number;
  topK: number;
  maxContextChunks: number;
  maxQuestionChars: number;
}

export const DEFAULT_RAG_SETTINGS: RagSettings = {
  minConfidence: 0.45,
  minContextSimilarity: 0.3,
  minSupportingSources: 1,
  topK: 8,
  maxContextChunks: 6,
  maxQuestionChars: 1000,
};

export class RagConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`RAG is not configured: ${problems.join('; ')}`);
    this.name = 'RagConfigError';
  }
}

type Env = Record<string, string | undefined>;

const unit = z.coerce.number().min(0).max(1);
const posInt = z.coerce.number().int().positive();

export function readRagSettings(env: Env = process.env): RagSettings {
  const problems: string[] = [];
  const num = (name: string, schema: z.ZodType<number>, fallback: number) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      problems.push(`${name} is invalid`);
      return fallback;
    }
    return parsed.data;
  };
  const settings: RagSettings = {
    minConfidence: num('RAG_MIN_CONFIDENCE', unit, DEFAULT_RAG_SETTINGS.minConfidence),
    minContextSimilarity: num('RAG_MIN_CONTEXT_SIMILARITY', unit, DEFAULT_RAG_SETTINGS.minContextSimilarity),
    minSupportingSources: num('RAG_MIN_SUPPORTING_SOURCES', posInt, DEFAULT_RAG_SETTINGS.minSupportingSources),
    topK: num('RAG_TOP_K', posInt.max(50), DEFAULT_RAG_SETTINGS.topK),
    maxContextChunks: num('RAG_MAX_CONTEXT_CHUNKS', posInt.max(20), DEFAULT_RAG_SETTINGS.maxContextChunks),
    maxQuestionChars: num('RAG_MAX_QUESTION_CHARS', posInt.max(5000), DEFAULT_RAG_SETTINGS.maxQuestionChars),
  };
  if (settings.minContextSimilarity > settings.minConfidence) {
    problems.push('RAG_MIN_CONTEXT_SIMILARITY must not exceed RAG_MIN_CONFIDENCE');
  }
  if (problems.length) throw new RagConfigError(problems);
  return settings;
}

export function readOpenAiSettings(env: Env = process.env): OpenAiSettings {
  const problems: string[] = [];
  const apiKey = env.OPENAI_API_KEY?.trim();
  const chatModel = env.OPENAI_MODEL?.trim();
  if (!apiKey) problems.push('OPENAI_API_KEY is missing');
  if (!chatModel) problems.push('OPENAI_MODEL is missing');

  const embeddingModel = env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';
  const dims = Number(env.OPENAI_EMBEDDING_DIMENSIONS?.trim() || EMBEDDING_DIMENSIONS);
  if (dims !== EMBEDDING_DIMENSIONS) {
    problems.push(`OPENAI_EMBEDDING_DIMENSIONS must be ${EMBEDDING_DIMENSIONS} to match the database`);
  }
  const tempRaw = env.OPENAI_TEMPERATURE?.trim();
  const temperature = tempRaw ? Number(tempRaw) : undefined;
  if (temperature !== undefined && !(temperature >= 0 && temperature <= 2)) problems.push('OPENAI_TEMPERATURE is invalid');
  const timeoutMs = Number(env.OPENAI_TIMEOUT_MS?.trim() || 30000);
  if (!(timeoutMs > 0)) problems.push('OPENAI_TIMEOUT_MS is invalid');

  if (problems.length) throw new RagConfigError(problems);
  return { apiKey: apiKey!, chatModel: chatModel!, embeddingModel, embeddingDimensions: dims, temperature, timeoutMs };
}

/** True when both OpenAI and RAG settings are valid (Supabase is checked separately). */
export function isRagConfigured(env: Env = process.env): boolean {
  try {
    readOpenAiSettings(env);
    readRagSettings(env);
    return true;
  } catch {
    return false;
  }
}
