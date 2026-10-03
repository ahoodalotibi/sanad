-- =============================================================================
-- SANAD | 07 — Staff roles, specialists, conversations and messages
-- =============================================================================
-- Privacy (reference: "الخصوصية"): collect only what is needed.
--   * anonymous visitors are identified by a hash of a client session id only;
--   * conversations expire (expires_at) and can be purged by a scheduled job;
--   * deleting an auth user deletes their conversations.
-- =============================================================================

create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.app_role not null,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

create table public.specialists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  display_name  text not null,
  bio           text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger specialists_set_updated_at
  before update on public.specialists
  for each row execute function private.set_updated_at();

create table public.specialist_languages (
  specialist_id  uuid not null references public.specialists (id) on delete cascade,
  language       text not null references public.languages (code),
  primary key (specialist_id, language)
);

create index specialist_languages_language_idx on public.specialist_languages (language);

create table public.conversations (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references auth.users (id) on delete cascade,
  anonymous_session_hash  text check (anonymous_session_hash is null or anonymous_session_hash ~ '^[0-9a-f]{64}$'),
  language                text not null references public.languages (code),
  title                   text,
  last_message_at         timestamptz,
  expires_at              timestamptz not null default (now() + interval '90 days'),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint conversations_has_owner check (user_id is not null or anonymous_session_hash is not null)
);

create index conversations_user_idx      on public.conversations (user_id, last_message_at desc) where user_id is not null;
create index conversations_anon_idx      on public.conversations (anonymous_session_hash) where anonymous_session_hash is not null;
create index conversations_expires_idx   on public.conversations (expires_at);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function private.set_updated_at();

comment on column public.conversations.anonymous_session_hash is 'SHA-256 of a random client session id. The raw id is never stored.';

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  role             public.message_role not null,
  content          text not null check (length(btrim(content)) > 0),
  language         text not null references public.languages (code),
  input_mode       public.input_mode not null default 'text',
  -- Assistant-only fields (validated below)
  content_level    public.content_level,
  confidence       numeric(4, 3) check (confidence is null or confidence between 0 and 1),
  is_out_of_scope  boolean not null default false,
  needs_handoff    boolean not null default false,
  handoff_reason   public.handoff_reason,
  response         jsonb,               -- full structured answer payload, for audit/replay
  model            text,
  prompt_version   text,
  latency_ms       integer check (latency_ms is null or latency_ms >= 0),
  created_at       timestamptz not null default now(),
  constraint messages_assistant_fields_only
    check (role = 'assistant' or (content_level is null and confidence is null and response is null
                                  and not needs_handoff and not is_out_of_scope and handoff_reason is null)),
  constraint messages_handoff_reason_required
    check (not needs_handoff or handoff_reason is not null)
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_handoff_idx      on public.messages (created_at desc) where needs_handoff;

-- Which chunks/scripture were retrieved for and cited by an assistant message.
create table public.message_sources (
  id          bigint generated always as identity primary key,
  message_id  uuid not null references public.messages (id) on delete cascade,
  kind        public.citation_kind not null,
  rank        smallint check (rank is null or rank > 0),
  score       real,
  chunk_id    uuid   references public.knowledge_chunks (id) on delete set null,
  ayah_id     bigint references public.quran_ayahs (id) on delete set null,
  hadith_id   uuid   references public.hadiths (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index message_sources_message_idx on public.message_sources (message_id);
create index message_sources_chunk_idx   on public.message_sources (chunk_id) where chunk_id is not null;

-- Keep conversations.last_message_at in sync.
create or replace function private.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id
     and (last_message_at is null or last_message_at < new.created_at);
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function private.touch_conversation();
