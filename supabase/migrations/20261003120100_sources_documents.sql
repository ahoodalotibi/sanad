-- =============================================================================
-- SANAD | 02 — Approved sources and ingested documents (provenance backbone)
-- =============================================================================

-- One row per approved reference listed in "المرجعية العلمية المعتمدة".
create table public.sources (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar               text not null,
  name_en               text,
  domain                public.source_domain not null,
  base_url              text check (base_url is null or base_url ~ '^https?://'),
  usage_rule_ar         text,          -- "قاعدة الاستخدام" exactly as stated in the reference
  reference_section     text,          -- where it appears in the reference document (page/section)
  is_primary_reference  boolean not null default false,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index sources_domain_idx on public.sources (domain) where is_active;

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function private.set_updated_at();

comment on table public.sources is 'Approved scientific references (المرجعية العلمية المعتمدة). Every religious text row traces back here.';

-- A concrete unit of ingested material (a dataset file, an edition, an article).
create table public.documents (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references public.sources (id) on delete restrict,
  title               text not null,
  language            text not null references public.languages (code),
  canonical_url       text check (canonical_url is null or canonical_url ~ '^https?://'),
  external_ref        text,                   -- identifier inside the source (edition id, file name…)
  content_sha256      text unique check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  license_note        text,
  publication_status  public.publication_status not null default 'draft',
  reviewed_by         uuid references auth.users (id) on delete set null,
  reviewed_at         timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint documents_review_consistency
    check (publication_status <> 'published' or reviewed_at is not null)
);

create index documents_source_idx on public.documents (source_id);
create index documents_status_idx on public.documents (publication_status);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function private.set_updated_at();

comment on table public.documents is 'Ingested material. Only documents with publication_status = published are visible to end users.';
comment on column public.documents.content_sha256 is 'Checksum of the raw ingested content, used to make ingestion idempotent.';
