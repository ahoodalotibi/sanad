/**
 * Sanad's answer path (the journey in the proposal):
 *   question → language & intent → clarify if unclear (max 2) → personal / out of scope → refer
 *            → search the approved corpus → select what directly answers → show it from the corpus
 *            → nothing suitable → refer to a daee in the asker's language
 * The model (when configured) only classifies, writes search keywords and picks ids. Without a
 * model, keyword rules and search scores decide, more conservatively.
 */
import type { AnswerItem, AskRequest, AskResponse } from './contract.ts';
import type { Corpus, CorpusItem } from './corpus.ts';
import { SELECT_SYSTEM, Selection, UNDERSTAND_SYSTEM, Understanding, type Llm } from './llm.ts';
import { asksForHuman, isGreeting, looksPersonal } from './rules.ts';
import type { SearchHit, SearchIndex } from './search.ts';
import { contentTokens, detectLanguage } from './text.ts';

export const MAX_CLARIFICATIONS = 2;
/**
 * Without a model nobody checks that a text really answers the question, so only a near-exact
 * match is shown (every content word of the question found in the text); otherwise → a daee.
 */
export const FALLBACK_MIN_SCORE = 8;
export const FALLBACK_MIN_COVERAGE = 0.9;

export interface AnswerDeps {
  index: SearchIndex;
  corpus: Corpus;
  llm: Llm | null;
  log?: (msg: string) => void;
}

export interface AnswerTrace {
  language: string;
  category: string;
  usedModel: boolean;
  hits: Array<{ id: string; score: number; coverage: number }>;
  selected: string[];
}

export async function answer(req: AskRequest, deps: AnswerDeps): Promise<{ response: AskResponse; trace: AnswerTrace }> {
  const q = req.question.trim().slice(0, 1000);
  const fallbackLang = req.uiLanguage || 'en';

  // 1. Understand
  let u: Understanding | null = null;
  if (deps.llm) {
    try {
      const history = (req.history ?? []).slice(-4).map((t) => `${t.role}: ${t.text}`).join('\n');
      u = await deps.llm.json(UNDERSTAND_SYSTEM, `${history ? `Previous turns:\n${history}\n\n` : ''}Current message:\n${q}`, Understanding);
    } catch (err) {
      deps.log?.(`[answer] understand failed, using rules: ${(err as Error).message}`);
    }
  }
  const language = (req.language || u?.language || detectLanguage(q, fallbackLang)).toLowerCase().split('-')[0];
  // rules are a safety net even when the model is used: personal cases always go to a person
  const category = asksForHuman(q) ? 'request_human' : looksPersonal(q) ? 'personal_case' : (u?.category ?? (isGreeting(q) ? 'greeting' : 'question'));
  const trace: AnswerTrace = { language, category, usedModel: !!u, hits: [], selected: [] };
  const done = (response: AskResponse) => ({ response, trace });

  if (category === 'greeting') return done({ kind: 'greeting', language });
  if (category === 'request_human') return done({ kind: 'refer', language, reason: 'user_request' });
  if (category === 'personal_case') return done({ kind: 'refer', language, reason: 'personal_case' });
  if (category === 'out_of_scope') return done({ kind: 'refer', language, reason: 'out_of_scope' });

  // 2. Clarify when unclear (at most twice, then a person takes over)
  const clarifications = req.clarifications ?? 0;
  const tooVague = u ? !u.clear : contentTokens(q).length === 0;
  if (tooVague) {
    if (clarifications < MAX_CLARIFICATIONS && u?.clarify_question) {
      return done({ kind: 'clarify', language, question: u.clarify_question, options: (u.clarify_options ?? []).slice(0, 3) });
    }
    return done({ kind: 'refer', language, reason: 'unclear' });
  }

  // 3. Search the approved corpus (original question + model keywords in Arabic and English)
  const queries = [q, ...(u ? [u.keywords_ar.join(' '), u.keywords_en.join(' ')] : [])].filter((x) => x.trim());
  // candidates from each kind of source, so 12,000+ glossary terms cannot crowd out hadith and Q&A
  const hits = deps.llm && u
    ? [...deps.index.search(queries, { limit: 4, kinds: ['qa'] }), ...deps.index.search(queries, { limit: 4, kinds: ['hadith'] }), ...deps.index.search(queries, { limit: 4, kinds: ['term'] })].sort((a, b) => b.score - a.score)
    : deps.index.search(queries, { limit: 8 });
  trace.hits = hits.map((h) => ({ id: h.item.id, score: Math.round(h.score * 100) / 100, coverage: Math.round(h.coverage * 100) / 100 }));

  // 4. Select what directly answers
  let selected: CorpusItem[] = [];
  if (hits.length && deps.llm && u) {
    try {
      const sel = await deps.llm.json(SELECT_SYSTEM, selectionPrompt(q, hits), Selection);
      const byId = new Map(hits.map((h) => [h.item.id, h.item]));
      selected = sel.selected.map((id) => byId.get(id)).filter((x): x is CorpusItem => !!x);
    } catch (err) {
      deps.log?.(`[answer] select failed, using scores: ${(err as Error).message}`);
      selected = fallbackSelect(hits, q);
    }
  } else {
    selected = fallbackSelect(hits, q);
  }
  trace.selected = selected.map((s) => s.id);
  if (!selected.length) return done({ kind: 'refer', language, reason: 'not_found' });

  // 5. Show it — from the corpus only
  const items = selected.map((it) => present(it, language, deps.corpus));
  const offerReferral = items.some((i) => i.translation !== 'source');
  return done({ kind: 'answer', language, items, offerReferral });
}

