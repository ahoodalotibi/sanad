/**
 * SANAD RAG pipeline
 *
 *  question
 *   → normalisation          (query.ts)
 *   → language routing       (language.ts)
 *   → classification A–D     (classify.ts: rules + model)
 *   → retrieval              (store.ts: published, active, non-test chunks only)
 *   → source filtering       (evidence.ts)
 *   → confidence evaluation  (evidence.ts, server-side thresholds from config.ts)
 *   → answer generation      (prompts.ts + AiProvider, structured output)
 *   → guards                 (guards.ts: valid citations, no unsupported quotes)
 *   → citations              (citations.ts, built from the database)
 *  or, at any failed gate → safe refusal / specialist handoff. No answer is ever generated
 *  without retrieved, published evidence.
 */
import type { ContentLevel, SanadResponse, SupportedLanguage } from '../../src/types/index.ts';
import type { AiProvider } from '../ai/provider.ts';
import { buildCitations } from './citations.ts';
import { classifyQuestion, type Classification } from './classify.ts';
import type { RagSettings } from './config.ts';
import { assessConfidence, domainsForIntent, filterSources, hasAuthenticHadith, type ConfidenceAssessment } from './evidence.ts';
import { findUnsupportedQuotes, validateCitations } from './guards.ts';
import { detectLanguage, resolveAnswerLanguage, type DetectedLanguage } from './language.ts';
import { refusalMessage } from './messages.ts';
import { ANSWER_SCHEMA, buildAnswerSystemPrompt, buildAnswerUserPrompt, buildSourceKeys, type RawAnswer } from './prompts.ts';
import { normalizeQuery } from './query.ts';
import type { RagStore } from './store.ts';

export interface RagDeps {
  ai: AiProvider;
  store: RagStore;
  settings: RagSettings;
  /** TEST ONLY: allow synthetic fixtures flagged test_data. Never set by the API server. */
  includeTestData?: boolean;
}

export interface AskInput {
  question: string;
  uiLanguage: SupportedLanguage;
}

export type Outcome = 'answer' | 'no_reliable_answer' | 'handoff' | 'out_of_scope';

export type RefusalReason =
  | 'no_sources'
  | 'below_threshold'
  | 'too_few_sources'
  | 'no_authentic_hadith'
  | 'model_insufficient'
  | 'no_valid_citations'
  | 'unsupported_quote';

export interface RagTrace {
  detectedLanguage: DetectedLanguage;
  answerLanguage: SupportedLanguage;
  classification?: Classification;
  retrieved: number;
  contextIds: string[];
  droppedIds: string[];
  confidence?: ConfidenceAssessment;
  outcome: Outcome;
  reason?: RefusalReason | 'personal_case' | 'out_of_scope';
  invalidCitationKeys?: string[];
}

export interface RagResult {
  response: SanadResponse;
  trace: RagTrace;
}

const LEVEL_ORDER: ContentLevel[] = ['A', 'B', 'C', 'D'];
const maxLevel = (...levels: (ContentLevel | null | undefined)[]): ContentLevel =>
  levels.filter((l): l is ContentLevel => !!l).reduce<ContentLevel>((a, b) => (LEVEL_ORDER.indexOf(b) > LEVEL_ORDER.indexOf(a) ? b : a), 'A');

