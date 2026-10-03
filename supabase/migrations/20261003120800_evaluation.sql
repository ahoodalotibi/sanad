-- =============================================================================
-- SANAD | 09 — Evaluation: test cases (reference p.6 + extended) and runs
-- =============================================================================

create table public.eval_test_cases (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique check (code ~ '^[A-Z]+-[0-9]{2,3}$'),   -- e.g. REF-01, EXT-001
  origin                   public.eval_origin not null,
  title_ar                 text not null,
  scenario_ar              text not null,        -- "حالة الاختبار"
  expected_behavior_ar     text not null,        -- "السلوك المتوقع"
  expected_level           public.content_level,
  expect_handoff           boolean,
  expect_refusal           boolean,
  expected_source_domains  public.source_domain[] not null default '{}',
  assertions               jsonb not null default '{}'::jsonb,   -- machine-checkable rules for the runner
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger eval_test_cases_set_updated_at
  before update on public.eval_test_cases
  for each row execute function private.set_updated_at();

-- The same case is asked in each UI language.
create table public.eval_case_prompts (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid not null references public.eval_test_cases (id) on delete cascade,
  language  text not null references public.languages (code),
  prompt    text not null check (length(btrim(prompt)) > 0),
  constraint eval_case_prompts_unique unique (case_id, language, prompt),
  constraint eval_case_prompts_identity_key unique (id, case_id, language)   -- target of eval_results composite FK
);

create index eval_case_prompts_case_idx on public.eval_case_prompts (case_id);

create table public.eval_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  git_sha          text,
  model            text,
  embedding_model  text,
  prompt_version   text,
  config           jsonb not null default '{}'::jsonb,
  summary          jsonb,              -- pass rate per language/level, filled when the run finishes
  notes            text,
  triggered_by     uuid references auth.users (id) on delete set null,
  constraint eval_runs_finish_after_start check (finished_at is null or finished_at >= started_at)
);

create table public.eval_results (
  id              bigint generated always as identity primary key,
  run_id          uuid not null references public.eval_runs (id) on delete cascade,
  case_id         uuid not null references public.eval_test_cases (id) on delete restrict,
  prompt_id       uuid not null,
  language        text not null references public.languages (code),
  passed          boolean not null,
  actual_level    public.content_level,
  actual_handoff  boolean,
  actual_refusal  boolean,
  failures        text[] not null default '{}',
  response        jsonb,
  latency_ms      integer check (latency_ms is null or latency_ms >= 0),
  created_at      timestamptz not null default now(),
  -- prompt, case and language must all agree
  constraint eval_results_prompt_fk foreign key (prompt_id, case_id, language)
    references public.eval_case_prompts (id, case_id, language) on delete restrict,
  constraint eval_results_run_prompt_key unique (run_id, prompt_id),
  constraint eval_results_failures_consistent check (passed = (cardinality(failures) = 0))
);

create index eval_results_run_idx  on public.eval_results (run_id);
create index eval_results_case_idx on public.eval_results (case_id);