/**
 * Without a model: show a text only when the question is essentially its title — a glossary term
 * whose name is the question's words, or a published Q&A whose question (or listed similar question)
 * contains every content word. Hadith are never chosen without a model (matching words in a narration
 * says nothing about whether it answers the question).
 */
function fallbackSelect(hits: SearchHit[], question: string): CorpusItem[] {
  const want = new Set(contentTokens(question));
  if (want.size === 0) return [];
  for (const h of hits.slice(0, 5)) {
    if (h.score < FALLBACK_MIN_SCORE || h.coverage < FALLBACK_MIN_COVERAGE) continue;
    if (titleMatches(h.item, want)) return [h.item];
  }
  return [];
}

function titleMatches(it: CorpusItem, want: Set<string>): boolean {
  const versions = it.kind === 'hadith' ? [] : [it.ar, ...Object.values(it.tr)];
  const titles = versions.flatMap((v) => (it.kind === 'qa' ? [(v as QaVersion).question, ...(v as QaVersion).similar] : it.kind === 'term' ? [(v as { title: string }).title] : []));
  const covers = (title: string) => {
    const have = new Set(contentTokens(title));
    const hit = [...want].filter((w) => have.has(w)).length;
    return it.kind === 'term' ? hit === want.size && hit === have.size : hit === want.size;
  };
  return titles.some(covers);
}
type QaVersion = { question: string; similar: string[] };

const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? s.slice(0, n) + '…' : s) : '');

function selectionPrompt(q: string, hits: SearchHit[]): string {
  const lines = hits.map((h, i) => {
    const it = h.item;
    const en = it.tr.en as { text?: string; question?: string; title?: string } | undefined;
    if (it.kind === 'hadith') return `[${i + 1}] id=${it.id} (hadith, ${it.grade})\nAR: ${clip(it.ar.text, 500)}${en?.text ? `\nEN: ${clip(en.text, 400)}` : ''}`;
    if (it.kind === 'qa') return `[${i + 1}] id=${it.id} (question & answer)\nQ: ${clip(it.ar.question, 300)}\nSimilar: ${clip(it.ar.similar.join(' | '), 200)}\nShort answer: ${clip(it.ar.shortAnswer, 400)}`;
    return `[${i + 1}] id=${it.id} (dictionary term)\nTerm: ${it.ar.title}${en?.title ? ` / ${en.title}` : ''}\nDefinition: ${clip(it.ar.sections[0]?.text, 300)}`;
  });
  return `User question:\n${q}\n\nCandidates:\n${lines.join('\n\n')}`;
}

/** Picks the asker's language when the source publishes it; otherwise English, then Arabic. */
function pickVersion<T>(item: { ar: T; tr: Record<string, T> }, language: string): { v: T; lang: string; translation: AnswerItem['translation'] } {
  if (language === 'ar') return { v: item.ar, lang: 'ar', translation: 'source' };
  if (item.tr[language]) return { v: item.tr[language], lang: language, translation: 'source' };
  if (item.tr.en) return { v: item.tr.en, lang: 'en', translation: 'alternative' };
  return { v: item.ar, lang: 'ar', translation: 'none' };
}

export function present(it: CorpusItem, language: string, corpus: Corpus): AnswerItem {
  if (it.kind === 'hadith') {
    const { v, lang, translation } = pickVersion(it, language);
    return {
      type: 'hadith',
      id: it.id,
      text: v.text,
      textLanguage: lang,
      arabic: it.ar.text,
      grade: it.grade,
      takhrij: it.takhrij,
      explanation: v.explanation,
      explanationLanguage: v.explanation ? lang : null,
      wordMeanings: lang === 'ar' ? it.ar.wordMeanings : [],
      translation,
      source: { name: corpus.sources.hadith?.name ?? 'الجمهرة', url: lang === 'ar' ? it.url : v.url },
    };
  }
  if (it.kind === 'qa') {
    const { v, lang, translation } = pickVersion(it, language);
    return {
      type: 'qa',
      id: it.id,
      language: lang,
      question: v.question,
      shortAnswer: v.shortAnswer,
      detailedAnswer: v.detailedAnswer,
      translation,
      source: { name: corpus.sources.qa?.name ?? 'منصة بينات', url: v.url },
      ...(it.relatedBook ? { relatedBook: { name: it.relatedBook.title, url: it.relatedBook.url } } : {}),
    };
  }
  const { v, lang, translation } = pickVersion(it, language);
  return {
    type: 'term',
    id: it.id,
    language: lang,
    term: v.title,
    arabicTerm: it.ar.title,
    definitions: v.sections,
    translation,
    source: { name: corpus.sources.term?.name ?? 'الجمهرة', url: v.url },
  };
}
