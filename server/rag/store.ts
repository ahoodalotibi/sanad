/**
 * Retrieval store: everything the pipeline reads from the database.
 * The Supabase implementation calls public.match_chunks (published + active + non-test only)
 * and re-checks publication for every scripture row it returns, because the server uses
 * the service role (which bypasses RLS).
 */
import type { SanadDbClient } from '../db/client.ts';
import { DbError } from '../db/errors.ts';
import { toPgVector } from '../db/repositories/chunks.ts';
import type { ApprovalStatus, ContentLevel, HadithGrade, LanguageCode, SourceDomain } from '../db/types.ts';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  sourceId: string;
  sourceSlug: string;
  sourceNameAr: string;
  sourceNameEn: string | null;
  sourceDomain: SourceDomain;
  sourceUrl: string | null;
  documentTitle: string;
  documentUrl: string | null;
  language: string;
  contentType: string;
  heading: string | null;
  content: string;
  levelHint: ContentLevel | null;
  similarity: number;
  textRank: number;
  fusedScore: number;
}

export interface ScriptureRef {
  chunkId: string;
  kind: 'ayah' | 'hadith';
  /** original Arabic text exactly as stored */
  text: string;
  /** e.g. "Al-Baqarah 2:255" or "Sahih al-Bukhari #1" */
  label: string;
  translation: string | null;
  translationStatus: Extract<ApprovalStatus, 'approved' | 'approximate'> | null;
  translationEdition: string | null;
  grade: HadithGrade | null;
  gradeText: string | null;
}

export interface SearchParams {
  embedding: number[];
  queryText: string;
  embeddingModel: string;
  matchCount: number;
  domains: SourceDomain[] | null;
  includeTestData: boolean;
}

export interface RagStore {
  search(params: SearchParams): Promise<RetrievedChunk[]>;
  getScripture(chunkIds: string[], language: LanguageCode): Promise<ScriptureRef[]>;
}