export async function answerQuestion(input: AskInput, deps: RagDeps): Promise<RagResult> {
  const { ai, store, settings } = deps;

  // 1–2. Normalise and route language
  const query = normalizeQuery(input.question, settings.maxQuestionChars);
  const detectedLanguage = detectLanguage(query.text);
  const lang = resolveAnswerLanguage(detectedLanguage, input.uiLanguage);
  const trace: RagTrace = { detectedLanguage, answerLanguage: lang, retrieved: 0, contextIds: [], droppedIds: [], outcome: 'no_reliable_answer' };

  // 3. Classify (A–D, scope, intent, personal case)
  const cls = await classifyQuestion(query.text, ai);
  trace.classification = cls;
  if (!cls.inScope) return finish(trace, 'out_of_scope', 'out_of_scope', refusal(lang, 'out_of_scope'));
  const personal = cls.personalCase;

  // 4. Retrieve (published, active, non-test only — enforced in the database function)
  const [embedding] = await ai.embed([query.text]);
  const retrieved = await store.search({
    embedding,
    queryText: query.search,
    embeddingModel: ai.embeddingModel,
    matchCount: settings.topK,
    domains: domainsForIntent(cls.intent),
    includeTestData: deps.includeTestData === true,
  });
  trace.retrieved = retrieved.length;

  // 5. Filter sources
  const { context, dropped } = filterSources(retrieved, { intent: cls.intent, settings });
  trace.contextIds = context.map((c) => c.id);
  trace.droppedIds = dropped.map((d) => d.id);

  // 6. Confidence
  const confidence = assessConfidence(context, settings);
  trace.confidence = confidence;
  if (!confidence.sufficient) {
    return personal
      ? finish(trace, 'handoff', 'personal_case', handoff(lang, confidence.score))
      : finish(trace, 'no_reliable_answer', confidence.reason as RefusalReason, noReliable(lang, confidence.score));
  }

  // 7. Linked scripture (re-checked for publication) + hadith authenticity gate
  const scripture = await store.getScripture(context.map((c) => c.id), lang);
  if (cls.intent === 'hadith_request' && !hasAuthenticHadith(scripture)) {
    return finish(trace, 'no_reliable_answer', 'no_authentic_hadith', noReliable(lang, confidence.score));
  }

  // 8. Generate from the evidence only
  const sources = buildSourceKeys(context, scripture);
  const levelHint = maxLevel(cls.level, ...context.map((c) => c.levelHint));
  const raw = await ai.generateJson<RawAnswer>({
    system: buildAnswerSystemPrompt({ language: lang, mode: personal ? 'general_info' : 'answer', levelHint: personal ? 'D' : levelHint, hostile: cls.hostile }),
    user: buildAnswerUserPrompt(query.text, sources),
    schema: ANSWER_SCHEMA,
    maxOutputTokens: 1200,
  });

  if (!raw.evidence_sufficient || !raw.answer?.trim()) {
    return personal
      ? finish(trace, 'handoff', 'personal_case', handoff(lang, confidence.score))
      : finish(trace, 'no_reliable_answer', 'model_insufficient', noReliable(lang, confidence.score));
  }

  // 9. Guards: valid citations, no unsupported quotations
  const check = validateCitations(raw.answer, raw.cited_sources ?? [], sources.map((s) => s.key));
  trace.invalidCitationKeys = check.invalidKeys;
  if (!check.ok) return finish(trace, 'no_reliable_answer', 'no_valid_citations', noReliable(lang, confidence.score));

  const citedSources = check.orderedKeys.map((k) => sources.find((s) => s.key === k)!);
  const evidenceTexts = citedSources.flatMap((s) => [s.chunk.content, ...s.scripture.flatMap((x) => [x.text, x.translation ?? ''])]);
  if (findUnsupportedQuotes(check.text, evidenceTexts, lang).length > 0) {
    return finish(trace, 'no_reliable_answer', 'unsupported_quote', noReliable(lang, confidence.score));
  }

  // 10. Build the response — citations and scripture come from the database, not the model
  const citations = buildCitations(check.orderedKeys, sources);
  const shown = citedSources.flatMap((s) => s.scripture)[0];
  const level: ContentLevel = personal ? 'D' : maxLevel(raw.level, levelHint === 'D' ? 'C' : levelHint);
  const response: SanadResponse = {
    answerText: check.text,
    aiExplanation: check.text,
    scriptureOriginal: shown?.text,
    translationApproved: shown?.translation ?? undefined,
    translationStatus: shown?.translationStatus ?? undefined,
    contentLevel: level,
    contentLevelTitle: '',
    citations,
    isOutOfScope: false,
    isSpecialistHandoffNeeded: personal || level === 'C',
    handoffReason: personal ? 'personal_fatwa' : level === 'C' ? 'sensitive_dispute' : undefined,
    confidenceScore: confidence.score,
    engine: 'rag',
  };
  return finish(trace, personal ? 'handoff' : 'answer', personal ? 'personal_case' : undefined, response);
}

function finish(trace: RagTrace, outcome: Outcome, reason: RagTrace['reason'], response: SanadResponse): RagResult {
  return { response, trace: { ...trace, outcome, reason } };
}

function noReliable(lang: SupportedLanguage, score: number): SanadResponse {
  return {
    answerText: refusalMessage(lang, 'no_reliable_answer'),
    contentLevel: 'C',
    contentLevelTitle: '',
    citations: [],
    isOutOfScope: false,
    isSpecialistHandoffNeeded: true,
    handoffReason: 'low_confidence_unverified',
    confidenceScore: score,
    engine: 'rag',
  };
}

function handoff(lang: SupportedLanguage, score: number): SanadResponse {
  return {
    answerText: refusalMessage(lang, 'handoff'),
    contentLevel: 'D',
    contentLevelTitle: '',
    citations: [],
    isOutOfScope: false,
    isSpecialistHandoffNeeded: true,
    handoffReason: 'personal_fatwa',
    confidenceScore: score,
    engine: 'rag',
  };
}

function refusal(lang: SupportedLanguage, kind: 'out_of_scope'): SanadResponse {
  return {
    answerText: refusalMessage(lang, kind),
    contentLevel: 'B',
    contentLevelTitle: '',
    citations: [],
    isOutOfScope: true,
    isSpecialistHandoffNeeded: false,
    confidenceScore: 0,
    engine: 'rag',
  };
}
