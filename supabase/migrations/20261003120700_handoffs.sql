-- =============================================================================
-- SANAD | 08 — Specialist handoff requests ("عدم الاستقلال بالفتوى")
-- =============================================================================

create sequence public.handoff_reference_seq;

create table public.handoff_requests (
  id                      uuid primary key default gen_random_uuid(),
  reference_code          text not null unique
                            default ('SND-' || lpad(nextval('public.handoff_reference_seq')::text, 6, '0')),
  conversation_id         uuid references public.conversations (id) on delete set null,
  message_id              uuid references public.messages (id) on delete set null,
  requester_user_id       uuid references auth.users (id) on delete set null,
  question                text not null check (length(btrim(question)) > 0),
  language                text not null references public.languages (code),
  reason                  public.handoff_reason not null,
  ai_summary              text,
  status                  public.handoff_status not null default 'pending',
  assigned_specialist_id  uuid references public.specialists (id) on delete set null,
  specialist_response     text,
  contact_consent         boolean not null default false,
  contact_channel         text check (contact_channel is null or contact_channel in ('email', 'phone', 'in_app')),
  contact_value           text,
  assigned_at             timestamptz,
  resolved_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint handoff_contact_requires_consent
    check (contact_value is null or (contact_consent and contact_channel is not null)),
  constraint handoff_active_requires_specialist
    check (status not in ('assigned', 'in_review', 'answered') or assigned_specialist_id is not null),
  constraint handoff_answer_requires_response
    check (status <> 'answered' or specialist_response is not null)
);

alter sequence public.handoff_reference_seq owned by public.handoff_requests.reference_code;

create index handoff_requests_status_lang_idx on public.handoff_requests (status, language, created_at);
create index handoff_requests_specialist_idx  on public.handoff_requests (assigned_specialist_id) where assigned_specialist_id is not null;
create index handoff_requests_requester_idx   on public.handoff_requests (requester_user_id) where requester_user_id is not null;
create index handoff_requests_conversation_idx on public.handoff_requests (conversation_id) where conversation_id is not null;

create trigger handoff_requests_set_updated_at
  before update on public.handoff_requests
  for each row execute function private.set_updated_at();

-- Sources the system had consulted before handing off (passed to the specialist).
create table public.handoff_consulted_sources (
  handoff_id  uuid not null references public.handoff_requests (id) on delete cascade,
  chunk_id    uuid not null references public.knowledge_chunks (id) on delete cascade,
  primary key (handoff_id, chunk_id)
);

-- Audit trail of status changes.
create table public.handoff_events (
  id             bigint generated always as identity primary key,
  handoff_id     uuid not null references public.handoff_requests (id) on delete cascade,
  from_status    public.handoff_status,
  to_status      public.handoff_status not null,
  actor_user_id  uuid,
  created_at     timestamptz not null default now()
);

create index handoff_events_handoff_idx on public.handoff_events (handoff_id, created_at);

create or replace function private.log_handoff_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.handoff_events (handoff_id, from_status, to_status, actor_user_id)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.handoff_events (handoff_id, from_status, to_status, actor_user_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

-- Stamp assigned_at / resolved_at automatically.
create or replace function private.stamp_handoff_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_specialist_id is not null
     and (tg_op = 'INSERT' or old.assigned_specialist_id is distinct from new.assigned_specialist_id) then
    new.assigned_at := now();
  end if;
  if new.status in ('answered', 'closed', 'cancelled')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.resolved_at := now();
  end if;
  return new;
end;
$$;

create trigger handoff_requests_stamp_times
  before insert or update on public.handoff_requests
  for each row execute function private.stamp_handoff_times();

create trigger handoff_requests_log_status
  after insert or update of status on public.handoff_requests
  for each row execute function private.log_handoff_status();
