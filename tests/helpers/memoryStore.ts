/**
 * TEST DOUBLE ONLY — in-memory RagStore for pipeline logic tests (no database).
 * Every chunk here is synthetic TEST DATA.
 */
import type { RagStore, RetrievedChunk, ScriptureRef, SearchParams } from '../../server/rag/store.ts';

export function testChunk(overrides: Partial<RetrievedChunk> & { id: string }): RetrievedChunk {
  return {
    documentId: `doc-${overrides.id}`,
    sourceId: 'src-test',
    sourceSlug: 'test-source',
    sourceNameAr: 'مصدر تجريبي',
    sourceNameEn: 'TEST source',
    sourceDomain: 'aqeedah',
    sourceUrl: 'https://example.test/source',
    documentTitle: 'TEST document',
    documentUrl: `https://example.test/doc/${overrides.id}`,
    language: 'en',
    contentType: 'aqeedah',
    heading: null,
    content: `TEST DATA passage ${overrides.id}.`,
    levelHint: null,
    similarity: 0.8,
    textRank: 0,
    fusedScore: 0.03,
    ...overrides,
  };
}

export class MemoryStore implements RagStore {
  searches: SearchParams[] = [];
  scriptureRequests: { chunkIds: string[]; language: string }[] = [];
  constructor(
    public chunks: RetrievedChunk[] = [],
    public scripture: ScriptureRef[] = []
  ) {}

  async search(params: SearchParams): Promise<RetrievedChunk[]> {
    this.searches.push(params);
    return this.chunks.filter((c) => !params.domains || params.domains.includes(c.sourceDomain));
  }

  async getScripture(chunkIds: string[], language: string): Promise<ScriptureRef[]> {
    this.scriptureRequests.push({ chunkIds, language });
    return this.scripture.filter((s) => chunkIds.includes(s.chunkId));
  }
}
