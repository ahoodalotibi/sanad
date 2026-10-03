-- =============================================================================
-- SANAD | 05 — Terminology dictionary ("نماذج لقاموس المصطلحات الأساسية")
-- =============================================================================
-- Per the reference: the approved dictionary takes precedence over automatic
-- translation for sensitive religious terms.
-- =============================================================================

create table public.terms (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  term_ar             text not null unique,
  term_normalized     text generated always as (private.normalize_arabic(term_ar)) stored,
  definition_ar       text,
  usage_guideline_ar  text not null,         -- "ضابط الاستخدام"
  source_id           uuid not null references public.sources (id) on delete restrict,
  publication_status  public.publication_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger terms_set_updated_at
  before update on public.terms
  for each row execute function private.set_updated_at();

-- Approved equivalents per language (e.g. التوحيد → "Tawhid / Oneness of God").
create table public.term_translations (
  id               uuid primary key default gen_random_uuid(),
  term_id          uuid not null references public.terms (id) on delete cascade,
  language         text not null references public.languages (code),
  equivalent       text not null check (length(btrim(equivalent)) > 0),
  usage_note       text,
  is_preferred     boolean not null default true,
  source_id        uuid not null references public.sources (id) on delete restrict,
  approval_status  public.approval_status not null default 'pending_review',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint term_translations_unique_equivalent unique (term_id, language, equivalent)
);

create unique index term_translations_one_preferred
  on public.term_translations (term_id, language) where is_preferred;

create trigger term_translations_set_updated_at
  before update on public.term_translations
  for each row execute function private.set_updated_at();

-- Spellings users actually type (Tauheed, توحید, তাওহীদ…) so a term can be recognised in a question.
create table public.term_aliases (
  id                uuid primary key default gen_random_uuid(),
  term_id           uuid not null references public.terms (id) on delete cascade,
  language          text not null references public.languages (code),
  alias             text not null check (length(btrim(alias)) > 0),
  alias_normalized  text generated always as (lower(private.normalize_arabic(alias))) stored,
  created_at        timestamptz not null default now(),
  constraint term_aliases_unique unique (term_id, language, alias)
);

create index term_aliases_lookup_idx on public.term_aliases (alias_normalized);
