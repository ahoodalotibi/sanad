import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { parseHadithPage } from '../../scripts/ingest/jamharah/hadith-parse.ts';
import { parseQaPage, RELATED_BOOK } from '../../scripts/ingest/bayyinat/parse.ts';
import { validateHadith, validateQa } from '../../scripts/corpus/validate.ts';
import { SOURCE_NAMES, type Corpus, type HadithItem, type QaItem } from '../../server/answer/corpus.ts';
import type { Llm } from '../../server/answer/llm.ts';
import { answer } from '../../server/answer/pipeline.ts';
import { SearchIndex } from '../../server/answer/search.ts';
import { detectLanguage } from '../../server/answer/text.ts';
import type { HadithRecord } from '../../scripts/ingest/jamharah-hadith.ts';
import type { BayyinatRecord } from '../../scripts/ingest/bayyinat.ts';

const doc = (dir: string, f: string) => parseHTML(fs.readFileSync(path.join(__dirname, '../fixtures', dir, f), 'utf8')).document;
const hadith = (f: string, url: string, language: string): HadithRecord => ({ ...parseHadithPage(doc('jamharah-hadith', f), url), language, sourceHadithId: '72602', topics: ['العقيدة'], raw: { file: f, sha256: 'x' }, fetchedAt: '' });

function buildCorpus(): Corpus {
  const rows = [hadith('t-72602.html', 'https://islamic-content.com/t/72602', 'ar'), hadith('t-88974.html', 'https://islamic-content.com/t/88974', 'en')];
  const weak = { ...rows[0], id: '1', url: 'https://islamic-content.com/t/1', sourceHadithId: '1', grade: 'ضعيف', gradeLine: '[ضعيف.] - [رواه الترمذي.]' };
  const qa: BayyinatRecord = { ...parseQaPage(doc('bayenat', 'qa-725.html'), 'https://bayenat.net/ar/category/122/725'), sourceItemId: '725', relatedBook: RELATED_BOOK, raw: { file: 'x', sha256: 'y' }, fetchedAt: '' };
  const items = [...validateHadith([...rows, weak]), ...validateQa([qa])].filter((v) => v.ok).map((v) => (v as { item: HadithItem | QaItem }).item);
  return { builtAt: '', sources: SOURCE_NAMES, items };
}

/** A scripted model: returns the given understanding and selection. */
function fakeLlm(understanding: object, selected: string[] = []): Llm & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async json(system: string, _user: string, schema: any) {
      calls.push(system.includes('route questions') ? 'understand' : 'select');
      return schema.parse(system.includes('route questions') ? understanding : { selected });
    },
  };
}
const understood = (o: object = {}) => ({ language: 'en', category: 'question', clear: true, keywords_ar: ['الإسلام', 'الإيمان', 'الإحسان', 'جبريل'], keywords_en: ['Islam', 'Iman', 'Ihsan', 'Jibril'], ...o });

const corpus = buildCorpus();
const index = new SearchIndex(corpus);
const deps = (llm: Llm | null) => ({ corpus, index, llm });

describe('validation gate', () => {
  it('keeps authentic material and leaves weak hadith out of the corpus', () => {
    expect(corpus.items.map((i) => i.id).sort()).toEqual(['bayenat:725', 't:72602']);
  });
});

