-- =============================================================================
-- SANAD | 10 — Row Level Security, grants and access helpers
-- =============================================================================
-- Access model
--   anon / authenticated  → read PUBLISHED reference content only
--   authenticated user    → own conversations, messages, handoff requests
--   active specialist     → handoffs in their languages; may update only
--                           status + specialist_response of assigned requests
--   reviewer / admin      → read drafts and evaluation data
--   service_role (server) → bypasses RLS; all writes to content tables go here
--
-- NOTE: Supabase grants ALL on new public tables to anon/authenticated by
-- default. This migration revokes that and grants explicitly, so a future
-- table is closed until a later migration opens it on purpose.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, empty search_path, in non-exposed schema)
-- -----------------------------------------------------------------------------
create or replace function private.has_role(required public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
     where user_id = (select auth.uid())
       and (role = required or role = 'admin')
  );
$$;

create or replace function private.current_specialist_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.specialists
   where user_id = (select auth.uid()) and is_active;
$$;

create or replace function private.specialist_handles_language(lang text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.specialists s
      join public.specialist_languages sl on sl.specialist_id = s.id
     where s.user_id = (select auth.uid()) and s.is_active and sl.language = lang
  );
$$;

create or replace function private.is_document_published(doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.documents where id = doc and publication_status = 'published');
$$;

create or replace function private.is_edition_usable(edition uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.translation_editions
     where id = edition and approval_status in ('approved', 'approximate')
  );
$$;

create or replace function private.is_chunk_visible(chunk uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.knowledge_chunks c
      join public.documents d on d.id = c.document_id
     where c.id = chunk and d.publication_status = 'published'
  );
$$;

create or replace function private.owns_conversation(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations
     where id = conv and user_id is not null and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_handoff(handoff uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.handoff_requests h
     where h.id = handoff
       and (
         h.requester_user_id = (select auth.uid())
         or h.assigned_specialist_id = private.current_specialist_id()
         or (h.status = 'pending' and private.specialist_handles_language(h.language))
         or private.has_role('admin')
       )
  );
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.languages                 enable row level security;
alter table public.sources                   enable row level security;
alter table public.documents                 enable row level security;
alter table public.quran_surahs              enable row level security;
alter table public.quran_ayahs               enable row level security;
alter table public.translation_editions      enable row level security;
alter table public.quran_translations        enable row level security;
alter table public.hadith_collections        enable row level security;
alter table public.hadiths                   enable row level security;
alter table public.hadith_translations       enable row level security;
alter table public.terms                     enable row level security;
alter table public.term_translations         enable row level security;
alter table public.term_aliases              enable row level security;
alter table public.knowledge_chunks          enable row level security;
alter table public.chunk_references          enable row level security;
alter table public.user_roles                enable row level security;
alter table public.specialists               enable row level security;
alter table public.specialist_languages      enable row level security;
alter table public.conversations             enable row level security;
alter table public.messages                  enable row level security;
alter table public.message_sources           enable row level security;
alter table public.handoff_requests          enable row level security;
alter table public.handoff_consulted_sources enable row level security;
alter table public.handoff_events            enable row level security;
alter table public.eval_test_cases           enable row level security;
alter table public.eval_case_prompts         enable row level security;
alter table public.eval_runs                 enable row level security;
alter table public.eval_results              enable row level security;

-- -----------------------------------------------------------------------------
-- Table privileges (RLS still filters rows on top of these)
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Public reference content: read-only
grant select on
  public.languages, public.sources, public.documents,
  public.quran_surahs, public.quran_ayahs, public.translation_editions, public.quran_translations,
  public.hadith_collections, public.hadiths, public.hadith_translations,
  public.terms, public.term_translations, public.term_aliases,
  public.knowledge_chunks, public.chunk_references
to anon, authenticated;

-- Signed-in users
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert                 on public.messages      to authenticated;
grant select                         on public.message_sources, public.user_roles,
                                        public.specialists, public.specialist_languages,
                                        public.handoff_consulted_sources, public.handoff_events,
                                        public.eval_test_cases, public.eval_case_prompts,
                                        public.eval_runs, public.eval_results
                                     to authenticated;
grant select, insert on public.handoff_requests to authenticated;
-- Column-level: a specialist can only change the workflow fields
grant update (status, specialist_response) on public.handoff_requests to authenticated;
grant usage on sequence public.handoff_reference_seq to authenticated;

-- -----------------------------------------------------------------------------
-- Policies: reference content
-- -----------------------------------------------------------------------------
create policy "languages are public"
  on public.languages for select to anon, authenticated using (true);

create policy "active sources are public"
  on public.sources for select to anon, authenticated
  using (is_active or private.has_role('reviewer'));

create policy "published documents are public"
  on public.documents for select to anon, authenticated
  using (publication_status = 'published' or private.has_role('reviewer'));

create policy "surahs are public"
  on public.quran_surahs for select to anon, authenticated using (true);

create policy "ayahs from published documents are public"
  on public.quran_ayahs for select to anon, authenticated
  using (private.is_document_published(source_document_id) or private.has_role('reviewer'));

create policy "usable translation editions are public"
  on public.translation_editions for select to anon, authenticated
  using (approval_status in ('approved', 'approximate') or private.has_role('reviewer'));

create policy "quran translations of usable editions are public"
  on public.quran_translations for select to anon, authenticated
  using (private.is_edition_usable(edition_id) or private.has_role('reviewer'));

create policy "hadith collections are public"
  on public.hadith_collections for select to anon, authenticated using (true);

create policy "hadiths from published documents are public"
  on public.hadiths for select to anon, authenticated
  using (private.is_document_published(source_document_id) or private.has_role('reviewer'));

create policy "hadith translations of usable editions are public"
  on public.hadith_translations for select to anon, authenticated
  using (private.is_edition_usable(edition_id) or private.has_role('reviewer'));

create policy "published terms are public"
  on public.terms for select to anon, authenticated
  using (publication_status = 'published' or private.has_role('reviewer'));

create policy "usable term translations are public"
  on public.term_translations for select to anon, authenticated
  using (
    (approval_status in ('approved', 'approximate')
      and exists (select 1 from public.terms t where t.id = term_id and t.publication_status = 'published'))
    or private.has_role('reviewer')
  );

create policy "aliases of published terms are public"
  on public.term_aliases for select to anon, authenticated
  using (
    exists (select 1 from public.terms t where t.id = term_id and t.publication_status = 'published')
    or private.has_role('reviewer')
  );

create policy "chunks from published documents are public"
  on public.knowledge_chunks for select to anon, authenticated
  using (private.is_document_published(document_id) or private.has_role('reviewer'));

create policy "references of visible chunks are public"
  on public.chunk_references for select to anon, authenticated
  using (private.is_chunk_visible(chunk_id) or private.has_role('reviewer'));

-- -----------------------------------------------------------------------------
-- Policies: staff
-- -----------------------------------------------------------------------------
create policy "users see their own roles; admins see all"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('admin'));

