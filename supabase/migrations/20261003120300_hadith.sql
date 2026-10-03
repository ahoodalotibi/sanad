-- =============================================================================
-- SANAD | 04 — Hadith collections, hadiths and their translations
-- =============================================================================
-- Rule from the reference: "لا ينسب حديث دون مصدر وحكم معتمد في البيانات".
-- Hence every hadith row carries its collection, number, grade and source document.
-- =============================================================================

create table public.hadith_collections (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ar             text not null,
  name_en             text,
  source_id           uuid not null references public.sources (id) on delete restrict,
  is_canonical_sahih  boolean not null default false,   -- الصحيحان
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now()
);

create table public.hadiths (
  id                  uuid primary key default gen_random_uuid(),
  collection_id       uuid not null references public.hadith_collections (id) on delete restrict,
  hadith_number       text not null,          -- numbering systems differ between editions
  sort_key            integer,                -- numeric ordering when available
  book_name_ar        text,                   -- الكتاب
  chapter_name_ar     text,                   -- الباب
  narrator_ar         text,                   -- الراوي
  isnad_ar            text,
  text_ar             text not null check (length(btrim(text_ar)) > 0),   -- المتن
  text_normalized     text generated always as (private.normalize_arabic(text_ar)) stored,
  grade               public.hadith_grade not null,
  grade_text_ar       text,                   -- the verdict wording as published (e.g. صحيح، متفق عليه)
  graded_by           text,                   -- المحدث
  takhrij_ar          text,
  external_ref        text,                   -- e.g. Dorar.net reference
  source_document_id  uuid not null references public.documents (id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint hadiths_collection_number_key unique (collection_id, hadith_number)
);

create index hadiths_document_idx    on public.hadiths (source_document_id);
create index hadiths_grade_idx       on public.hadiths (grade);
create index hadiths_normalized_trgm on public.hadiths using gin (text_normalized extensions.gin_trgm_ops);

create trigger hadiths_set_updated_at
  before update on public.hadiths
  for each row execute function private.set_updated_at();

create table public.hadith_translations (
  id            bigint generated always as identity primary key,
  hadith_id     uuid not null references public.hadiths (id) on delete cascade,
  edition_id    uuid not null,
  edition_kind  text not null default 'hadith' check (edition_kind = 'hadith'),
  text          text not null check (length(btrim(text)) > 0),
  created_at    timestamptz not null default now(),
  constraint hadith_translations_edition_fk
    foreign key (edition_id, edition_kind)
    references public.translation_editions (id, kind) on delete restrict,
  constraint hadith_translations_hadith_edition_key unique (hadith_id, edition_id)
);

create index hadith_translations_edition_idx on public.hadith_translations (edition_id);
