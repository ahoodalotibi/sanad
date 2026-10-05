import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { parseCategoryPage, parseDictionaryIndex, parseWordPage, parseWordUrl } from '../../scripts/ingest/jamharah/parse.ts';
import { blockText } from '../../scripts/ingest/lib/text.ts';

const fixture = (name: string) => parseHTML(fs.readFileSync(path.join(__dirname, '../fixtures/jamharah', name), 'utf8')).document;

describe('Al-Jamharah dictionary parser', () => {
  it('parses word URLs with and without a language segment', () => {
    expect(parseWordUrl('https://islamic-content.com/dictionary/word/196')).toEqual({ wordId: '196', language: 'ar' });
    expect(parseWordUrl('https://islamic-content.com/dictionary/word/196/en')).toEqual({ wordId: '196', language: 'en' });
    expect(parseWordUrl('/dictionary/word/12/zh-Hans')).toEqual({ wordId: '12', language: 'zh-Hans' });
    expect(parseWordUrl('https://islamic-content.com/dictionary/term/1063')).toBeNull();
  });

  it('lists the subject categories once each', () => {
    expect(parseDictionaryIndex(fixture('dictionary.html')).map((c) => c.id)).toEqual(['1063', '428']);
  });

  it('takes only the listed words from a category page, not the featured word', () => {
    expect(parseCategoryPage(fixture('term-1063.html'))).toEqual(['196']);
  });

  it('extracts an Arabic entry exactly as published, section by section', () => {
    const e = parseWordPage(fixture('word-196.html'), 'https://islamic-content.com/dictionary/word/196');
    expect(e.title).toBe('الاجـْتِهَاد');
    expect(e.language).toBe('ar');
    expect(e.originalTitle).toBeNull();
    expect(e.categories.map((c) => c.id)).toEqual(['1063', '428']);
    expect(e.sections).toHaveLength(2);
    expect(e.sections[0].label).toBe('من معجم المصطلحات الشرعية');
    // wording, diacritics and the hadith reference are untouched
    expect(e.sections[0].text).toContain('فَلَهُ أَجْرَانِ');
    expect(e.sections[0].text).toContain('البخاري :7352.');
    // the bibliography is kept, but separately from the definition
    expect(e.sections[0].references).toMatch(/^انظر : فواتح الرحموت/);
    expect(e.sections[0].text).not.toContain('فواتح الرحموت');
    expect(e.sections[1]).toEqual({
      label: 'من موسوعة المصطلحات الإسلامية',
      text: 'التعريف\nبذل الوسع للنظر في الأدلة ممن هو أهل لذلك لمعرفة الحكم الشرعي. وعند الإطلاق ينصرف إلى الاجتهاد الفردي دون الجماعي.',
      references: null,
    });
    expect(e.translations).toEqual([{ language: 'en', label: 'الإنجليزية English', url: 'https://islamic-content.com/dictionary/word/196/en' }]);
  });

  it('extracts a translation and links it back to the Arabic term', () => {
    const e = parseWordPage(fixture('word-196-en.html'), 'https://islamic-content.com/dictionary/word/196/en');
    expect(e.language).toBe('en');
    expect(e.title).toBe('Ijtihad');
    expect(e.originalTitle).toBe('الاجـْتِهَاد');
    expect(e.sections[0].text).toBe(
      'التعريف\nExerting good effort in examining evidence, by a qualified scholar, to arrive at a sound religious ruling. When the term is used generally, it refers to individual, not collective, ijtihad.'
    );
    // the link back to Arabic is not a "translation" of the Arabic page
    expect(e.translations.map((t) => t.language)).toEqual(['ar']);
  });

  it('rejects pages that are not dictionary entries', () => {
    expect(() => parseWordPage(fixture('dictionary.html'), 'https://islamic-content.com/dictionary')).toThrow();
  });
});

describe('blockText', () => {
  it('keeps every character and only normalises whitespace', () => {
    const { document } = parseHTML('<div><p>أ  ب\n ج</p><h2>عنوان</h2>نص<br>سطر</div>');
    expect(blockText(document.querySelector('div') as any)).toBe('أ ب ج\nعنوان\nنص\nسطر');
  });
});
