/**
 * SYNTHETIC TEST FIXTURES — NOT RELIGIOUS CONTENT.
 * Every text below is a placeholder ("نص تجريبي" = "test text") used only to
 * exercise constraints and RLS in throw-away test databases. Real Quran, hadith,
 * translations and terms are loaded later by the ingestion phase from the
 * approved references only.
 */
import type { TestDatabase } from './db.ts';

export const USERS = {
  alice: '00000000-0000-4000-8000-00000000000a',
  bob: '00000000-0000-4000-8000-00000000000b',
  specialistUr: '00000000-0000-4000-8000-0000000000c1',
  specialistBn: '00000000-0000-4000-8000-0000000000c2',
  reviewer: '00000000-0000-4000-8000-0000000000d1',
  admin: '00000000-0000-4000-8000-0000000000e1',
} as const;

export interface Fixtures {
  sourceId: string;
  publishedDocId: string;
  draftDocId: string;
  publishedAyahId: number;
  draftAyahId: number;
  approvedEnEditionId: string;
  pendingUrEditionId: string;
  hadithEditionId: string;
  collectionId: string;
  hadithId: string;
  publishedTermId: string;
  draftTermId: string;
  publishedChunkId: string;
  draftChunkId: string;
  specialistUrId: string;
  specialistBnId: string;
}

async function one<T = any>(db: TestDatabase, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query(sql, params);
  return rows[0] as T;
}

export async function seedFixtures(db: TestDatabase): Promise<Fixtures> {
  for (const id of Object.values(USERS)) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id.slice(-2)}@test.local`]);
  }
  await db.query(`insert into public.user_roles (user_id, role) values ($1, 'reviewer'), ($2, 'admin')`, [USERS.reviewer, USERS.admin]);

  const { id: sourceId } = await one(db, `
    insert into public.sources (slug, name_ar, domain) values ('test-source', 'مصدر تجريبي', 'quran') returning id`);

  const { id: publishedDocId } = await one(db, `
    insert into public.documents (source_id, title, language, publication_status, reviewed_at)
    values ($1, 'وثيقة تجريبية منشورة', 'ar', 'published', now()) returning id`, [sourceId]);
  const { id: draftDocId } = await one(db, `
    insert into public.documents (source_id, title, language) values ($1, 'وثيقة تجريبية مسودة', 'ar') returning id`, [sourceId]);

  await db.query(`insert into public.quran_surahs (number, name_ar, ayah_count) values (1, 'اسم تجريبي', 7)`);
  const { id: publishedAyahId } = await one(db, `
    insert into public.quran_ayahs (surah_number, ayah_number, global_number, text_uthmani, source_document_id)
    values (1, 1, 1, 'نَصٌّ تَجْرِيبِيٌّ أَوَّلُ', $1) returning id`, [publishedDocId]);
  const { id: draftAyahId } = await one(db, `
    insert into public.quran_ayahs (surah_number, ayah_number, global_number, text_uthmani, source_document_id)
    values (1, 2, 2, 'نَصٌّ تَجْرِيبِيٌّ ثَانٍ', $1) returning id`, [draftDocId]);

  const { id: approvedEnEditionId } = await one(db, `
    insert into public.translation_editions (slug, kind, language, name, source_id, approval_status, is_default)
    values ('test-en', 'quran', 'en', 'Test edition', $1, 'approved', true) returning id`, [sourceId]);
  const { id: pendingUrEditionId } = await one(db, `
    insert into public.translation_editions (slug, kind, language, name, source_id)
    values ('test-ur', 'quran', 'ur', 'Test edition ur', $1) returning id`, [sourceId]);
  const { id: hadithEditionId } = await one(db, `
    insert into public.translation_editions (slug, kind, language, name, source_id, approval_status)
    values ('test-hadith-en', 'hadith', 'en', 'Test hadith edition', $1, 'approximate') returning id`, [sourceId]);

  await db.query(`insert into public.quran_translations (ayah_id, edition_id, text) values ($1, $2, 'Test text one'), ($1, $3, 'Test text ur')`,
    [publishedAyahId, approvedEnEditionId, pendingUrEditionId]);

  const { id: collectionId } = await one(db, `
    insert into public.hadith_collections (slug, name_ar, source_id) values ('test-collection', 'مجموعة تجريبية', $1) returning id`, [sourceId]);
  const { id: hadithId } = await one(db, `
    insert into public.hadiths (collection_id, hadith_number, text_ar, grade, source_document_id)
    values ($1, '1', 'مَتْنٌ تَجْرِيبِيٌّ', 'unknown', $2) returning id`, [collectionId, publishedDocId]);

  const { id: publishedTermId } = await one(db, `
    insert into public.terms (slug, term_ar, usage_guideline_ar, source_id, publication_status)
    values ('test-term', 'مُصْطَلَحٌ تَجْرِيبِيٌّ', 'ضابط تجريبي', $1, 'published') returning id`, [sourceId]);
  const { id: draftTermId } = await one(db, `
    insert into public.terms (slug, term_ar, usage_guideline_ar, source_id) values ('test-term-draft', 'مصطلح مسودة', 'ضابط', $1) returning id`, [sourceId]);

  const { id: publishedChunkId } = await one(db, `
    insert into public.knowledge_chunks (document_id, chunk_index, language, content_type, content)
    values ($1, 0, 'ar', 'qa', 'مَقْطَعٌ تَجْرِيبِيٌّ مَنْشُورٌ') returning id`, [publishedDocId]);
  const { id: draftChunkId } = await one(db, `
    insert into public.knowledge_chunks (document_id, chunk_index, language, content_type, content)
    values ($1, 0, 'ar', 'qa', 'مقطع تجريبي مسودة') returning id`, [draftDocId]);

  const { id: specialistUrId } = await one(db, `
    insert into public.specialists (user_id, display_name) values ($1, 'Specialist UR') returning id`, [USERS.specialistUr]);
  const { id: specialistBnId } = await one(db, `
    insert into public.specialists (user_id, display_name) values ($1, 'Specialist BN') returning id`, [USERS.specialistBn]);
  await db.query(`insert into public.specialist_languages values ($1, 'ur'), ($2, 'bn')`, [specialistUrId, specialistBnId]);

  return {
    sourceId, publishedDocId, draftDocId, publishedAyahId: Number(publishedAyahId), draftAyahId: Number(draftAyahId),
    approvedEnEditionId, pendingUrEditionId, hadithEditionId, collectionId, hadithId,
    publishedTermId, draftTermId, publishedChunkId, draftChunkId, specialistUrId, specialistBnId,
  };
}