describe('answer path', () => {
  it('answers with the published translation in the asker’s language, never generated text', async () => {
    const { response } = await answer({ question: 'What did Jibril ask the Prophet about?' }, deps(fakeLlm(understood(), ['t:72602'])));
    expect(response.kind).toBe('answer');
    if (response.kind !== 'answer') return;
    const item = response.items[0];
    expect(item.type).toBe('hadith');
    if (item.type !== 'hadith') return;
    expect(item.translation).toBe('source');
    expect(item.textLanguage).toBe('en');
    expect(item.text).toBe((corpus.items.find((i) => i.id === 't:72602') as HadithItem).tr.en.text);
    expect(item.arabic.startsWith('عن عمر رضي الله عنه')).toBe(true);
    expect([item.grade, item.takhrij]).toEqual(['صحيح', 'رواه مسلم']);
    expect(item.source.url).toBe('https://islamic-content.com/t/88974');
    expect(response.offerReferral).toBe(false);
  });

  it('shows another published translation when the asker’s language has none, and offers a daee', async () => {
    const { response } = await answer({ question: 'জিবরীল নবীকে কী জিজ্ঞাসা করেছিলেন?' }, deps(fakeLlm(understood({ language: 'bn' }), ['t:72602'])));
    expect(response.kind).toBe('answer');
    if (response.kind !== 'answer' || response.items[0].type !== 'hadith') return;
    expect(response.items[0].translation).toBe('alternative');
    expect(response.items[0].textLanguage).toBe('en');
    expect(response.offerReferral).toBe(true);
  });

  it('shows Arabic only when no translation exists (Bayyinat) and offers a daee', async () => {
    const { response } = await answer({ question: 'How did the angels know humans would spread corruption?' }, deps(fakeLlm(understood({ keywords_ar: ['الملائكة', 'يفسد', 'الأرض'] }), ['bayenat:725'])));
    if (response.kind !== 'answer' || response.items[0].type !== 'qa') throw new Error('expected a Q&A answer');
    expect(response.items[0].translation).toBe('none');
    expect(response.items[0].language).toBe('ar');
    expect(response.items[0].relatedBook?.url).toBe('https://dawa.center/file/7937');
    expect(response.offerReferral).toBe(true);
  });

  it('refers when the model finds nothing that directly answers', async () => {
    const { response } = await answer({ question: 'What did Jibril ask?' }, deps(fakeLlm(understood(), [])));
    expect(response).toEqual({ kind: 'refer', language: 'en', reason: 'not_found' });
  });

  it('ignores ids the model invents', async () => {
    const { response } = await answer({ question: 'What did Jibril ask?' }, deps(fakeLlm(understood(), ['t:999999'])));
    expect(response).toMatchObject({ kind: 'refer', reason: 'not_found' });
  });

  it('sends personal cases to a daee even if the model calls it a question', async () => {
    const llm = fakeLlm(understood(), ['t:72602']);
    const { response } = await answer({ question: 'My husband divorced me over text, is it valid?' }, deps(llm));
    expect(response).toEqual({ kind: 'refer', language: 'en', reason: 'personal_case' });
    expect(llm.calls).toEqual(['understand']); // no search, no selection
  });

  it('asks for clarification at most twice, then refers', async () => {
    const vague = understood({ clear: false, clarify_question: 'Do you mean ghusl or wudu?', clarify_options: ['Ghusl', 'Wudu'] });
    const first = await answer({ question: 'washing?', clarifications: 0 }, deps(fakeLlm(vague)));
    expect(first.response).toEqual({ kind: 'clarify', language: 'en', question: 'Do you mean ghusl or wudu?', options: ['Ghusl', 'Wudu'] });
    const third = await answer({ question: 'washing?', clarifications: 2 }, deps(fakeLlm(vague)));
    expect(third.response).toEqual({ kind: 'refer', language: 'en', reason: 'unclear' });
  });

  it('routes requests for a person and out-of-scope questions', async () => {
    expect((await answer({ question: 'I want to talk to a scholar' }, deps(null))).response).toMatchObject({ kind: 'refer', reason: 'user_request' });
    expect((await answer({ question: 'weather tomorrow?' }, deps(fakeLlm(understood({ category: 'out_of_scope' }))))).response).toMatchObject({ kind: 'refer', reason: 'out_of_scope' });
  });

  it('without a model, answers only on a strong match and refers otherwise', async () => {
    const strong = await answer({ question: 'سفك الدماء الملائكة الأرض يفسد' }, deps(null));
    expect(strong.response).toMatchObject({ kind: 'answer' });
    const weak = await answer({ question: 'What is the capital of France?' }, deps(null));
    expect(weak.response).toMatchObject({ kind: 'refer', reason: 'not_found' });
  });

  it('falls back to rules when the model fails', async () => {
    const broken: Llm = { json: async () => { throw new Error('timeout'); } };
    const { response, trace } = await answer({ question: 'What is the capital of France?' }, deps(broken));
    expect(trace.usedModel).toBe(false);
    expect(response.kind).toBe('refer');
  });
});

describe('language detection without a model', () => {
  it.each([
    ['لماذا سجدت الملائكة لآدم؟', 'ar'],
    ['قرآن پڑھنے کی کیا فضیلت ہے؟', 'ur'],
    ['কুরআন পড়ার ফজিলত কী?', 'bn'],
    ['Pourquoi les musulmans prient-ils ?', 'fr'],
    ['Apa itu tauhid dan mengapa penting?', 'id'],
    ['What is the meaning of tawhid?', 'en'],
    ['Ano ang Islam?', 'tl'],
  ])('%s → %s', (q, lang) => expect(detectLanguage(q)).toBe(lang));
});
