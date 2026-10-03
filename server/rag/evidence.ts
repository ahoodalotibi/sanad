/**
 * Source filtering and confidence evaluation — pure functions, fully unit-tested.
 */
import type { SourceDomain } from '../db/types.ts';
import type { RagSettings } from './config.ts';
import type { Intent } from './classify.ts';
import type { RetrievedChunk, ScriptureRef } from './store.ts';

/** Domains a question may be answered from, by intent. null = any approved domain. */
export function domainsForIntent(intent: Intent): SourceDomain[] | null {
  switch (intent) {
    case 'hadith_request':
      return ['hadith'];
    case 'quran_quote':
      return ['quran', 'tafseer'];
    default:
      return null;
  }
}

export type DropReason = 'low_similarity' | 'wrong_domain' | 'duplicate' | 'over_limit';

export interface FilterResult {
  context: RetrievedChunk[];
  dropped: { id: string; reason: DropReason }[];
}

export function filterSources(chunks: RetrievedChunk[], opts: { intent: Intent; settings: RagSettings }): FilterResult {
  const allowed = domainsForIntent(opts.intent);
  const dropped: FilterResult['dropped'] = [];
  const seen = new Set<string>();
  const kept: RetrievedChunk[] = [];

  for (const c of [...chunks].sort((a, b) => b.similarity - a.similarity)) {
    if (allowed && !allowed.includes(c.sourceDomain)) {
      dropped.push({ id: c.id, reason: 'wrong_domain' });
      continue;
    }
    if (c.similarity < opts.settings.minContextSimilarity) {
      dropped.push({ id: c.id, reason: 'low_similarity' });
      continue;
    }
    const key = c.content.replace(/\s+/g, ' ').trim();
    if (seen.has(key)) {
      dropped.push({ id: c.id, reason: 'duplicate' });
      continue;
    }
    seen.add(key);
    if (kept.length >= opts.settings.maxContextChunks) {
      dropped.push({ id: c.id, reason: 'over_limit' });
      continue;
    }
    kept.push(c);
  }
  return { context: kept, dropped };
}

export interface ConfidenceAssessment {
  /** best vector similarity among usable chunks (0 when none) */
  score: number;
  supporting: number;
  sufficient: boolean;
  reason: 'ok' | 'no_sources' | 'below_threshold' | 'too_few_sources';
}

/**
 * Evidence is sufficient only when the best chunk clears RAG_MIN_CONFIDENCE and at least
 * RAG_MIN_SUPPORTING_SOURCES usable chunks exist. Full-text-only matches have similarity 0
 * and therefore can never justify an answer on their own.
 */
export function assessConfidence(context: RetrievedChunk[], settings: RagSettings): ConfidenceAssessment {
  if (context.length === 0) return { score: 0, supporting: 0, sufficient: false, reason: 'no_sources' };
  const score = Math.round(Math.max(...context.map((c) => c.similarity)) * 1000) / 1000;
  if (score < settings.minConfidence) return { score, supporting: context.length, sufficient: false, reason: 'below_threshold' };
  if (context.length < settings.minSupportingSources) return { score, supporting: context.length, sufficient: false, reason: 'too_few_sources' };
  return { score, supporting: context.length, sufficient: true, reason: 'ok' };
}

/** A hadith may only be presented when an authentic (sahih/hasan) narration is among the evidence. */
export function hasAuthenticHadith(scripture: ScriptureRef[]): boolean {
  return scripture.some((s) => s.kind === 'hadith' && (s.grade === 'sahih' || s.grade === 'hasan'));
}
