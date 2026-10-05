import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { parseQaPage, parseQaUrl, parseSourcePage } from '../../scripts/ingest/bayyinat/parse.ts';
import { buildChunks, loadBayyinat, splitLines } from '../../scripts/ingest/bayyinat/load.ts';
import { createMemoryIngestStore } from '../../scripts/ingest/lib/store.ts';
import type { BayyinatRecord } from '../../scripts/ingest/bayyinat.ts';

const fixture = (name: string) => parseHTML(fs.readFileSync(path.join(__dirname, '../fixtures/bayenat', name), 'utf8')).document;
const URL725 = 'https://bayenat.net/ar/category/122/725';
const record = (): BayyinatRecord => ({ ...parseQaPage(fixture('qa-725.html'), URL725), sourceItemId: '725', bookReference: 'https://dawa.center/file/7937', raw: { file: 'x', sha256: 'y' }, fetchedAt: '2026-10-05T00:00:00Z' });

describe('Bayyinat parser', () => {
  it('reads item URLs and the pager from a listing page', () => {
    const { items, lastPage } = parseSourcePage(fixture('source-11.html'));
    expect(items).toEqual(['https://bayenat.net/ar/category/122/724', URL725]);
    expect(lastPage).toBe(27);
    expect(parseQaUrl('https://bayenat.net/en/category/1/2')).toEqual({ language: 'en', categoryId: '1', id: '2' });
  });

  it('keeps the question, its parts and the Quran quotations exactly as published', () => {
    const qa = parseQaPage(fixture('qa-725.html'), URL725);
    expect(qa.title).toBe('كيف عرَفَتِ الملائكةُ أن الإنسانَ سيُفسِدُ في الأرضِ، ويَسفِكُ الدماءَ، قبل أن يُخلَقَ؟');
    expect(qa.category).toBe('الإيمان بالملائكة');
    expect(qa.question).toBe('كيف عرَفَتِ الملائكةُ أن الإنسانَ سيُفسِدُ في الأرضِ، ويَسفِكُ الدماءَ، قبل أن يُخلَقَ:\n{قَالُوا أَتَجْعَلُ فِيهَا مَنْ يُفْسِدُ فِيهَا وَيَسْفِكُ الدِّمَاءَ}\n[البقرة: 30]\n؟');
    expect(qa.author).toBe('باحثو مركز أصول');
    expect(qa.publisher).toBe('مركز أصول');
    expect(qa.similar).toEqual(['عِلْمُ الملائكة.', 'إفسادُ بني آدمَ في الأرض.', 'سَفْكُ الدماءِ قبل خلقِ آدَمَ.']);
    expect(qa.shortAnswer.split('\n')[0]).toBe('عَلِمَتِ الملائكةُ أن بني آدمَ سيُفسِدون في الأرضِ، ويَسفِكون الدماءَ:');
    expect(qa.shortAnswer).toContain('{جَاعِلٌ فِي الْأَرْضِ خَلِيفَةً}\n[البقرة: 30]');
    expect(qa.detailedAnswer).toContain('{إِذْ قَالَ رَبُّكَ لِلْمَلَائِكَةِ إِنِّي خَالِقٌ بَشَرًا مِنْ طِينٍ}\n[ص:71]');
    expect(qa.detailedAnswer).not.toContain('مختصر الجواب');
    expect(qa.quotes).toContainEqual({ kind: 'quran', text: '{إِذْ قَالَ رَبُّكَ لِلْمَلَائِكَةِ إِنِّي خَالِقٌ بَشَرًا مِنْ طِينٍ}', reference: '[ص:71]' });
    expect(qa.translations).toEqual([{ language: 'en', label: 'English', url: 'https://bayenat.net/en/category/122/725' }]);
    expect(qa.printUrl).toBe('https://bayenat.net/ar/print/122/725');
  });
});

describe('Bayyinat → database', () => {
  it('splits long answers only between lines', () => {
    expect(splitLines('aaa\nbbb\nccc', 7)).toEqual(['aaa\nbbb', 'ccc']);
    expect(splitLines('x'.repeat(20), 7)).toEqual(['x'.repeat(20)]);
  });

  it('keeps the question with every chunk of its answer', () => {
    const chunks = buildChunks(record());
    expect(chunks.map((c) => c.metadata.part)).toEqual(['short_answer', 'detailed_answer']);
    for (const c of chunks) expect(c.content.startsWith('كيف عرَفَتِ الملائكةُ')).toBe(true);
    expect(chunks[0].content).toContain('عبارات مشابهة للسؤال:\nعِلْمُ الملائكة.');
    expect(chunks.map((c) => c.chunk_index)).toEqual([0, 1]);
  });

  it('loads one draft document per question and is idempotent', async () => {
    const { store, state } = createMemoryIngestStore();
    const first = await loadBayyinat([record()], store);
    expect(first.documents).toEqual({ inserted: 1 });
    expect(first.chunks).toBe(2);
    const doc = [...state.documents.values()][0];
    expect(doc.external_ref).toBe('bayenat:725');
    expect(doc.publication_status).toBe('draft');
    expect(doc.metadata.book_reference).toBe('https://dawa.center/file/7937');
    expect((await loadBayyinat([record()], store)).documents).toEqual({ unchanged: 1 });
  });
});

describe('quotation kinds', async () => {
  const { isQuranReference } = await import('../../scripts/ingest/bayyinat/parse.ts');
  it('recognises Quran references and leaves hadith citations as other', () => {
    expect(isQuranReference('[البقرة: 30]')).toBe(true);
    expect(isQuranReference('[فُصِّلت: 42]؟!')).toBe(true);
    expect(isQuranReference('[الأنبياء:26- 27].')).toBe(true);
    expect(isQuranReference('رواه أبو عُبَيدٍ في «غريبِ الحديث» (4/ 248)')).toBe(false);
    expect(isQuranReference(null)).toBe(false);
  });
});
