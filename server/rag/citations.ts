/**
 * Builds the traceable citations shown to the user from the sources the answer actually cited.
 * Everything here comes from the database (source, document, chunk, linked scripture) — never from the model.
 */
import type { Citation, SourceCategory } from '../../src/types/index.ts';
import type { SourceDomain } from '../db/types.ts';
import type { PromptSource } from './prompts.ts';

const CATEGORY: Record<SourceDomain, SourceCategory> = {
  quran: 'quran',
  tafseer: 'tafseer',
  hadith: 'hadith',
  aqeedah: 'aqeedah',
  fiqh: 'fiqh',
  seerah_history: 'seerah',
  shubuhat_faq: 'dawa_center',
  dawah_content: 'dawa_center',
  terminology: 'dictionary',
};

export function buildCitations(orderedKeys: string[], sources: PromptSource[]): Citation[] {
  return orderedKeys.map((key) => {
    const s = sources.find((x) => x.key === key);
    if (!s) throw new Error(`citation key ${key} has no source`); // unreachable after validateCitations
    const { chunk, scripture } = s;
    const scriptureLabels = scripture.map((x) => x.label);
    const hadith = scripture.find((x) => x.kind === 'hadith' && x.gradeText);
    return {
      sourceName: chunk.sourceNameEn ? `${chunk.sourceNameEn} (${chunk.sourceNameAr})` : chunk.sourceNameAr,
      sourceCategory: CATEGORY[chunk.sourceDomain],
      reference: [chunk.documentTitle, chunk.heading, ...scriptureLabels].filter(Boolean).join(' — '),
      hadithGrade: hadith?.gradeText ?? undefined,
      url: chunk.documentUrl ?? chunk.sourceUrl ?? undefined,
    };
  });
}
