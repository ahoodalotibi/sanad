-- =============================================================================
-- SANAD | Referral context
-- The asker's own earlier turns for the same question (e.g. their answers to a clarification),
-- shown to the daee together with the question. Written by the server only; never model text.
-- =============================================================================
alter table public.handoff_requests add column if not exists context text
  check (context is null or length(context) <= 4000);

comment on column public.handoff_requests.context is
  'The asker''s own earlier messages for this question (verbatim), shown to the daee as context.';
