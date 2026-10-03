/**
 * TEST DATA / TEST DOUBLES ONLY — never used by the server.
 * A deterministic stand-in for OpenAI:
 *  - embed(): hashed bag-of-words vectors (1536 dims) so similarity reflects shared words
 *  - generateJson(): scripted responses per schema (classification / answer), recorded for assertions
 */
import type { AiProvider, GenerateJsonRequest } from '../../server/ai/provider.ts';
import { normalizeArabic } from '../../server/db/normalize.ts';

export const TEST_EMBEDDING_MODEL = 'test-embedding-model';
const DIMS = 1536;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function hashEmbed(text: string): number[] {
  const v = new Array<number>(DIMS).fill(0);
  v[0] = 0.05; // keeps every vector non-zero (cosine is undefined for zero vectors)
  const tokens = (normalizeArabic(text) ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const t of tokens) if (t.length > 2) v[1 + (fnv1a(t) % (DIMS - 1))] += 1;
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

export interface FakeClassification {
  in_scope: boolean;
  personal_case: boolean;
  level: 'A' | 'B' | 'C' | 'D';
  intent: 'general' | 'hadith_request' | 'quran_quote' | 'terminology' | 'other';
  hostile: boolean;
}

export interface FakeAnswer {
  evidence_sufficient: boolean;
  answer: string;
  cited_sources: string[];
  level: 'A' | 'B' | 'C';
  mentions_scholarly_difference: boolean;
}

export class FakeAi implements AiProvider {
  readonly chatModel = 'test-chat-model';
  readonly embeddingModel = TEST_EMBEDDING_MODEL;
  readonly embeddingDimensions = DIMS;
  readonly requests: GenerateJsonRequest[] = [];
  readonly embedded: string[] = [];

  classification: FakeClassification = { in_scope: true, personal_case: false, level: 'B', intent: 'general', hostile: false };
  /** Default answer: cites the first source. Override per test. */
  answer: (req: GenerateJsonRequest) => FakeAnswer = () => ({
    evidence_sufficient: true,
    answer: 'TEST ANSWER grounded in the first source [S1].',
    cited_sources: ['S1'],
    level: 'B',
    mentions_scholarly_difference: false,
  });

  async embed(texts: string[]): Promise<number[][]> {
    this.embedded.push(...texts);
    return texts.map(hashEmbed);
  }

  async generateJson<T>(req: GenerateJsonRequest): Promise<T> {
    this.requests.push(req);
    if (req.schema.name === 'sanad_classification') return this.classification as T;
    if (req.schema.name === 'sanad_answer') return this.answer(req) as T;
    throw new Error(`unexpected schema ${req.schema.name}`);
  }

  answerRequests(): GenerateJsonRequest[] {
    return this.requests.filter((r) => r.schema.name === 'sanad_answer');
  }
}
