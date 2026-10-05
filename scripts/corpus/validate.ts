/**
 * Validation gate: decides which ingested items may be used in answers.
 * An item that fails stays in the ingested files (and as a draft in the database) with the reason;
 * it simply never reaches the served corpus. Matching the website is necessary but not sufficient.
 */
import type { HadithItem, QaItem, TermItem } from '../../server/answer/corpus.ts';
import type { HadithRecord } from '../ingest/jamharah-hadith.ts';
import type { BayyinatRecord } from '../ingest/bayyinat.ts';
import type { DictionaryRecord } from '../ingest/jamharah-dictionary.ts';
import { gradeEnum } from '../ingest/jamharah/hadith-parse.ts';
import { isQuranReference, RELATED_BOOK } from '../ingest/bayyinat/parse.ts';

export type Verdict<T> = { ok: true; item: T; warnings: string[] } | { ok: false; id: string; reasons: string[] };

const MIN_ANSWER = 40;
const FULL_VERSE_CHARS = 60;

const groupBy = <T,>(rows: T[], key: (r: T) => string) => {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
};

export function validateHadith(rows: HadithRecord[]): Verdict<HadithItem>[] {
  const out: Verdict<HadithItem>[] = [];
  for (const [id, group] of groupBy(rows, (r) => r.sourceHadithId)) {
    const ar = group.find((r) => r.language === 'ar');
    const reasons: string[] = [];
    const warnings: string[] = [];
    if (!ar) {
      out.push({ ok: false, id: `t:${id}`, reasons: ['Arabic original missing'] });
      continue;
    }
    const g = gradeEnum(ar.grade);
    if (!ar.text.trim()) reasons.push('hadith text is empty');
    if (!ar.grade) reasons.push('no published grade');
    else if (g !== 'sahih' && g !== 'hasan') reasons.push(`grade not accepted for answers: ${ar.grade}`);
    if (!ar.takhrij) reasons.push('no takhrij (source of the hadith)');
    if (reasons.length) {
      out.push({ ok: false, id: `t:${id}`, reasons });
      continue;
    }
    const tr: HadithItem['tr'] = {};
    for (const t of group) {
      if (t.language === 'ar') continue;
      if (!t.text.trim()) {
        warnings.push(`${t.language}: empty translation skipped`);
        continue;
      }
      // a translation must point back to this Arabic page
      if (!t.translations.some((l) => l.id === ar.id)) warnings.push(`${t.language}: translation page does not link back to the Arabic page`);
      tr[t.language] = { url: t.url, text: t.text, explanation: t.explanation };
    }
    out.push({
      ok: true,
      warnings,
      item: {
        kind: 'hadith',
        id: `t:${ar.id}`,
        url: ar.url,
        grade: ar.grade!,
        gradeEnum: g as 'sahih' | 'hasan',
        takhrij: ar.takhrij!,
        topics: ar.topics,
        ar: { url: ar.url, text: ar.text, explanation: ar.explanation, wordMeanings: ar.wordMeanings, benefits: ar.benefits },
        tr,
      },
    });
  }
  return out;
}

export function validateQa(rows: BayyinatRecord[]): Verdict<QaItem>[] {
  const out: Verdict<QaItem>[] = [];
  for (const [id, group] of groupBy(rows, (r) => r.sourceItemId)) {
    const ar = group.find((r) => r.language === 'ar');
    const reasons: string[] = [];
    const warnings: string[] = [];
    if (!ar) {
      out.push({ ok: false, id: `bayenat:${id}`, reasons: ['Arabic original missing'] });
      continue;
    }
    if (!ar.question.trim()) reasons.push('question is empty');
    if (ar.shortAnswer.trim().length < MIN_ANSWER) reasons.push('short answer missing or too short');
    if (!ar.detailedAnswer.trim()) warnings.push('no detailed answer');
    // A full verse must carry its sura:ayah reference. Short phrases quoted again from a verse the answer
    // already cites are published without one; they are allowed but reported.
    const unreferenced = (ar.quotes ?? []).filter((q) => q.text.startsWith('{') && !isQuranReference(q.reference));
    const longOnes = unreferenced.filter((q) => q.text.length >= FULL_VERSE_CHARS);
    if (longOnes.length) reasons.push(`${longOnes.length} Quran quotation(s) without a sura:ayah reference`);
    if (unreferenced.length > longOnes.length) warnings.push(`${unreferenced.length - longOnes.length} short Quran phrase(s) quoted without their own reference`);
    if (reasons.length) {
      out.push({ ok: false, id: `bayenat:${id}`, reasons });
      continue;
    }
    const v = (r: BayyinatRecord) => ({ url: r.url, question: r.question, similar: r.similar, shortAnswer: r.shortAnswer, detailedAnswer: r.detailedAnswer });
    const tr: QaItem['tr'] = {};
    for (const t of group) if (t.language !== 'ar' && t.question && t.shortAnswer) tr[t.language] = v(t);
    out.push({ ok: true, warnings, item: { kind: 'qa', id: `bayenat:${id}`, url: ar.url, category: ar.category, relatedBook: { url: (ar.relatedBook ?? RELATED_BOOK).url, title: (ar.relatedBook ?? RELATED_BOOK).title }, ar: v(ar), tr } });
  }
  // the same question published twice: keep both (different answers), but say so
  const byQuestion = groupBy(
    out.filter((x): x is Extract<Verdict<QaItem>, { ok: true }> => x.ok),
    (x) => x.item.ar.question.replace(/\s+/g, ' ')
  );
  for (const same of byQuestion.values()) if (same.length > 1) for (const x of same) x.warnings.push(`same question text as ${same.filter((y) => y !== x).map((y) => y.item.id).join(', ')}`);
  return out;
}

export function validateTerms(rows: DictionaryRecord[]): Verdict<TermItem>[] {
  const out: Verdict<TermItem>[] = [];
  for (const [id, group] of groupBy(rows, (r) => r.wordId)) {
    const ar = group.find((r) => r.language === 'ar');
    if (!ar || !ar.title || ar.sections.length === 0) {
      out.push({ ok: false, id: `word:${id}`, reasons: ['Arabic entry missing or without a published definition'] });
      continue;
    }
    const v = (r: DictionaryRecord) => ({ url: r.url, title: r.title, sections: r.sections.map((s) => ({ label: s.label, text: s.text })) });
    const tr: TermItem['tr'] = {};
    for (const t of group) if (t.language !== 'ar' && t.title && t.sections.length) tr[t.language] = v(t);
    out.push({ ok: true, warnings: [], item: { kind: 'term', id: `word:${id}`, url: ar.url, categories: ar.categories.map((c) => c.name), ar: v(ar), tr } });
  }
  return out;
}
