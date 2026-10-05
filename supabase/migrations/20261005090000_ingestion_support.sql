-- =============================================================================
-- SANAD | 12 — Support for re-runnable content ingestion (scripts/ingest)
-- =============================================================================

-- A document is identified inside its source by external_ref (e.g. "word:196:en",
-- "file:7937"). Making the pair unique lets the import scripts upsert, so running
-- an import twice never duplicates material. NULL external_refs stay allowed.
alter table public.documents
  add constraint documents_source_external_ref_key unique (source_id, external_ref);

-- Dictionary entries imported from Al-Jamharah carry a published definition but no
-- "ضابط الاستخدام". That guideline only exists for the reference document's own
-- sample terms, so it must not be invented for imported entries.
alter table public.terms
  alter column usage_guideline_ar drop not null;

comment on column public.terms.usage_guideline_ar is
  'ضابط الاستخدام exactly as stated in the reference document. NULL for imported dictionary entries that do not publish one.';
