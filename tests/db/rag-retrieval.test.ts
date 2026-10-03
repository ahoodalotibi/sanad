/**
 * RAG retrieval against a real database through PostgREST (supabase-js → match_chunks).
 * Needs TEST_DATABASE_URL and POSTGREST_BIN.
 *
 * SYNTHETIC TEST DATA ONLY: every document below is flagged metadata.test_data = true and
 * every text is a neutral placeholder ("lantern protocol") — no religious content.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '../../server/db/client.ts';
import { toPgVector } from '../../server/db/repositories/chunks.ts';
import { DEFAULT_RAG_SETTINGS } from '../../server/rag/config.ts';
import { answerQuestion } from '../../server/rag/pipeline.ts';
import { createSupabaseRagStore, type RagStore } from '../../server/rag/store.ts';
import { createTestDatabase, hasTestDatabase, type TestDatabase } from '../helpers/db.ts';
import { FakeAi, hashEmbed, TEST_EMBEDDING_MODEL } from '../helpers/fakeAi.ts';
import { seedFixtures, type Fixtures } from '../helpers/fixtures.ts';
import { POSTGREST_BIN, startPostgrest, type TestApi } from '../helpers/postgrest.ts';

interface Ids {
  published: string;
  publishedUr: string;
  publishedBn: string;
  draft: string;
  inactive: string;
  otherModel: string;
  hadithChunk: string;
  quranChunk: string;
  draftScriptureChunk: string;
  untagged: string;
}

async function seedRagFixtures(db: TestDatabase, fx: Fixtures): Promise<Ids> {
  const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];
  const TEST = { test_data: true, note: 'SYNTHETIC TEST FIXTURE — not religious content' };

  const activeAq = (await one(`insert into public.sources (slug, name_ar, name_en, domain, base_url) values ('test-rag-aqeedah', 'مصدر اختبار', 'TEST aqeedah source', 'aqeedah', 'https://example.test') returning id`)).id;
  const activeHadith = (await one(`insert into public.sources (slug, name_ar, name_en, domain) values ('test-rag-hadith', 'مصدر حديث اختبار', 'TEST hadith source', 'hadith') returning id`)).id;
  const activeQuran = (await one(`insert into public.sources (slug, name_ar, name_en, domain) values ('test-rag-quran', 'مصدر قرآن اختبار', 'TEST quran source', 'quran') returning id`)).id;
  const inactiveSrc = (await one(`insert into public.sources (slug, name_ar, domain, is_active) values ('test-rag-inactive', 'مصدر معطل', 'aqeedah', false) returning id`)).id;

  const doc = async (source: string, status: 'published' | 'draft', metadata: object = TEST) =>
    (await one(
      `insert into public.documents (source_id, title, language, canonical_url, publication_status, reviewed_at, metadata)
       values ($1, 'TEST document', 'en', 'https://example.test/doc', $2::public.publication_status, case when $2::text = 'published' then now() end, $3) returning id`,
      [source, status, JSON.stringify(metadata)]
    )).id;

  const pubDoc = await doc(activeAq, 'published');
  const draftDoc = await doc(activeAq, 'draft');
  const inactiveDoc = await doc(inactiveSrc, 'published');
  const hadithDoc = await doc(activeHadith, 'published');
  const quranDoc = await doc(activeQuran, 'published');
  const untaggedDoc = await doc(activeAq, 'published', { note: 'SYNTHETIC TEST FIXTURE without the test_data flag' });

  let idx = 0;
  const chunk = async (document: string, content: string, language = 'en', model = TEST_EMBEDDING_MODEL) =>
    (await one(
      `insert into public.knowledge_chunks (document_id, chunk_index, language, content_type, content, embedding, embedding_model, embedded_at)
       values ($1, $2, $3, 'qa', $4, $5, $6, now()) returning id`,
      [document, idx++, language, content, toPgVector(hashEmbed(content)), model]
    )).id;

  const ids: Ids = {
    published: await chunk(pubDoc, 'TEST DATA. The lantern protocol requires every lantern to be checked twice before sunset.'),
    publishedUr: await chunk(pubDoc, 'ٹیسٹ ڈیٹا۔ لالٹین پروٹوکول کے مطابق ہر لالٹین کو غروب سے پہلے دو بار چیک کیا جائے۔', 'ur'),
    publishedBn: await chunk(pubDoc, 'পরীক্ষামূলক তথ্য। লণ্ঠন প্রোটোকল অনুযায়ী প্রতিটি লণ্ঠন সূর্যাস্তের আগে দুবার পরীক্ষা করতে হবে।', 'bn'),
    draft: await chunk(draftDoc, 'TEST DATA. Secret draft: the lantern protocol requires every lantern to be checked twice before sunset.'),
    inactive: await chunk(inactiveDoc, 'TEST DATA. Inactive source: the lantern protocol requires every lantern to be checked twice before sunset.'),
    otherModel: await chunk(pubDoc, 'TEST DATA. Other model: the lantern protocol requires every lantern to be checked twice before sunset.', 'en', 'some-other-model'),
    hadithChunk: await chunk(hadithDoc, 'TEST DATA hadith-domain passage about counting lanterns.'),
    quranChunk: await chunk(quranDoc, 'TEST DATA quran-domain passage about lantern light.'),
    draftScriptureChunk: await chunk(pubDoc, 'TEST DATA passage linked to unpublished scripture about lantern oil.'),
    untagged: await chunk(untaggedDoc, 'TEST DATA untagged passage about the lantern protocol checked twice before sunset.'),
  };

  // Synthetic linked "scripture" rows (placeholder text) to exercise the scripture path.
  const sahih = (await one(
    `insert into public.hadiths (collection_id, hadith_number, text_ar, grade, grade_text_ar, source_document_id) values ($1, 'T-2', 'متن اختبار تجريبي', 'sahih', 'صحيح (اختبار)', $2) returning id`,
    [fx.collectionId, fx.publishedDocId]
  )).id;
  await db.query('insert into public.chunk_references (chunk_id, hadith_id) values ($1, $2)', [ids.hadithChunk, sahih]);
  await db.query('insert into public.chunk_references (chunk_id, ayah_id) values ($1, $2)', [ids.quranChunk, fx.publishedAyahId]);
  await db.query('insert into public.chunk_references (chunk_id, ayah_id) values ($1, $2)', [ids.draftScriptureChunk, fx.draftAyahId]);
  return ids;
}

describe.skipIf(!hasTestDatabase || !POSTGREST_BIN)('RAG retrieval (database)', () => {
  let db: TestDatabase;
  let api: TestApi;
  let ids: Ids;
  let store: RagStore;

  beforeAll(async () => {
    db = await createTestDatabase();
    const fx = await seedFixtures(db);
    ids = await seedRagFixtures(db, fx);
    api = await startPostgrest(db);
    store = createSupabaseRagStore(createServiceClient({ url: api.url, secretKey: api.serviceKey, publishableKey: api.anonKey }));
  });
  afterAll(async () => {
    await api?.stop();
    await db?.drop();
  });

  const search = (text: string, extra: Partial<Parameters<RagStore['search']>[0]> = {}) =>
    store.search({ embedding: hashEmbed(text), queryText: text, embeddingModel: TEST_EMBEDDING_MODEL, matchCount: 20, domains: null, includeTestData: true, ...extra });

  it('retrieves the most similar published chunk first, with similarity scores', async () => {
    const results = await search('Does the lantern protocol require lanterns to be checked twice before sunset?');
    expect(results[0].id).toBe(ids.published);
    expect(results[0].similarity).toBeGreaterThan(0.5);
    expect(results[0]).toMatchObject({ sourceSlug: 'test-rag-aqeedah', sourceDomain: 'aqeedah', documentUrl: 'https://example.test/doc' });
  });

  it('never returns chunks from unpublished documents, inactive sources, or other embedding models', async () => {
    const returned = (await search('Secret draft inactive source other model lantern protocol checked twice before sunset')).map((r) => r.id);
    expect(returned).toContain(ids.published);
    expect(returned).not.toContain(ids.draft);
    expect(returned).not.toContain(ids.inactive);
    expect(returned).not.toContain(ids.otherModel);
  });

  it('hides synthetic test data unless explicitly included', async () => {
    const returned = (await search('lantern protocol checked twice before sunset', { includeTestData: false })).map((r) => r.id);
    expect(returned).toEqual([ids.untagged]); // only the fixture without the test_data flag
  });

  it('filters by source domain', async () => {
    const returned = await search('counting lanterns', { domains: ['hadith'] });
    expect(returned.map((r) => r.sourceDomain)).toEqual(['hadith']);
  });

  it('finds Urdu and Bengali passages with Urdu and Bengali questions', async () => {
    expect((await search('لالٹین پروٹوکول چیک'))[0].id).toBe(ids.publishedUr);
    expect((await search('লণ্ঠন প্রোটোকল পরীক্ষা'))[0].id).toBe(ids.publishedBn);
  });

  it('returns linked scripture only from published documents, with approved translations and grades', async () => {
    const refs = await store.getScripture([ids.quranChunk, ids.hadithChunk, ids.draftScriptureChunk], 'en');
    expect(refs.map((r) => r.chunkId).sort()).toEqual([ids.hadithChunk, ids.quranChunk].sort());
    const ayah = refs.find((r) => r.kind === 'ayah')!;
    expect(ayah).toMatchObject({ text: 'نَصٌّ تَجْرِيبِيٌّ أَوَّلُ', label: 'اسم تجريبي 1:1', translation: 'Test text one', translationStatus: 'approved' });
    expect(refs.find((r) => r.kind === 'hadith')).toMatchObject({ grade: 'sahih', gradeText: 'صحيح (اختبار)' });
    // the Urdu edition is pending review → no translation offered
    expect((await store.getScripture([ids.quranChunk], 'ur'))[0].translation).toBeNull();
  });

  it('cannot be called from the browser (anon key)', async () => {
    const anon = createClient(api.url, api.anonKey);
    const { error } = await anon.rpc('match_chunks', {
      query_embedding: toPgVector(hashEmbed('x')),
      query_text: 'x',
      embedding_model: TEST_EMBEDDING_MODEL,
    });
    expect(error?.code).toBe('42501');
  });

  it('end to end: answers with citations built from the database', async () => {
    const ai = new FakeAi();
    const { response, trace } = await answerQuestion(
      { question: 'Does the lantern protocol require lanterns to be checked twice before sunset?', uiLanguage: 'en' },
      { ai, store, settings: { ...DEFAULT_RAG_SETTINGS, minConfidence: 0.5 }, includeTestData: true }
    );
    expect(trace.outcome).toBe('answer');
    expect(trace.contextIds).not.toContain(ids.draft);
    expect(response.citations[0]).toMatchObject({ sourceName: 'TEST aqeedah source (مصدر اختبار)', url: 'https://example.test/doc' });
  });

  it('end to end: refuses when nothing relevant is published', async () => {
    const ai = new FakeAi();
    const { response, trace } = await answerQuestion(
      { question: 'What colour are the secret draft lanterns?', uiLanguage: 'en' },
      { ai, store, settings: { ...DEFAULT_RAG_SETTINGS, minConfidence: 0.7 }, includeTestData: true }
    );
    expect(trace.outcome).toBe('no_reliable_answer');
    expect(response.citations).toEqual([]);
    expect(ai.answerRequests()).toHaveLength(0);
  });
});
