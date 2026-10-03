import type { SanadDbClient } from '../client.ts';
import { DbError, check, unwrap } from '../errors.ts';
import { EMBEDDING_DIMENSIONS, type ChunkReference, type KnowledgeChunk, type TablesInsert } from '../types.ts';

/** Chunk columns returned to callers (the raw embedding is excluded — it is large and not needed for display). */
const CHUNK_FIELDS =
  'id, document_id, chunk_index, language, content_type, heading, content, content_level_hint, token_count, embedding_model, embedded_at, metadata, created_at, updated_at';

export type ChunkSummary = Omit<KnowledgeChunk, 'embedding' | 'content_normalized' | 'fts'>;

/** pgvector text format: "[0.1,0.2,…]". */
export function toPgVector(values: readonly number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new RangeError(`Embedding must have ${EMBEDDING_DIMENSIONS} dimensions, got ${values.length}`);
  }
  if (!values.every(Number.isFinite)) throw new RangeError('Embedding contains non-finite values');
  return `[${values.join(',')}]`;
}

export function createChunksRepository(db: SanadDbClient) {
  return {
    async getByIds(ids: string[]): Promise<ChunkSummary[]> {
      if (ids.length === 0) return [];
      return unwrap('chunks.getByIds', await db.from('knowledge_chunks').select(CHUNK_FIELDS).in('id', ids));
    },

    async listByDocument(documentId: string): Promise<ChunkSummary[]> {
      return unwrap(
        'chunks.listByDocument',
        await db.from('knowledge_chunks').select(CHUNK_FIELDS).eq('document_id', documentId).order('chunk_index')
      );
    },

    /** The ayah/hadith/term ids a set of chunks point to (scripture is rendered from these ids). */
    async getReferences(chunkIds: string[]): Promise<ChunkReference[]> {
      if (chunkIds.length === 0) return [];
      return unwrap('chunks.getReferences', await db.from('chunk_references').select('*').in('chunk_id', chunkIds));
    },

    /** Chunks still waiting for an embedding (for the embedding job). */
    async listMissingEmbeddings(limit = 100): Promise<Pick<KnowledgeChunk, 'id' | 'content' | 'language'>[]> {
      return unwrap(
        'chunks.listMissingEmbeddings',
        await db.from('knowledge_chunks').select('id, content, language').is('embedding', null).order('created_at').limit(limit)
      );
    },

    // ---- ingestion helpers (service client only) -------------------------------------------

    /** Inserts chunks with their scripture/term references. Idempotent per (document_id, chunk_index). */
    async upsertWithReferences(
      items: { chunk: Omit<TablesInsert<'knowledge_chunks'>, 'embedding' | 'embedding_model' | 'embedded_at'>; references?: Omit<TablesInsert<'chunk_references'>, 'chunk_id'>[] }[]
    ): Promise<ChunkSummary[]> {
      if (items.length === 0) return [];
      const saved = unwrap(
        'chunks.upsert',
        await db
          .from('knowledge_chunks')
          .upsert(items.map((i) => i.chunk), { onConflict: 'document_id,chunk_index' })
          .select(CHUNK_FIELDS)
      );

      const idByKey = new Map(saved.map((c) => [`${c.document_id}:${c.chunk_index}`, c.id]));
      const refs = items.flatMap((item) => {
        const chunkId = idByKey.get(`${item.chunk.document_id}:${item.chunk.chunk_index}`);
        if (!chunkId) throw new DbError('chunks.upsert', { message: 'saved chunk not returned' });
        return (item.references ?? []).map((r) => ({ ...r, chunk_id: chunkId }));
      });

      if (refs.length > 0) {
        // Replace references of these chunks so re-ingestion never leaves stale links.
        check('chunks.clearReferences', await db.from('chunk_references').delete().in('chunk_id', [...idByKey.values()]));
        check('chunks.insertReferences', await db.from('chunk_references').insert(refs));
      }
      return saved;
    },

    async setEmbedding(chunkId: string, embedding: readonly number[], model: string): Promise<void> {
      check(
        'chunks.setEmbedding',
        await db
          .from('knowledge_chunks')
          .update({ embedding: toPgVector(embedding), embedding_model: model, embedded_at: new Date().toISOString() })
          .eq('id', chunkId)
      );
    },
  };
}
