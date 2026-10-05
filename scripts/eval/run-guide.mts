/**
 * Runs the reference guide's test questions (المرجعية، ص6) through the answer path and prints what
 * each would show. `npm run eval:guide` — uses LLM_API_KEY from .env when present.
 */
import 'dotenv/config';
import path from 'node:path';
import { loadCorpus } from '../../server/answer/corpus.ts';
import { createLlm, readLlmSettings } from '../../server/answer/llm.ts';
import { answer } from '../../server/answer/pipeline.ts';
import { SearchIndex } from '../../server/answer/search.ts';
import { BENCHMARK_TEST_CASES } from './guide-cases.ts';

const corpus = loadCorpus(path.resolve(process.env.CORPUS_FILE || 'data/corpus/corpus.json.gz'));
const index = new SearchIndex(corpus);
const settings = readLlmSettings();
const llm = settings ? createLlm(settings) : null;
console.log(`corpus ${corpus.items.length} items · model ${llm ? settings!.model : 'none (rules only)'}\n`);
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + '…' : s).replace(/\s+/g, ' ');
for (const c of BENCHMARK_TEST_CASES) {
  console.log(`■ ${c.id} [${c.targetTier}] ${c.title}`);
  for (const [lang, q] of [['en', c.questionEn], ['ur', c.questionUr], ['bn', c.questionBn]] as const) {
    const { response: r, trace } = await answer({ question: q }, { index, corpus, llm });
    let out = r.kind;
    if (r.kind === 'answer') out += ` (${r.items.map((i) => `${i.type}:${i.id}/${i.translation}`).join(', ')}) → ${short(i0(r.items[0]))}`;
    if (r.kind === 'refer') out += ` (${r.reason})`;
    if (r.kind === 'clarify') out += ` → ${short(r.question)}`;
    console.log(`   ${lang} lang=${r.language} ${out}   [top: ${trace.hits.slice(0, 2).map((h) => `${h.id} s${h.score} c${h.coverage}`).join(' | ')}]`);
  }
  console.log(`   expected: ${c.expectedBehaviorEn}\n`);
}
function i0(i: any): string {
  return i.type === 'hadith' ? i.text : i.type === 'qa' ? i.question : i.term;
}
