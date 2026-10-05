/**
 * Maps extracted Al-Jamharah dictionary records onto the SANAD tables.
 *   one document per (entry, language)   external_ref "word:{id}" (Arabic) / "word:{id}:{lang}"
 *   one knowledge chunk per published section ("من معجم المصطلحات الشرعية", "من موسوعة …")
 *   terms             ← Arabic entries (draft)
 *   term_translations ← translated entries (pending_review), linked to the Arabic term
 * Content is copied from the extraction verbatim; the only addition is the entry title as the
 * first line of each chunk, so a definition is never separated from the term it defines.
 */
import { sha256 } from '../lib/fetcher.ts';
import { languageFromLabel, type IngestStore, type SourceRow } from '../lib/store.ts';
import type { DictionaryRecord } from '../jamharah-dictionary.ts';

export const DICTIONARY_SOURCE: SourceRow = {
  slug: 'jamharah-dictionary',
  name_ar: 'موسوعة الجمهرة - معجم المصطلحات الشرعية',
  name_en: 'Al-Jamharah — Dictionary of Islamic Terms',
  domain: 'terminology',
  base_url: 'https://islamic-content.com/dictionary',
  usage_rule_ar: 'يقدم على الترجمة التلقائية في المصطلحات الشرعية الحساسة.',
  reference_section: 'المرجعية والحزمة العلمية والبيانات، ص4 — الترجمة والمصطلحات',
  is_primary_reference: true,
};

const LICENSE = 'الجمهرة (مركز أصول): يحق الاستفادة العلمية في الاستخدام الشخصي غير التجاري — https://islamic-content.com/page/copyright';

export interface DictionaryLoadReport {
  documents: Record<string, number>;
  chunks: number;
  terms: number;
  termTranslations: number;
  languages: string[];
  skipped: Array<{ ref: string; reason: string }>;
}

export const externalRef = (r: Pick<DictionaryRecord, 'wordId' | 'language'>) => (r.language === 'ar' ? `word:${r.wordId}` : `word:${r.wordId}:${r.language}`);

export async function loadDictionary(records: DictionaryRecord[], store: IngestStore): Promise<DictionaryLoadReport> {
  const report: DictionaryLoadReport = { documents: {}, chunks: 0, terms: 0, termTranslations: 0, languages: [], skipped: [] };

  // Languages: Arabic plus every language discovered on the source, labelled as the source labels it
  const labels = new Map<string, string>([['ar', 'العربية Arabic']]);
  for (const r of records) for (const t of r.translations) if (!labels.has(t.language)) labels.set(t.language, t.label);
  for (const r of records) if (!labels.has(r.language)) labels.set(r.language, r.language);
  await store.ensureLanguages([...labels].map(([code, label]) => languageFromLabel(code, label)));
  report.languages = [...labels.keys()].sort();

  const sourceId = await store.upsertSource(DICTIONARY_SOURCE);
  const termIds = new Map<string, string>();
  // Arabic sections per entry, so a translated section can point at the exact Arabic sense it translates
  const arabicSections = new Map<string, string[]>();
  for (const r of records) if (r.language === 'ar') arabicSections.set(r.wordId, r.sections.map((s) => s.label));

  // Arabic first, so translations can link to their term
  const ordered = [...records].sort((a, b) => (a.language === 'ar' ? 0 : 1) - (b.language === 'ar' ? 0 : 1));
  for (const r of ordered) {
    const ref = externalRef(r);
    if (!r.title || r.sections.length === 0) {
      report.skipped.push({ ref, reason: 'no title or no published definition' });
      continue;
    }
    const heading = r.originalTitle ? `${r.title} (${r.originalTitle})` : r.title;
    const extracted = { url: r.url, title: r.title, originalTitle: r.originalTitle, sections: r.sections };
    const { id: documentId, action } = await store.upsertDocument({
      source_id: sourceId,
      title: heading,
      language: r.language,
      canonical_url: r.url,
      external_ref: ref,
      content_sha256: sha256(JSON.stringify(extracted)),
      license_note: LICENSE,
      metadata: {
        kind: 'dictionary_entry',
        word_id: r.wordId,
        translation_of: r.language === 'ar' ? null : `word:${r.wordId}`,
        original_title: r.originalTitle,
        categories: r.categories,
        raw_file: r.raw.file,
        raw_sha256: r.raw.sha256,
        fetched_at: r.fetchedAt,
      },
    });
    report.documents[action] = (report.documents[action] ?? 0) + 1;

    if (action === 'inserted' || action === 'updated') {
      const chunks = r.sections.map((s, i) => {
        // Each published section is its own sense/definition (with its own source and field); never merged.
        const arIndex = r.language === 'ar' ? -1 : (arabicSections.get(r.wordId) ?? []).indexOf(s.label);
        return {
          chunk_index: i,
          language: r.language,
          content_type: 'terminology' as const,
          heading,
          content: `${heading}\n${s.text}`,
          metadata: {
            section_label: s.label,
            references: s.references,
            word_id: r.wordId,
            categories: r.categories.map((c) => c.name),
            source_url: r.url,
            // translation → the Arabic section with the same published label (null if the Arabic page has none)
            translation_of_section: r.language === 'ar' ? null : arIndex >= 0 ? { external_ref: `word:${r.wordId}`, chunk_index: arIndex, section_label: s.label } : null,
          },
        };
      });
      await store.replaceChunks(documentId, chunks);
      report.chunks += chunks.length;
    }

    if (r.language === 'ar') {
      const res = await store.upsertTerm({ slug: `jamharah-${r.wordId}`, term_ar: r.title, definition_ar: r.sections[0].text, source_id: sourceId });
      if ('id' in res) {
        termIds.set(r.wordId, res.id);
        report.terms++;
      } else report.skipped.push({ ref, reason: res.conflict });
    } else {
      const termId = termIds.get(r.wordId);
      if (!termId) {
        report.skipped.push({ ref, reason: 'Arabic term not loaded, translation kept as a document only' });
        continue;
      }
      const res = await store.upsertTermTranslation({ term_id: termId, language: r.language, equivalent: r.title, usage_note: null, source_id: sourceId });
      if (res === 'ok') report.termTranslations++;
      else if (res !== 'exists') report.skipped.push({ ref, reason: res.conflict });
    }
  }
  return report;
}
