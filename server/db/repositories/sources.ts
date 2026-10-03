import type { SanadDbClient } from '../client.ts';
import { unwrap, unwrapMaybe } from '../errors.ts';
import type { DocumentRow, PublicationStatus, Source, SourceDomain, TablesInsert } from '../types.ts';

export function createSourcesRepository(db: SanadDbClient) {
  return {
    async list(filter: { domain?: SourceDomain; activeOnly?: boolean } = {}): Promise<Source[]> {
      let query = db.from('sources').select('*').order('domain').order('slug');
      if (filter.domain) query = query.eq('domain', filter.domain);
      if (filter.activeOnly ?? true) query = query.eq('is_active', true);
      return unwrap('sources.list', await query);
    },

    async getBySlug(slug: string): Promise<Source | null> {
      return unwrapMaybe('sources.getBySlug', await db.from('sources').select('*').eq('slug', slug).maybeSingle());
    },

    /** Idempotent by slug — used by the reference-ingestion step. */
    async upsert(rows: TablesInsert<'sources'>[]): Promise<Source[]> {
      if (rows.length === 0) return [];
      return unwrap('sources.upsert', await db.from('sources').upsert(rows, { onConflict: 'slug' }).select('*'));
    },
  };
}

export function createDocumentsRepository(db: SanadDbClient) {
  return {
    async getById(id: string): Promise<DocumentRow | null> {
      return unwrapMaybe('documents.getById', await db.from('documents').select('*').eq('id', id).maybeSingle());
    },

    /** Used to make ingestion idempotent: same raw content → same document. */
    async findByChecksum(sha256: string): Promise<DocumentRow | null> {
      return unwrapMaybe(
        'documents.findByChecksum',
        await db.from('documents').select('*').eq('content_sha256', sha256).maybeSingle()
      );
    },

    async create(row: TablesInsert<'documents'>): Promise<DocumentRow> {
      return unwrap('documents.create', await db.from('documents').insert(row).select('*').single());
    },

    /**
     * Moves a document through the review workflow. Publishing requires a reviewer;
     * the DB also enforces that a published document has reviewed_at.
     */
    async setPublicationStatus(id: string, status: PublicationStatus, reviewerUserId?: string): Promise<DocumentRow> {
      const patch =
        status === 'published'
          ? { publication_status: status, reviewed_at: new Date().toISOString(), reviewed_by: reviewerUserId ?? null }
          : { publication_status: status };
      return unwrap('documents.setPublicationStatus', await db.from('documents').update(patch).eq('id', id).select('*').single());
    },
  };
}
