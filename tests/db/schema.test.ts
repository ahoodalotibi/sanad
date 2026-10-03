/**
 * Schema integrity: constraints, foreign keys, generated columns, triggers.
 * Runs against a fresh database built from supabase/migrations (needs TEST_DATABASE_URL).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeArabic } from '../../server/db/normalize.ts';
import { createTestDatabase, expectPgError, hasTestDatabase, type TestDatabase } from '../helpers/db.ts';
import { seedFixtures, USERS, type Fixtures } from '../helpers/fixtures.ts';

describe.skipIf(!hasTestDatabase)('database schema', () => {
  let db: TestDatabase;
  let fx: Fixtures;

  beforeAll(async () => {
    db = await createTestDatabase();
    fx = await seedFixtures(db);
  });
  afterAll(async () => db?.drop());

  describe('security baseline', () => {
    it('enables RLS on every public table and gives each one at least one policy', async () => {
      const { rows } = await db.query<{ relname: string; rls: boolean; policies: number }>(`
        select c.relname, c.relrowsecurity as rls,
               (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'`);
      expect(rows).toHaveLength(28);
      expect(rows.filter((r) => !r.rls).map((r) => r.relname)).toEqual([]);
      expect(rows.filter((r) => r.policies === 0).map((r) => r.relname)).toEqual([]);
    });

    it('never grants write privileges to anon', async () => {
      const { rows } = await db.query(`
        select table_name, privilege_type from information_schema.role_table_grants
         where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'`);
      expect(rows).toEqual([]);
    });

    it('keeps helper functions out of the exposed public schema and pins their search_path', async () => {
      const { rows } = await db.query<{ proname: string; config: string[] | null }>(`
        select p.proname, p.proconfig as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private'`);
      expect(rows.length).toBeGreaterThan(5);
      for (const fn of rows) expect(fn.config, fn.proname).toContain('search_path=""');
      // The only public function is the server-side retrieval function, and browsers cannot call it.
      const exposed = await db.query<{ proname: string }>(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`);
      expect(exposed.rows.map((r) => r.proname)).toEqual(['match_chunks']);
      const { rows: [grants] } = await db.query(`
        select has_function_privilege('anon', 'public.match_chunks(extensions.vector, text, text, integer, public.source_domain[], boolean)', 'execute') as anon,
               has_function_privilege('authenticated', 'public.match_chunks(extensions.vector, text, text, integer, public.source_domain[], boolean)', 'execute') as authed,
               has_function_privilege('service_role', 'public.match_chunks(extensions.vector, text, text, integer, public.source_domain[], boolean)', 'execute') as service`);
      expect(grants).toEqual({ anon: false, authed: false, service: true });
    });
  });

  describe('Arabic normalisation', () => {
    const samples = [
      'مَكْتَبَةٌ كَبِيرَةٌ',
      'أَحْمَدُ وَإِبْرَاهِيمُ وَآدَمُ',
      'ٱلْكِتَابُ',
      'مُسْتَشْفَى',
      'سُؤَالٌ وَمَسْئُولٌ',
      'كتـــاب',
      '  كلمة \n  أخرى  ',
      'English text stays',
      '',
    ];

    it('SQL private.normalize_arabic() and TS normalizeArabic() agree exactly', async () => {
      for (const s of samples) {
        const { rows } = await db.query<{ n: string | null }>('select private.normalize_arabic($1) as n', [s]);
        expect(normalizeArabic(s), JSON.stringify(s)).toBe(rows[0].n);
      }
    });

    it('fills generated text_normalized columns', async () => {
      const { rows } = await db.query('select text_normalized from public.quran_ayahs where id = $1', [fx.publishedAyahId]);
      expect(rows[0].text_normalized).toBe('نص تجريبي اول');
    });
  });

  describe('provenance and integrity', () => {
    it('requires every ayah to reference a source document', async () => {
      await expectPgError(
        db.query(`insert into public.quran_ayahs (surah_number, ayah_number, global_number, text_uthmani) values (1, 3, 3, 'x')`),
        '23502'
      );
    });

    it('forbids deleting a source that still has documents', async () => {
      await expectPgError(db.query('delete from public.sources where id = $1', [fx.sourceId]), '23503');
    });

    it('rejects a Quran translation that points to a hadith edition', async () => {
      await expectPgError(
        db.query('insert into public.quran_translations (ayah_id, edition_id, text) values ($1, $2, $3)', [fx.publishedAyahId, fx.hadithEditionId, 'x']),
        '23503'
      );
    });

    it('rejects an ayah number outside 1..6236 and duplicate (surah, ayah)', async () => {
      await expectPgError(
        db.query(`insert into public.quran_ayahs (surah_number, ayah_number, global_number, text_uthmani, source_document_id) values (1, 9, 7000, 'x', $1)`, [fx.publishedDocId]),
        '23514'
      );
      await expectPgError(
        db.query(`insert into public.quran_ayahs (surah_number, ayah_number, global_number, text_uthmani, source_document_id) values (1, 1, 5, 'x', $1)`, [fx.publishedDocId]),
        '23505'
      );
    });

    it('does not allow an unreviewed edition to be the default', async () => {
      await expectPgError(
        db.query(`insert into public.translation_editions (slug, kind, language, name, source_id, is_default) values ('bad-default', 'quran', 'bn', 'x', $1, true)`, [fx.sourceId]),
        '23514'
      );
    });

    it('does not allow publishing a document without a review timestamp', async () => {
      await expectPgError(
        db.query(`update public.documents set publication_status = 'published', reviewed_at = null where id = $1`, [fx.draftDocId]),
        '23514'
      );
    });

    it('requires a chunk reference to point to exactly one target', async () => {
      await expectPgError(
        db.query('insert into public.chunk_references (chunk_id) values ($1)', [fx.publishedChunkId]),
        '23514'
      );
      await expectPgError(
        db.query('insert into public.chunk_references (chunk_id, ayah_id, term_id) values ($1, $2, $3)', [fx.publishedChunkId, fx.publishedAyahId, fx.publishedTermId]),
        '23514'
      );
      await db.query('insert into public.chunk_references (chunk_id, ayah_id) values ($1, $2)', [fx.publishedChunkId, fx.publishedAyahId]);
    });

    it('enforces 1536-dimension embeddings recorded together with their model', async () => {
      const vec = (n: number) => `[${Array.from({ length: n }, () => 0.01).join(',')}]`;
      await expectPgError(
        db.query(`update public.knowledge_chunks set embedding = $1, embedding_model = 'm', embedded_at = now() where id = $2`, [vec(3), fx.publishedChunkId]),
        '22000'
      );
      await expectPgError(
        db.query('update public.knowledge_chunks set embedding = $1 where id = $2', [vec(1536), fx.publishedChunkId]),
        '23514'
      );
      await db.query(`update public.knowledge_chunks set embedding = $1, embedding_model = 'test-model', embedded_at = now() where id = $2`, [vec(1536), fx.publishedChunkId]);
    });

    it('maintains a full-text vector over normalised content', async () => {
      const { rows } = await db.query(`select fts @@ plainto_tsquery('simple', 'مقطع') as hit from public.knowledge_chunks where id = $1`, [fx.publishedChunkId]);
      expect(rows[0].hit).toBe(true);
    });
  });

  describe('conversations and messages', () => {
    it('requires an owner (user or hashed anonymous session)', async () => {
      await expectPgError(db.query(`insert into public.conversations (language) values ('en')`), '23514');
      await expectPgError(
        db.query(`insert into public.conversations (language, anonymous_session_hash) values ('en', 'raw-session-id')`),
        '23514'
      );
    });

    it('keeps assistant-only fields off user messages and updates last_message_at', async () => {
      const { rows: [conv] } = await db.query(`insert into public.conversations (user_id, language) values ($1, 'en') returning id`, [USERS.alice]);
      await expectPgError(
        db.query(`insert into public.messages (conversation_id, role, content, language, content_level) values ($1, 'user', 'q', 'en', 'A')`, [conv.id]),
        '23514'
      );
      await expectPgError(
        db.query(`insert into public.messages (conversation_id, role, content, language, needs_handoff) values ($1, 'assistant', 'a', 'en', true)`, [conv.id]),
        '23514'
      );
      await db.query(`insert into public.messages (conversation_id, role, content, language) values ($1, 'user', 'q', 'en')`, [conv.id]);
      const { rows } = await db.query('select last_message_at from public.conversations where id = $1', [conv.id]);
      expect(rows[0].last_message_at).not.toBeNull();
    });
  });

  describe('handoff workflow', () => {
    it('generates reference codes, logs status changes and stamps timestamps', async () => {
      const { rows: [h] } = await db.query(`
        insert into public.handoff_requests (question, language, reason) values ('q', 'ur', 'personal_fatwa')
        returning id, reference_code`);
      expect(h.reference_code).toMatch(/^SND-\d{6}$/);

      await expectPgError(db.query(`update public.handoff_requests set status = 'assigned' where id = $1`, [h.id]), '23514');
      await db.query(`update public.handoff_requests set status = 'assigned', assigned_specialist_id = $2 where id = $1`, [h.id, fx.specialistUrId]);
      await expectPgError(db.query(`update public.handoff_requests set status = 'answered' where id = $1`, [h.id]), '23514');
      await db.query(`update public.handoff_requests set status = 'answered', specialist_response = 'r' where id = $1`, [h.id]);

      const { rows: events } = await db.query('select from_status, to_status from public.handoff_events where handoff_id = $1 order by id', [h.id]);
      expect(events).toEqual([
        { from_status: null, to_status: 'pending' },
        { from_status: 'pending', to_status: 'assigned' },
        { from_status: 'assigned', to_status: 'answered' },
      ]);
      const { rows: [after] } = await db.query('select assigned_at, resolved_at from public.handoff_requests where id = $1', [h.id]);
      expect(after.assigned_at).not.toBeNull();
      expect(after.resolved_at).not.toBeNull();
    });

    it('stores contact details only with explicit consent', async () => {
      await expectPgError(
        db.query(`insert into public.handoff_requests (question, language, reason, contact_channel, contact_value) values ('q', 'en', 'user_request', 'email', 'x@test.local')`),
        '23514'
      );
    });
  });

  describe('evaluation', () => {
    it('keeps case, prompt and language consistent and pass/fail coherent', async () => {
      const { rows: [c1] } = await db.query(`insert into public.eval_test_cases (code, origin, title_ar, scenario_ar, expected_behavior_ar) values ('REF-01', 'reference_document', 't', 's', 'e') returning id`);
      const { rows: [c2] } = await db.query(`insert into public.eval_test_cases (code, origin, title_ar, scenario_ar, expected_behavior_ar) values ('REF-02', 'reference_document', 't', 's', 'e') returning id`);
      const { rows: [p1] } = await db.query(`insert into public.eval_case_prompts (case_id, language, prompt) values ($1, 'en', 'p') returning id`, [c1.id]);
      const { rows: [run] } = await db.query(`insert into public.eval_runs default values returning id`);

      await expectPgError(
        db.query(`insert into public.eval_results (run_id, case_id, prompt_id, language, passed) values ($1, $2, $3, 'en', true)`, [run.id, c2.id, p1.id]),
        '23503'
      );
      await expectPgError(
        db.query(`insert into public.eval_results (run_id, case_id, prompt_id, language, passed) values ($1, $2, $3, 'ur', true)`, [run.id, c1.id, p1.id]),
        '23503'
      );
      await expectPgError(
        db.query(`insert into public.eval_results (run_id, case_id, prompt_id, language, passed, failures) values ($1, $2, $3, 'en', true, '{wrong level}')`, [run.id, c1.id, p1.id]),
        '23514'
      );
      await db.query(`insert into public.eval_results (run_id, case_id, prompt_id, language, passed, failures) values ($1, $2, $3, 'en', false, '{wrong level}')`, [run.id, c1.id, p1.id]);
    });
  });
});