export function createSupabaseRagStore(db: SanadDbClient): RagStore {
  return {
    async search(p) {
      const { data, error } = await db.rpc('match_chunks', {
        query_embedding: toPgVector(p.embedding),
        query_text: p.queryText,
        embedding_model: p.embeddingModel,
        match_count: p.matchCount,
        filter_domains: p.domains ?? undefined,
        include_test_data: p.includeTestData,
      });
      if (error) throw new DbError('rag.search', error);
      return (data ?? []).map((r) => ({
        id: r.chunk_id,
        documentId: r.document_id,
        sourceId: r.source_id,
        sourceSlug: r.source_slug,
        sourceNameAr: r.source_name_ar,
        sourceNameEn: r.source_name_en,
        sourceDomain: r.source_domain,
        sourceUrl: r.source_url,
        documentTitle: r.document_title,
        documentUrl: r.document_url,
        language: r.language,
        contentType: r.content_type,
        heading: r.heading,
        content: r.content,
        levelHint: r.content_level_hint,
        similarity: Number(r.vector_similarity) || 0,
        textRank: Number(r.text_rank) || 0,
        fusedScore: Number(r.fused_score) || 0,
      }));
    },

    async getScripture(chunkIds, language) {
      if (chunkIds.length === 0) return [];
      const refs = await must('rag.refs', db.from('chunk_references').select('chunk_id, ayah_id, hadith_id').in('chunk_id', chunkIds));
      const ayahIds = [...new Set(refs.flatMap((r) => (r.ayah_id ? [r.ayah_id] : [])))];
      const hadithIds = [...new Set(refs.flatMap((r) => (r.hadith_id ? [r.hadith_id] : [])))];

      const ayahs = ayahIds.length
        ? await must('rag.ayahs', db.from('quran_ayahs').select('id, surah_number, ayah_number, text_uthmani, source_document_id').in('id', ayahIds))
        : [];
      const hadiths = hadithIds.length
        ? await must(
            'rag.hadiths',
            db.from('hadiths').select('id, hadith_number, text_ar, grade, grade_text_ar, source_document_id, hadith_collections!inner(name_ar, name_en)').in('id', hadithIds)
          )
        : [];

      // Publication re-check (service role bypasses RLS).
      const docIds = [...new Set([...ayahs.map((a) => a.source_document_id), ...hadiths.map((h) => h.source_document_id)])];
      const published = new Set(
        docIds.length
          ? (await must('rag.docs', db.from('documents').select('id').in('id', docIds).eq('publication_status', 'published'))).map((d) => d.id)
          : []
      );

      const surahNumbers = [...new Set(ayahs.map((a) => a.surah_number))];
      const surahs = surahNumbers.length
        ? await must('rag.surahs', db.from('quran_surahs').select('number, name_ar, name_transliteration').in('number', surahNumbers))
        : [];
      const surahName = new Map(surahs.map((s) => [s.number, s.name_transliteration ?? s.name_ar]));

      const ayahTr = ayahIds.length
        ? await must(
            'rag.ayahTranslations',
            db
              .from('quran_translations')
              .select('ayah_id, text, translation_editions!inner(name, language, approval_status, is_default)')
              .in('ayah_id', ayahIds)
              .eq('translation_editions.language', language)
              .in('translation_editions.approval_status', ['approved', 'approximate'])
          )
        : [];
      const hadithTr = hadithIds.length
        ? await must(
            'rag.hadithTranslations',
            db
              .from('hadith_translations')
              .select('hadith_id, text, translation_editions!inner(name, language, approval_status, is_default)')
              .in('hadith_id', hadithIds)
              .eq('translation_editions.language', language)
              .in('translation_editions.approval_status', ['approved', 'approximate'])
          )
        : [];
      const pickTr = <K extends string>(rows: Array<Record<K, unknown> & { text: string; translation_editions: { name: string; approval_status: string; is_default: boolean } }>, key: K) => {
        const best = new Map<unknown, (typeof rows)[number]>();
        for (const r of rows) {
          const cur = best.get(r[key]);
          // approved beats approximate; the default edition beats others
          const rank = (x: typeof r) => (x.translation_editions.approval_status === 'approved' ? 2 : 0) + (x.translation_editions.is_default ? 1 : 0);
          if (!cur || rank(r) > rank(cur)) best.set(r[key], r);
        }
        return best;
      };
      const ayahTrBy = pickTr(ayahTr, 'ayah_id');
      const hadithTrBy = pickTr(hadithTr, 'hadith_id');

      const out: ScriptureRef[] = [];
      for (const ref of refs) {
        if (ref.ayah_id) {
          const a = ayahs.find((x) => x.id === ref.ayah_id);
          if (!a || !published.has(a.source_document_id)) continue;
          const tr = ayahTrBy.get(a.id);
          out.push({
            chunkId: ref.chunk_id,
            kind: 'ayah',
            text: a.text_uthmani,
            label: `${surahName.get(a.surah_number) ?? 'Surah'} ${a.surah_number}:${a.ayah_number}`,
            translation: tr?.text ?? null,
            translationStatus: (tr?.translation_editions.approval_status as ScriptureRef['translationStatus']) ?? null,
            translationEdition: tr?.translation_editions.name ?? null,
            grade: null,
            gradeText: null,
          });
        } else if (ref.hadith_id) {
          const h = hadiths.find((x) => x.id === ref.hadith_id);
          if (!h || !published.has(h.source_document_id)) continue;
          const tr = hadithTrBy.get(h.id);
          out.push({
            chunkId: ref.chunk_id,
            kind: 'hadith',
            text: h.text_ar,
            label: `${h.hadith_collections.name_en ?? h.hadith_collections.name_ar} #${h.hadith_number}`,
            translation: tr?.text ?? null,
            translationStatus: (tr?.translation_editions.approval_status as ScriptureRef['translationStatus']) ?? null,
            translationEdition: tr?.translation_editions.name ?? null,
            grade: h.grade,
            gradeText: h.grade_text_ar,
          });
        }
      }
      return out;
    },
  };
}

async function must<T>(op: string, query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new DbError(op, error);
  return data ?? [];
}
