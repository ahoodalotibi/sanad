-- =============================================================================
-- SANAD | 11 — Retrieval function for the RAG pipeline (no table changes)
-- =============================================================================
-- Hybrid search over knowledge_chunks: vector similarity (pgvector, cosine) fused
-- with full-text rank using Reciprocal Rank Fusion.
--
-- SAFETY: the server calls this with the service role, which bypasses RLS, so the
-- publication rules are enforced HERE, explicitly, for every caller:
--   * only documents with publication_status = 'published'
--   * only active sources
--   * never rows flagged as synthetic test data (documents.metadata.test_data = true)
--     unless include_test_data is explicitly true (used by the test suite only)
--   * only embeddings produced by the requested embedding model
-- =============================================================================

create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  query_text text,
  embedding_model text,
  match_count integer default 8,
  filter_domains public.source_domain[] default null,
  include_test_data boolean default false
)
returns table (
  chunk_id uuid,
  document_id uuid,
  source_id uuid,
  source_slug text,
  source_name_ar text,
  source_name_en text,
  source_domain public.source_domain,
  source_url text,
  document_title text,
  document_url text,
  language text,
  content_type public.chunk_content_type,
  heading text,
  content text,
  content_level_hint public.content_level,
  metadata jsonb,
  vector_similarity real,
  text_rank real,
  fused_score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select c.id, c.document_id, c.language, c.content_type, c.heading, c.content,
           c.content_level_hint, c.metadata, c.embedding, c.embedding_model, c.fts,
           d.title as document_title, d.canonical_url as document_url,
           s.id as source_id, s.slug as source_slug, s.name_ar as source_name_ar,
           s.name_en as source_name_en, s.domain as source_domain, s.base_url as source_url
      from public.knowledge_chunks c
      join public.documents d on d.id = c.document_id
      join public.sources s on s.id = d.source_id
     where d.publication_status = 'published'
       and s.is_active
       and (filter_domains is null or s.domain = any (filter_domains))
       and (include_test_data or coalesce((d.metadata ->> 'test_data')::boolean, false) = false)
  ),
  vec as (
    select id,
           (1 - (embedding operator(extensions.<=>) query_embedding))::real as sim,
           row_number() over (order by embedding operator(extensions.<=>) query_embedding) as r
      from candidates
     where embedding is not null
       and candidates.embedding_model = match_chunks.embedding_model
     order by embedding operator(extensions.<=>) query_embedding
     limit greatest(match_count * 4, 20)
  ),
  q as (
    select websearch_to_tsquery('simple'::regconfig, coalesce(private.normalize_arabic(query_text), '')) as tsq
  ),
  txt as (
    select c.id,
           ts_rank(c.fts, q.tsq)::real as rank,
           row_number() over (order by ts_rank(c.fts, q.tsq) desc) as r
      from candidates c, q
     where c.fts @@ q.tsq
     order by rank desc
     limit greatest(match_count * 4, 20)
  ),
  fused as (
    select coalesce(v.id, t.id) as id,
           coalesce(v.sim, 0)::real as sim,
           coalesce(t.rank, 0)::real as rank,
           (coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + t.r), 0))::real as rrf
      from vec v
      full outer join txt t on t.id = v.id
  )
  select c.id, c.document_id, c.source_id, c.source_slug, c.source_name_ar, c.source_name_en,
         c.source_domain, c.source_url, c.document_title, c.document_url, c.language,
         c.content_type, c.heading, c.content, c.content_level_hint, c.metadata,
         f.sim, f.rank, f.rrf
    from fused f
    join candidates c on c.id = f.id
   order by f.rrf desc, f.sim desc
   limit least(greatest(match_count, 1), 50);
$$;

comment on function public.match_chunks is
  'Hybrid (vector + full-text) retrieval over PUBLISHED, active, non-test knowledge chunks only. Server-side use.';

-- Retrieval is a server responsibility: not callable by browsers (anon/authenticated).
revoke all on function public.match_chunks(extensions.vector, text, text, integer, public.source_domain[], boolean) from public, anon, authenticated;
grant execute on function public.match_chunks(extensions.vector, text, text, integer, public.source_domain[], boolean) to service_role;
