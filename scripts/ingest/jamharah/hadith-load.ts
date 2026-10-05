/**
 * Maps «معجم السنة النبوية» records onto the SANAD tables:
 *   documents          one per page (Arabic hadith, and each translation)   external_ref "t:{id}"
 *   hadiths            the Arabic text with grade, takhrij and the page as source document
 *   translation_editions + hadith_translations   one edition per language (pending_review)
 *   knowledge_chunks   hadith text (+ grade line) and «شرح الحديث», each linked to the hadith
 *                      through chunk_references, so the answer shows the hadith from the hadith
 *                      tables — the model never writes it.
 * A hadith without a published grade is still stored but marked grade "unknown"; the publication
 * check keeps it out of answers.
 */
import { sha256 } from '../lib/fetcher.ts';
import { languageFromLabel, type ChunkInput, type IngestStore, type SourceRow } from '../lib/store.ts';
import { gradeEnum, LANGUAGE_NAMES_AR } from './hadith-parse.ts';
import type { HadithRecord } from '../jamharah-hadith.ts';

export const SUNNAH_SOURCE: SourceRow = {
  slug: 'jamharah-sunnah',
  name_ar: 'موسوعة الجمهرة - معجم السنة النبوية',
  name_en: 'Al-Jamharah — Dictionary of the Prophetic Sunnah',
  domain: 'hadith',
  base_url: 'https://islamic-content.com/hadeeths',
  usage_rule_ar: 'لا ينسب حديث دون مصدر وحكم معتمد في البيانات.',
  reference_section: 'المرجعية والحزمة العلمية والبيانات، ص3 (الحديث النبوي) وص4 (موسوعة الجمهرة)',
  is_primary_reference: true,
};

const LICENSE = 'الجمهرة (مركز أصول): يحق الاستفادة العلمية في الاستخدام الشخصي غير التجاري — https://islamic-content.com/page/copyright';
const NAME_BY_CODE = Object.fromEntries(Object.entries(LANGUAGE_NAMES_AR).map(([name, code]) => [code, name]));

export interface HadithLoadReport {
  documents: Record<string, number>;
  chunks: number;
  hadiths: number;
  translations: number;
  languages: string[];
  skipped: Array<{ ref: string; reason: string }>;
}

export function hadithChunks(r: HadithRecord): ChunkInput[] {
  const meta = { hadith_page_id: r.sourceHadithId, source_url: r.url, topics: r.topics };
  const chunks: ChunkInput[] = [{ chunk_index: 0, language: r.language, content_type: 'hadith_text', heading: r.title, content: [r.text, r.gradeLine].filter(Boolean).join('\n'), metadata: { ...meta, part: 'text' } }];
  if (r.explanation) chunks.push({ chunk_index: 1, language: r.language, content_type: 'hadith_explanation', heading: r.title, content: `${r.text}\n${r.explanation}`, metadata: { ...meta, part: 'explanation' } });
  return chunks;
}

export async function loadHadith(records: HadithRecord[], store: IngestStore): Promise<HadithLoadReport> {
  const report: HadithLoadReport = { documents: {}, chunks: 0, hadiths: 0, translations: 0, languages: [], skipped: [] };
  const langs = [...new Set(['ar', ...records.map((r) => r.language)])].sort();
  await store.ensureLanguages(langs.map((code) => languageFromLabel(code, `${NAME_BY_CODE[code] ?? code} ${code}`)));
  report.languages = langs;
  const sourceId = await store.upsertSource(SUNNAH_SOURCE);
  const collectionId = await store.upsertHadithCollection({ slug: 'jamharah-sunnah', name_ar: 'معجم السنة النبوية — الجمهرة', name_en: 'Al-Jamharah Sunnah Dictionary', source_id: sourceId, is_canonical_sahih: false });

  const hadithIds = new Map<string, string>();
  const ordered = [...records].sort((a, b) => (a.language === 'ar' ? 0 : 1) - (b.language === 'ar' ? 0 : 1));
  for (const r of ordered) {
    const ref = `t:${r.id}`;
    if (!r.text) {
      report.skipped.push({ ref, reason: 'no hadith text' });
      continue;
    }
    const { id: documentId, action } = await store.upsertDocument({
      source_id: sourceId,
      title: r.title ?? r.text.slice(0, 80),
      language: r.language,
      canonical_url: r.url,
      external_ref: ref,
      content_sha256: sha256(JSON.stringify([r.url, r.text, r.gradeLine, r.explanation, r.wordMeanings, r.benefits])),
      license_note: LICENSE,
      metadata: {
        kind: 'hadith',
        hadith_page_id: r.sourceHadithId,
        translation_of: r.language === 'ar' ? null : `t:${r.sourceHadithId}`,
        grade_line: r.gradeLine,
        word_meanings: r.wordMeanings,
        benefits: r.benefits,
        references: r.references,
        related_topics: r.relatedTopics,
        topics: r.topics,
        raw_file: r.raw.file,
        raw_sha256: r.raw.sha256,
        fetched_at: r.fetchedAt,
      },
    });
    report.documents[action] = (report.documents[action] ?? 0) + 1;

    let hadithId: string | undefined;
    if (r.language === 'ar') {
      hadithId = await store.upsertHadith({
        collection_id: collectionId,
        hadith_number: r.id,
        sort_key: Number(r.id) || null,
        text_ar: r.text,
        grade: gradeEnum(r.grade),
        grade_text_ar: r.grade,
        graded_by: null,
        takhrij_ar: r.takhrij,
        external_ref: r.url,
        source_document_id: documentId,
      });
      hadithIds.set(r.id, hadithId);
      report.hadiths++;
    } else {
      hadithId = hadithIds.get(r.sourceHadithId);
      if (!hadithId) {
        report.skipped.push({ ref, reason: 'Arabic hadith not loaded; translation kept as a document only' });
      } else {
        const editionId = await store.upsertTranslationEdition({
          slug: `jamharah-sunnah-${r.language.toLowerCase()}`,
          kind: 'hadith',
          language: r.language,
          name: `ترجمة معجم السنة النبوية (الجمهرة) — ${NAME_BY_CODE[r.language] ?? r.language}`,
          translator: null,
          publisher: 'مركز أصول — الجمهرة',
          source_id: sourceId,
          notes: 'Human translation published on islamic-content.com; approval pending review.',
        });
        await store.upsertHadithTranslation({ hadith_id: hadithId, edition_id: editionId, text: r.text });
        report.translations++;
      }
    }

    if (action === 'inserted' || action === 'updated') {
      const chunks = hadithChunks(r);
      const chunkIds = await store.replaceChunks(documentId, chunks);
      report.chunks += chunks.length;
      if (hadithId) for (const c of chunkIds) await store.linkChunkToHadith(c, hadithId);
    }
  }
  return report;
}
