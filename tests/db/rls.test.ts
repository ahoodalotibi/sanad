/**
 * Row Level Security, exercised with the real Supabase API roles
 * (anon / authenticated + auth.uid()) against a fresh migrated database.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, expectPgError, hasTestDatabase, type TestDatabase } from '../helpers/db.ts';
import { seedFixtures, USERS, type Fixtures } from '../helpers/fixtures.ts';

describe.skipIf(!hasTestDatabase)('row level security', () => {
  let db: TestDatabase;
  let fx: Fixtures;
  let bobConversationId: string;
  let urHandoffId: string;
  let bnHandoffId: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    fx = await seedFixtures(db);
    ({ rows: [{ id: bobConversationId }] } = await db.query(
      `insert into public.conversations (user_id, language) values ($1, 'en') returning id`, [USERS.bob]));
    ({ rows: [{ id: urHandoffId }] } = await db.query(
      `insert into public.handoff_requests (question, language, reason, requester_user_id) values ('q-ur', 'ur', 'personal_fatwa', $1) returning id`, [USERS.bob]));
    ({ rows: [{ id: bnHandoffId }] } = await db.query(
      `insert into public.handoff_requests (question, language, reason) values ('q-bn', 'bn', 'personal_fatwa') returning id`));
  });
  afterAll(async () => db?.drop());

  describe('reference content (anon)', () => {
    it('shows only content from published documents', async () => {
      await db.asRole('anon', null, async (c) => {
        const ayahs = await c.query('select id from public.quran_ayahs');
        expect(ayahs.rows.map((r) => Number(r.id))).toEqual([fx.publishedAyahId]);
        const docs = await c.query('select id from public.documents');
        expect(docs.rows.map((r) => r.id)).toEqual([fx.publishedDocId]);
        const chunks = await c.query('select id from public.knowledge_chunks');
        expect(chunks.rows.map((r) => r.id)).toEqual([fx.publishedChunkId]);
        const terms = await c.query('select id from public.terms');
        expect(terms.rows.map((r) => r.id)).toEqual([fx.publishedTermId]);
      });
    });

    it('hides translations from editions that are still pending review', async () => {
      await db.asRole('anon', null, async (c) => {
        const { rows } = await c.query('select text from public.quran_translations');
        expect(rows.map((r) => r.text)).toEqual(['Test text one']);
      });
    });

    it('cannot write reference content', async () => {
      await db.asRole('anon', null, (c) =>
        expectPgError(c.query(`insert into public.sources (slug, name_ar, domain) values ('x', 'x', 'quran')`), '42501'));
      await db.asRole('authenticated', USERS.alice, (c) =>
        expectPgError(c.query(`update public.quran_ayahs set text_uthmani = 'x'`), '42501'));
    });

    it('cannot read private data at all', async () => {
      await db.asRole('anon', null, (c) => expectPgError(c.query('select * from public.conversations'), '42501'));
      await db.asRole('anon', null, (c) => expectPgError(c.query('select * from public.handoff_requests'), '42501'));
    });
  });

  describe('reviewers', () => {
    it('can read drafts that the public cannot', async () => {
      await db.asRole('authenticated', USERS.reviewer, async (c) => {
        const { rows } = await c.query('select id from public.documents order by created_at');
        expect(rows).toHaveLength(2);
      });
    });

    it('evaluation data is visible to reviewers only', async () => {
      await db.query(`insert into public.eval_test_cases (code, origin, title_ar, scenario_ar, expected_behavior_ar) values ('REF-01', 'reference_document', 't', 's', 'e')`);
      await db.asRole('authenticated', USERS.alice, async (c) => {
        expect((await c.query('select * from public.eval_test_cases')).rowCount).toBe(0);
      });
      await db.asRole('authenticated', USERS.reviewer, async (c) => {
        expect((await c.query('select * from public.eval_test_cases')).rowCount).toBe(1);
      });
    });
  });

  describe('conversations (owner only)', () => {
    it("a user cannot see another user's conversations or messages", async () => {
      await db.query(`insert into public.messages (conversation_id, role, content, language) values ($1, 'user', 'bob q', 'en')`, [bobConversationId]);
      await db.asRole('authenticated', USERS.alice, async (c) => {
        expect((await c.query('select * from public.conversations')).rowCount).toBe(0);
        expect((await c.query('select * from public.messages')).rowCount).toBe(0);
      });
      await db.asRole('authenticated', USERS.bob, async (c) => {
        expect((await c.query('select * from public.messages')).rowCount).toBe(1);
      });
    });

    it('a user can create only their own conversation and only user messages in it', async () => {
      await db.asRole('authenticated', USERS.alice, async (c) => {
        const { rows: [conv] } = await c.query(`insert into public.conversations (user_id, language) values ($1, 'en') returning id`, [USERS.alice]);
        await c.query(`insert into public.messages (conversation_id, role, content, language) values ($1, 'user', 'q', 'en')`, [conv.id]);
        await c.query('savepoint s');
        await expectPgError(
          c.query(`insert into public.messages (conversation_id, role, content, language) values ($1, 'assistant', 'fake answer', 'en')`, [conv.id]),
          '42501'
        );
        await c.query('rollback to savepoint s');
        await expectPgError(
          c.query(`insert into public.messages (conversation_id, role, content, language) values ($1, 'user', 'q', 'en')`, [bobConversationId]),
          '42501'
        );
      });
      await db.asRole('authenticated', USERS.alice, (c) =>
        expectPgError(c.query(`insert into public.conversations (user_id, language) values ($1, 'en')`, [USERS.bob]), '42501'));
    });
  });

  describe('specialist handoffs', () => {
    it('specialists see pending requests in their own languages only', async () => {
      await db.asRole('authenticated', USERS.specialistUr, async (c) => {
        const { rows } = await c.query('select id from public.handoff_requests');
        expect(rows.map((r) => r.id)).toEqual([urHandoffId]);
      });
      await db.asRole('authenticated', USERS.specialistBn, async (c) => {
        const { rows } = await c.query('select id from public.handoff_requests');
        expect(rows.map((r) => r.id)).toEqual([bnHandoffId]);
      });
    });

    it('the requester sees their own request; other users do not', async () => {
      await db.asRole('authenticated', USERS.bob, async (c) => {
        expect((await c.query('select id from public.handoff_requests')).rows.map((r) => r.id)).toEqual([urHandoffId]);
        expect((await c.query('select to_status from public.handoff_events')).rowCount).toBe(1);
      });
      await db.asRole('authenticated', USERS.alice, async (c) => {
        expect((await c.query('select id from public.handoff_requests')).rowCount).toBe(0);
      });
    });

    it('an assigned specialist may change only status and response', async () => {
      await db.query(`update public.handoff_requests set status = 'assigned', assigned_specialist_id = $2 where id = $1`, [urHandoffId, fx.specialistUrId]);

      await db.asRole('authenticated', USERS.specialistUr, async (c) => {
        await c.query('savepoint s');
        await expectPgError(c.query(`update public.handoff_requests set question = 'changed' where id = $1`, [urHandoffId]), '42501');
        await c.query('rollback to savepoint s');
        await expectPgError(c.query(`update public.handoff_requests set assigned_specialist_id = null where id = $1`, [urHandoffId]), '42501');
      });

      await db.asRole('authenticated', USERS.specialistUr, async (c) => {
        const res = await c.query(`update public.handoff_requests set status = 'answered', specialist_response = 'r' where id = $1`, [urHandoffId]);
        expect(res.rowCount).toBe(1);
      });

      // A specialist who is not assigned cannot touch the request.
      await db.asRole('authenticated', USERS.specialistBn, async (c) => {
        const res = await c.query(`update public.handoff_requests set status = 'closed' where id = $1`, [urHandoffId]);
        expect(res.rowCount).toBe(0);
      });
    });

    it('users may file only pending, unassigned requests for themselves', async () => {
      await db.asRole('authenticated', USERS.alice, async (c) => {
        await c.query(`insert into public.handoff_requests (question, language, reason, requester_user_id) values ('q', 'en', 'user_request', $1)`, [USERS.alice]);
        await c.query('savepoint s');
        await expectPgError(
          c.query(`insert into public.handoff_requests (question, language, reason, requester_user_id) values ('q', 'en', 'user_request', $1)`, [USERS.bob]),
          '42501'
        );
        await c.query('rollback to savepoint s');
        await expectPgError(
          c.query(`insert into public.handoff_requests (question, language, reason, requester_user_id, status, assigned_specialist_id) values ('q', 'en', 'user_request', $1, 'assigned', $2)`, [USERS.alice, fx.specialistUrId]),
          '42501'
        );
      });
    });
  });
});
