/**
 * Repository layer, end to end: supabase-js → PostgREST → PostgreSQL (fresh migrated DB).
 * Needs TEST_DATABASE_URL and POSTGREST_BIN. All content is synthetic (see fixtures.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRepositories, createServiceClient, createUserClient, DbError, pingDatabase, type SanadRepositories } from '../../server/db/index.ts';
import type { SupabaseEnv } from '../../server/db/env.ts';
import { createTestDatabase, hasTestDatabase, type TestDatabase } from '../helpers/db.ts';
import { seedFixtures, USERS, type Fixtures } from '../helpers/fixtures.ts';
import { POSTGREST_BIN, startPostgrest, type TestApi } from '../helpers/postgrest.ts';

describe.skipIf(!hasTestDatabase || !POSTGREST_BIN)('repositories via PostgREST', () => {
  let db: TestDatabase;
  let api: TestApi;
  let fx: Fixtures;
  let config: SupabaseEnv;
  let repos: SanadRepositories;

  beforeAll(async () => {
    db = await createTestDatabase();
    fx = await seedFixtures(db);
    api = await startPostgrest(db);
    config = { url: api.url, secretKey: api.serviceKey, publishableKey: api.anonKey };
    repos = createRepositories(createServiceClient(config));
  });
  afterAll(async () => {
    await api?.stop();
    await db?.drop();
  });

  it('pings the database through the Data API', async () => {
    const health = await pingDatabase(createServiceClient(config));
    expect(health.ok).toBe(true);
  });

  describe('sources & documents', () => {
    it('upserts sources idempotently by slug', async () => {
      const row = { slug: 'test-source-2', name_ar: 'مصدر تجريبي ٢', domain: 'hadith' as const };
      const [first] = await repos.sources.upsert([row]);
      const [second] = await repos.sources.upsert([{ ...row, name_en: 'Test source 2' }]);
      expect(second.id).toBe(first.id);
      expect(second.name_en).toBe('Test source 2');
      expect((await repos.sources.list({ domain: 'hadith' })).map((s) => s.slug)).toContain('test-source-2');
    });

    it('creates documents, finds them by checksum and publishes them with a review stamp', async () => {
      const sha = 'a'.repeat(64);
      const doc = await repos.documents.create({ source_id: fx.sourceId, title: 'وثيقة', language: 'ar', content_sha256: sha });
      expect((await repos.documents.findByChecksum(sha))?.id).toBe(doc.id);
      const published = await repos.documents.setPublicationStatus(doc.id, 'published', USERS.reviewer);
      expect(published.publication_status).toBe('published');
      expect(published.reviewed_at).not.toBeNull();
    });
  });

  describe('quran', () => {
    it('reads ayahs by key, range and id', async () => {
      expect((await repos.quran.getAyah(1, 1))?.id).toBe(fx.publishedAyahId);
      expect(await repos.quran.getAyah(1, 99)).toBeNull();
      expect((await repos.quran.getAyahRange(1, 1, 2)).map((a) => a.ayah_number)).toEqual([1, 2]);
      expect(await repos.quran.getAyahsByIds([fx.draftAyahId])).toHaveLength(1);
      await expect(repos.quran.getAyahRange(1, 3, 2)).rejects.toThrow(RangeError);
    });

    it('returns only usable translations with their approval status', async () => {
      const en = await repos.quran.getTranslations([fx.publishedAyahId], 'en');
      expect(en).toEqual([
        {
          ayahId: fx.publishedAyahId,
          text: 'Test text one',
          edition: expect.objectContaining({ slug: 'test-en', approval_status: 'approved', language: 'en' }),
        },
      ]);
      expect(await repos.quran.getTranslations([fx.publishedAyahId], 'ur')).toEqual([]); // edition pending review
    });
  });

  describe('hadith & terminology', () => {
    it('looks up a hadith by collection slug and number', async () => {
      const h = await repos.hadith.getByNumber('test-collection', '1');
      expect(h?.id).toBe(fx.hadithId);
      expect(h?.hadith_collections.slug).toBe('test-collection');
      expect(await repos.hadith.getByNumber('test-collection', '999')).toBeNull();
    });

    it('stores hadith translations under an approximate edition and labels them', async () => {
      await repos.hadith.upsertTranslations([{ hadith_id: fx.hadithId, edition_id: fx.hadithEditionId, text: 'Approximate test rendering' }]);
      const [t] = await repos.hadith.getTranslations([fx.hadithId], 'en');
      expect(t.edition.approval_status).toBe('approximate');
    });

    it('finds terms by alias regardless of diacritics or case', async () => {
      await repos.terminology.upsertAliases([
        { term_id: fx.publishedTermId, language: 'ar', alias: 'مُصْطَلَحٌ' },
        { term_id: fx.publishedTermId, language: 'en', alias: 'TestTerm' },
      ]);
      expect(await repos.terminology.findTermIdsByAlias('مصطلح')).toEqual([fx.publishedTermId]);
      expect(await repos.terminology.findTermIdsByAlias('testterm')).toEqual([fx.publishedTermId]);
      expect(await repos.terminology.findTermIdsByAlias('unknown')).toEqual([]);
    });
  });

  describe('knowledge chunks', () => {
    it('upserts chunks with references and replaces stale references on re-ingestion', async () => {
      const chunk = { document_id: fx.publishedDocId, chunk_index: 5, language: 'ar', content_type: 'qa' as const, content: 'مقطع تجريبي' };
      const [saved] = await repos.chunks.upsertWithReferences([{ chunk, references: [{ ayah_id: fx.publishedAyahId }] }]);
      await repos.chunks.upsertWithReferences([{ chunk: { ...chunk, heading: 'h' }, references: [{ hadith_id: fx.hadithId }] }]);
      const refs = await repos.chunks.getReferences([saved.id]);
      expect(refs).toHaveLength(1);
      expect(refs[0].hadith_id).toBe(fx.hadithId);
    });

    it('stores embeddings and lists chunks still missing one', async () => {
      const before = await repos.chunks.listMissingEmbeddings();
      expect(before.map((c) => c.id)).toContain(fx.publishedChunkId);
      await repos.chunks.setEmbedding(fx.publishedChunkId, new Array(1536).fill(0.01), 'test-embedding-model');
      const after = await repos.chunks.listMissingEmbeddings();
      expect(after.map((c) => c.id)).not.toContain(fx.publishedChunkId);
      const [c] = await repos.chunks.getByIds([fx.publishedChunkId]);
      expect(c.embedding_model).toBe('test-embedding-model');
      expect(c).not.toHaveProperty('embedding');
    });
  });

  describe('conversations, messages & handoffs', () => {
    it('keeps anonymous conversations behind a session hash', async () => {
      const session = 'anon-session-0123456789abcdef';
      const conv = await repos.conversations.create({ anonymousSessionId: session, language: 'ur' });
      expect(conv.anonymous_session_hash).toMatch(/^[0-9a-f]{64}$/);
      expect((await repos.conversations.getForAnonymousSession(conv.id, session))?.id).toBe(conv.id);
      expect(await repos.conversations.getForAnonymousSession(conv.id, 'another-session-0123456789')).toBeNull();
    });

    it('saves an assistant message with its sources, and never without them', async () => {
      const conv = await repos.conversations.create({ userId: USERS.alice, language: 'en' });
      await repos.messages.addUserMessage({ conversationId: conv.id, content: 'test question', language: 'en' });
      const answer = await repos.messages.addAssistantMessage(
        conv.id,
        { content: 'test answer', language: 'en', content_level: 'A', confidence: 0.9, model: 'test' },
        [{ kind: 'cited', rank: 1, chunk_id: fx.publishedChunkId, ayah_id: fx.publishedAyahId }]
      );
      expect(await repos.messages.getSources(answer.id)).toHaveLength(1);

      await expect(
        repos.messages.addAssistantMessage(conv.id, { content: 'orphan', language: 'en' }, [
          { kind: 'cited', chunk_id: '00000000-0000-4000-8000-ffffffffffff' },
        ])
      ).rejects.toBeInstanceOf(DbError);
      const contents = (await repos.messages.listByConversation(conv.id)).map((m) => m.content);
      expect(contents).toEqual(['test question', 'test answer']);
    });

    it('runs a handoff from creation to answer with a full audit trail', async () => {
      const h = await repos.handoffs.create({
        question: 'test case question',
        language: 'ur',
        reason: 'personal_fatwa',
        consultedChunkIds: [fx.publishedChunkId, fx.publishedChunkId],
      });
      expect(h.reference_code).toMatch(/^SND-\d{6}$/);
      expect(await repos.handoffs.getConsultedChunkIds(h.id)).toEqual([fx.publishedChunkId]);
      expect((await repos.handoffs.listByStatus('pending', 'ur')).map((x) => x.id)).toContain(h.id);

      await repos.handoffs.assign(h.id, fx.specialistUrId);
      const done = await repos.handoffs.updateStatus(h.id, 'answered', 'test response');
      expect(done.resolved_at).not.toBeNull();
      expect((await repos.handoffs.getEvents(h.id)).map((e) => e.to_status)).toEqual(['pending', 'assigned', 'answered']);
      expect((await repos.handoffs.getByReference(h.reference_code))?.status).toBe('answered');
    });
  });

  describe('evaluations', () => {
    it('stores cases with prompts, runs and results', async () => {
      const c = await repos.evaluations.upsertCase(
        { code: 'EXT-001', origin: 'extended', title_ar: 'حالة تجريبية', scenario_ar: 's', expected_behavior_ar: 'e', expected_level: 'D', expect_handoff: true },
        [{ language: 'en', prompt: 'test prompt' }, { language: 'bn', prompt: 'test prompt bn' }]
      );
      expect(c.eval_case_prompts).toHaveLength(2);
      const again = await repos.evaluations.upsertCase({ code: 'EXT-001', origin: 'extended', title_ar: 'محدثة', scenario_ar: 's', expected_behavior_ar: 'e' }, [{ language: 'en', prompt: 'test prompt' }]);
      expect(again.id).toBe(c.id);

      const run = await repos.evaluations.startRun({ model: 'test-model', prompt_version: 'v0' });
      const prompt = c.eval_case_prompts.find((p) => p.language === 'en')!;
      await repos.evaluations.recordResult({ run_id: run.id, case_id: c.id, prompt_id: prompt.id, language: 'en', passed: false, failures: ['expected handoff'] });
      const finished = await repos.evaluations.finishRun(run.id, { passRate: 0 });
      expect(finished.finished_at).not.toBeNull();
      expect(await repos.evaluations.getResults(run.id)).toHaveLength(1);
      expect((await repos.evaluations.listActiveCases()).map((x) => x.code)).toContain('EXT-001');
    });
  });

  describe('user-scoped client (RLS through the API)', () => {
    it('sees published content only and only its own conversations', async () => {
      const alice = createRepositories(createUserClient(api.userToken(USERS.alice), config));
      expect(await repos.documents.getById(fx.draftDocId)).not.toBeNull(); // service client
      expect(await alice.documents.getById(fx.draftDocId)).toBeNull();     // user client
      const own = await alice.conversations.listForUser(USERS.alice);
      expect(own.length).toBeGreaterThan(0);
      expect(await alice.conversations.listForUser(USERS.bob)).toEqual([]);
    });

    it('cannot write reference content', async () => {
      const alice = createRepositories(createUserClient(api.userToken(USERS.alice), config));
      await expect(alice.sources.upsert([{ slug: 'evil', name_ar: 'x', domain: 'quran' }])).rejects.toMatchObject({ code: '42501' });
    });
  });
});
