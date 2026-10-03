-- =============================================================================
-- SANAD | 01 — Foundation: extensions, private schema, enums, shared helpers
-- =============================================================================
-- Conventions used across all SANAD migrations:
--   * Every table lives in `public` (exposed through the Supabase Data API) and
--     has RLS enabled (see 20261003120900_rls_policies.sql).
--   * Helper functions live in `private`, which the Data API never exposes.
--   * Every row of religious text (ayah, hadith, translation, term, chunk) must
--     trace back to a `sources` row — directly or through `documents`.
-- =============================================================================

create extension if not exists vector  with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Content tiers from the reference document ("مستويات المحتوى وضبط الاستجابة").
create type public.content_level as enum ('A', 'B', 'C', 'D');

-- Domains from the reference document ("المرجعية العلمية المعتمدة", pp. 3–4).
create type public.source_domain as enum (
  'dawah_content',   -- الموضوعات الدعوية والمحتوى الإسلامي
  'quran',           -- القرآن الكريم
  'tafseer',         -- التفسير
  'hadith',          -- الحديث النبوي
  'aqeedah',         -- العقيدة والتعريف بالإسلام
  'fiqh',            -- الفقه العام
  'seerah_history',  -- السيرة والتاريخ
  'shubuhat_faq',    -- الشبهات والأسئلة المتكررة
  'terminology'      -- الترجمة والمصطلحات
);

-- Distinguishes an approved translation from an approximate rendering of meaning.
create type public.approval_status as enum ('approved', 'approximate', 'pending_review', 'rejected');

-- Nothing ingested is visible to end users until a reviewer publishes it.
create type public.publication_status as enum ('draft', 'in_review', 'published', 'archived');

create type public.hadith_grade as enum ('sahih', 'hasan', 'daif', 'mawdu', 'no_basis', 'unknown');

create type public.chunk_content_type as enum (
  'quran_text', 'quran_translation', 'tafseer',
  'hadith_text', 'hadith_explanation',
  'aqeedah', 'fiqh', 'seerah_history', 'qa', 'terminology', 'dawah'
);

create type public.message_role   as enum ('user', 'assistant', 'system');
create type public.input_mode     as enum ('text', 'voice');
create type public.citation_kind  as enum ('retrieved', 'cited');

create type public.handoff_reason as enum (
  'personal_fatwa', 'sensitive_dispute', 'low_confidence',
  'unverified_hadith', 'out_of_scope', 'user_request'
);
create type public.handoff_status as enum ('pending', 'assigned', 'in_review', 'answered', 'closed', 'cancelled');

create type public.app_role    as enum ('admin', 'reviewer');
create type public.eval_origin as enum ('reference_document', 'extended');

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at current on every UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Arabic normalisation used by generated columns for exact/fuzzy text lookup
-- (e.g. detecting a misquoted ayah). It never alters the stored original text.
--   * strips tashkeel, Quranic annotation marks, superscript alef and tatweel
--   * unifies alef/hamza forms, alef maqsura → ya, ta marbuta → ha
--   * collapses whitespace
create or replace function private.normalize_arabic(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        translate(
          regexp_replace(coalesce(input, ''), '[ً-ٰٟۖ-ۭـ]', '', 'g'),
          'أإآٱىةؤئ',
          'اااايهوي'
        ),
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;

comment on function private.normalize_arabic(text) is
  'Normalises Arabic text for matching only (diacritics, alef/ya/ta-marbuta forms, whitespace). Originals are always stored untouched.';

-- -----------------------------------------------------------------------------
-- Languages (lookup table rather than an enum so new languages need no migration)
-- -----------------------------------------------------------------------------
create table public.languages (
  code           text primary key check (code ~ '^[a-z]{2,3}(-[A-Za-z0-9]+)?$'),
  name_en        text not null,
  native_name    text not null,
  direction      text not null check (direction in ('ltr', 'rtl')),
  is_ui_enabled  boolean not null default false,   -- offered in the app's language switcher
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now()
);

comment on table public.languages is
  'Content and UI languages. Arabic is a content language (scripture); en/ur/bn are the UI languages for the hackathon.';

-- Configuration only (no religious content).
insert into public.languages (code, name_en, native_name, direction, is_ui_enabled, sort_order) values
  ('ar', 'Arabic',  'العربية', 'rtl', false, 0),
  ('en', 'English', 'English', 'ltr', true,  1),
  ('ur', 'Urdu',    'اردو',    'rtl', true,  2),
  ('bn', 'Bengali', 'বাংলা',   'ltr', true,  3);
