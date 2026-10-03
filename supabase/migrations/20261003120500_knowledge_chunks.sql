-- =============================================================================
-- SANAD | 06 — Knowledge chunks: the single retrieval surface for RAG
-- =============================================================================
-- Embeddings use 1536 dimensions (HNSW supports up to 2000). The embedding model
-- is recorded per row so the corpus can be re-embedded safely later.
-- No search/RAG functions are defined here — that belongs to a later phase.
-- =============================================================================

create table public.knowledge_chunks (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references public.documents (id) on delete cascade,
  chunk_index         integer not null check (chunk_index >= 0),
  language            text not null references public.languages (code),
  content_type        public.chunk_content_type not null,
  heading             text,
  content             text not null check (length(btrim(content)) > 0),
  content_normalized  text generated always as (private.normalize_arabic(content)) stored,
  fts                 tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(private.normalize_arabic(content), ''))) stored,
  content_level_hint  public.content_level,
  token_count         integer check (token_count is null or token_count > 0),
  embedding           extensions.vector(1536),
  embedding_model     text,
  embedded_at         timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint knowledge_chunks_document_index_key unique (document_id, chunk_index),
  constraint knowledge_chunks_embedding_consistency
    check ((embedding is null) = (embedding_model is null) and (embedding is null) = (embedded_at is null))
);

create index knowledge_chunks_document_idx  on public.knowledge_chunks (document_id);
create index knowledge_chunks_lang_type_idx on public.knowledge_chunks (language, content_type);
create index knowledge_chunks_fts_idx       on public.knowledge_chunks using gin (fts);
create index knowledge_chunks_trgm_idx      on public.knowledge_chunks using gin (content_normalized extensions.gin_trgm_ops);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create trigger knowledge_chunks_set_updated_at
  before update on public.knowledge_chunks
  for each row execute function private.set_updated_at();

-- Links a chunk to the exact scripture/term it is about. At answer time the
-- server renders scripture from these ids — the model never writes it.
create table public.chunk_references (
  id         bigint generated always as identity primary key,
  chunk_id   uuid not null references public.knowledge_chunks (id) on delete cascade,
  ayah_id    bigint references public.quran_ayahs (id) on delete restrict,
  hadith_id  uuid   references public.hadiths (id) on delete restrict,
  term_id    uuid   references public.terms (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint chunk_references_exactly_one_target check (num_nonnulls(ayah_id, hadith_id, term_id) = 1)
);

create index chunk_references_chunk_idx on public.chunk_references (chunk_id);
create unique index chunk_references_ayah_key   on public.chunk_references (chunk_id, ayah_id)   where ayah_id   is not null;
create unique index chunk_references_hadith_key on public.chunk_references (chunk_id, hadith_id) where hadith_id is not null;
create unique index chunk_references_term_key   on public.chunk_references (chunk_id, term_id)   where term_id   is not null;
create index chunk_references_ayah_idx   on public.chunk_references (ayah_id)   where ayah_id   is not null;
create index chunk_references_hadith_idx on public.chunk_references (hadith_id) where hadith_id is not null;
create index chunk_references_term_idx   on public.chunk_references (term_id)   where term_id   is not null;
