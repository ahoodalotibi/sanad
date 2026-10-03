/**
 * SANAD database access layer (server only).
 *
 *   import { createRepositories, getServiceClient } from './server/db/index.ts';
 *   const repos = createRepositories(getServiceClient());
 *   const ayah = await repos.quran.getAyah(2, 255);
 *
 * Repositories receive the client they should use, so the same code runs with the
 * service client (server/ingestion) or a user-scoped client (RLS enforced).
 */
import type { SanadDbClient } from './client.ts';
import { createChunksRepository } from './repositories/chunks.ts';
import { createConversationsRepository, createMessagesRepository } from './repositories/conversations.ts';
import { createEvaluationsRepository } from './repositories/evaluations.ts';
import { createHadithRepository } from './repositories/hadith.ts';
import { createHandoffsRepository } from './repositories/handoffs.ts';
import { createQuranRepository } from './repositories/quran.ts';
import { createDocumentsRepository, createSourcesRepository } from './repositories/sources.ts';
import { createEditionsRepository, createTerminologyRepository } from './repositories/terminology.ts';

export function createRepositories(db: SanadDbClient) {
  return {
    sources: createSourcesRepository(db),
    documents: createDocumentsRepository(db),
    editions: createEditionsRepository(db),
    quran: createQuranRepository(db),
    hadith: createHadithRepository(db),
    terminology: createTerminologyRepository(db),
    chunks: createChunksRepository(db),
    conversations: createConversationsRepository(db),
    messages: createMessagesRepository(db),
    handoffs: createHandoffsRepository(db),
    evaluations: createEvaluationsRepository(db),
  };
}

export type SanadRepositories = ReturnType<typeof createRepositories>;

export { createServiceClient, createUserClient, getServiceClient, pingDatabase, type SanadDbClient } from './client.ts';
export { isSupabaseConfigured, readSupabaseEnv, SupabaseConfigError } from './env.ts';
export { DbError } from './errors.ts';
export { normalizeArabic, normalizeAlias } from './normalize.ts';
export { hashSessionId } from './repositories/conversations.ts';
export { toPgVector } from './repositories/chunks.ts';
export * from './types.ts';