create policy "specialists see themselves; admins see all"
  on public.specialists for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('admin'));

create policy "specialist languages follow specialist visibility"
  on public.specialist_languages for select to authenticated
  using (specialist_id = private.current_specialist_id() or private.has_role('admin'));

-- -----------------------------------------------------------------------------
-- Policies: conversations & messages (owner only; anonymous traffic goes through the server)
-- -----------------------------------------------------------------------------
create policy "owners read their conversations"
  on public.conversations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "owners create their conversations"
  on public.conversations for insert to authenticated
  with check (user_id = (select auth.uid()) and anonymous_session_hash is null);

create policy "owners update their conversations"
  on public.conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "owners delete their conversations"
  on public.conversations for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "owners read their messages"
  on public.messages for select to authenticated
  using (private.owns_conversation(conversation_id));

-- Users may only write their own *user* messages. Assistant messages come from the server.
create policy "owners add user messages"
  on public.messages for insert to authenticated
  with check (role = 'user' and private.owns_conversation(conversation_id));

create policy "owners read sources of their messages"
  on public.message_sources for select to authenticated
  using (exists (
    select 1 from public.messages m
     where m.id = message_id and private.owns_conversation(m.conversation_id)
  ));

-- -----------------------------------------------------------------------------
-- Policies: handoffs
-- -----------------------------------------------------------------------------
create policy "handoffs visible to requester, specialists and admins"
  on public.handoff_requests for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or assigned_specialist_id = private.current_specialist_id()
    or (status = 'pending' and private.specialist_handles_language(language))
    or private.has_role('admin')
  );

create policy "users create their own pending handoffs"
  on public.handoff_requests for insert to authenticated
  with check (
    requester_user_id = (select auth.uid())
    and status = 'pending'
    and assigned_specialist_id is null
    and specialist_response is null
    and (conversation_id is null or private.owns_conversation(conversation_id))
  );

-- Column grants above limit WHAT can change; this limits WHICH rows.
create policy "assigned specialists and admins update handoffs"
  on public.handoff_requests for update to authenticated
  using (assigned_specialist_id = private.current_specialist_id() or private.has_role('admin'))
  with check (assigned_specialist_id = private.current_specialist_id() or private.has_role('admin'));

create policy "consulted sources follow handoff visibility"
  on public.handoff_consulted_sources for select to authenticated
  using (private.can_view_handoff(handoff_id));

create policy "handoff events follow handoff visibility"
  on public.handoff_events for select to authenticated
  using (private.can_view_handoff(handoff_id));

-- -----------------------------------------------------------------------------
-- Policies: evaluation (reviewers and admins)
-- -----------------------------------------------------------------------------
create policy "reviewers read test cases"   on public.eval_test_cases   for select to authenticated using (private.has_role('reviewer'));
create policy "reviewers read case prompts" on public.eval_case_prompts for select to authenticated using (private.has_role('reviewer'));
create policy "reviewers read eval runs"    on public.eval_runs         for select to authenticated using (private.has_role('reviewer'));
create policy "reviewers read eval results" on public.eval_results      for select to authenticated using (private.has_role('reviewer'));
