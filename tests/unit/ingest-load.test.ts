import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { parseWordPage } from '../../scripts/ingest/jamharah/parse.ts';
import { loadDictionary } from '../../scripts/ingest/jamharah/load.ts';
import { createMemoryIngestStore, languageFromLabel } from '../../scripts/ingest/lib/store.ts';
import type { DictionaryRecord } from '../../scripts/ingest/jamharah-dictionary.ts';

const page = (file: string, url: string): DictionaryRecord => {
  const doc = parseHTML(fs.readFileSync(path.join(__dirname, '../fixtures/jamharah', file), 'utf8')).document;
  const e = parseWordPage(doc, url);
  return { ...e, sourceWordId: e.wordId, raw: { file, sha256: 'x'.repeat(64) }, fetchedAt: '2026-10-05T00:00:00Z' };
};
const records = () => [page('word-196-en.html', 'https://islamic-content.com/dictionary/word/196/en'), page('word-196.html', 'https://islamic-content.com/dictionary/word/196')];

describe('dictionary → database mapping', () => {
  it('creates draft documents, chunks, the term and its translation', async () => {
    const { store, state } = createMemoryIngestStore();
    const report = await loadDictionary(records(), store);

    expect(report.documents).toEqual({ inserted: 2 });
    expect(report.terms).toBe(1);
    expect(report.termTranslations).toBe(1);
    expect(report.skipped).toEqual([]);
    expect([...state.languages.keys()].sort()).toEqual(['ar', 'en']);
    expect(state.languages.get('en')).toEqual({ code: 'en', name_en: 'English', native_name: 'English', direction: 'ltr' });

    const docs = [...state.documents.values()];
    expect(docs.every((d) => d.publication_status === 'draft')).toBe(true);
    expect(docs.map((d) => d.external_ref).sort()).toEqual(['word:196', 'word:196:en']);
    const en = docs.find((d) => d.language === 'en')!;
    expect(en.title).toBe('Ijtihad (الاجـْتِهَاد)');
    expect(en.metadata.translation_of).toBe('word:196');

    const arChunks = state.chunks.get(docs.find((d) => d.language === 'ar')!.id)!;
    expect(arChunks).toHaveLength(2);
    // title + the published text, verbatim
    expect(arChunks[0].content.startsWith('الاجـْتِهَاد\nبذل الوسع للنظر في الأدلة')).toBe(true);
    expect(arChunks[0].metadata.references).toMatch(/^انظر/);

    const term = [...state.terms.values()][0];
    expect(term).toMatchObject({ slug: 'jamharah-196', term_ar: 'الاجـْتِهَاد' });
    expect(state.termTranslations).toEqual([{ term_id: term.id, language: 'en', equivalent: 'Ijtihad', usage_note: null, source_id: expect.any(String), is_preferred: true }]);
  });

  it('is idempotent: a second run inserts nothing', async () => {
    const { store, state } = createMemoryIngestStore();
    await loadDictionary(records(), store);
    const again = await loadDictionary(records(), store);
    expect(again.documents).toEqual({ unchanged: 2 });
    expect(again.chunks).toBe(0);
    expect(again.termTranslations).toBe(0);
    expect(state.documents.size).toBe(2);
    expect(state.termTranslations).toHaveLength(1);
  });

  it('never overwrites a document a reviewer has already moved out of draft', async () => {
    const { store, state } = createMemoryIngestStore();
    await loadDictionary(records(), store);
    for (const d of state.documents.values()) d.publication_status = 'published';
    const changed = records().map((r) => ({ ...r, sections: r.sections.map((s) => ({ ...s, text: s.text + ' (edited at source)' })) }));
    const res = await loadDictionary(changed, store);
    expect(res.documents).toEqual({ kept_reviewed: 2 });
  });

  it('reads language names from the labels the source publishes', () => {
    expect(languageFromLabel('ur', 'الأردية اردو')).toMatchObject({ code: 'ur', direction: 'rtl', native_name: 'اردو', name_en: 'ur' });
    expect(languageFromLabel('fr', 'الفرنسية Français')).toMatchObject({ name_en: 'Français', native_name: 'Français', direction: 'ltr' });
  });
});
