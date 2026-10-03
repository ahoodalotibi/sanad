/**
 * Computes OpenAI embeddings for knowledge chunks that do not have one yet.
 *
 *   npm run rag:embed            embeds all missing chunks (draft ones too — they stay hidden until published)
 *   npm run rag:embed -- --dry   only counts what would be embedded
 *
 * Uses OPENAI_EMBEDDING_MODEL / OPENAI_EMBEDDING_DIMENSIONS, and records the model on every row
 * so retrieval never mixes vectors from different models.
 */
import 'dotenv/config';
import { OpenAiProvider } from '../../server/ai/openai.ts';
import { createRepositories, getServiceClient } from '../../server/db/index.ts';
import { readOpenAiSettings } from '../../server/rag/config.ts';

const BATCH = 64;
const dryRun = process.argv.includes('--dry');

async function main() {
  const repos = createRepositories(getServiceClient());
  const settings = readOpenAiSettings();
  const ai = new OpenAiProvider(settings);
  let total = 0;

  for (;;) {
    const pending = await repos.chunks.listMissingEmbeddings(BATCH);
    if (pending.length === 0) break;
    if (dryRun) {
      console.log(`${pending.length}+ chunk(s) need embeddings (dry run, nothing written)`);
      return;
    }
    const vectors = await ai.embed(pending.map((c) => c.content));
    for (let i = 0; i < pending.length; i++) {
      await repos.chunks.setEmbedding(pending[i].id, vectors[i], ai.embeddingModel);
    }
    total += pending.length;
    console.log(`embedded ${total} chunk(s)…`);
  }
  console.log(`✓ done — ${total} chunk(s) embedded with ${settings.embeddingModel}`);
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
