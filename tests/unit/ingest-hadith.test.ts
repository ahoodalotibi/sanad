import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { gradeEnum, parseGradeLine, parseHadithIndex, parseHadithPage, parseTopicPage } from '../../scripts/ingest/jamharah/hadith-parse.ts';
import { hadithChunks, loadHadith } from '../../scripts/ingest/jamharah/hadith-load.ts';
import { createMemoryIngestStore } from '../../scripts/ingest/lib/store.ts';
import type { HadithRecord } from '../../scripts/ingest/jamharah-hadith.ts';

const fx = (n: string) => parseHTML(fs.readFileSync(path.join(__dirname, '../fixtures/jamharah-hadith', n), 'utf8')).document;
const AR = 'https://islamic-content.com/t/72602';
const EN = 'https://islamic-content.com/t/88974';
const rec = (file: string, url: string, language: string): HadithRecord => ({ ...parseHadithPage(fx(file), url), language, sourceHadithId: '72602', topics: ['العقيدة'], raw: { file, sha256: 'x' }, fetchedAt: '2026-10-05T00:00:00Z' });

describe('Sunnah dictionary parser', () => {
  it('finds topic pages and hadith pages', () => {
    expect(parseHadithIndex(fx('topic.html'))).toEqual(['https://islamic-content.com/t/1/hadeeths', 'https://islamic-content.com/t/5/hadeeths']);
    expect(parseTopicPage(fx('topic.html')).map((h) => h.id)).toEqual(['72602', '73342']);
  });

  it('extracts the Arabic hadith with its grade, takhrij and sections, honorifics intact', () => {
    const h = parseHadithPage(fx('t-72602.html'), AR);
    expect(h.text.startsWith('عن عمر رضي الله عنه قال: «بينما نحن جلوسٌ عند رسول الله ﷺ ذات يوم')).toBe(true);
    expect(h.gradeLine).toBe('[صحيح.] - [رواه مسلم.]');
    expect([h.grade, h.takhrij]).toEqual(['صحيح', 'رواه مسلم']);
    expect(h.explanation?.startsWith('خرج جبريل -عليه السلام- على الصحابة رضي الله عنهم بصورة')).toBe(true);
    expect(h.wordMeanings).toEqual([{ word: 'طلع', meaning: 'ظهر.' }, { word: 'أماراتها', meaning: 'علاماتها.' }]);
    expect(h.benefits).toEqual(['بيان علوِّ درجة الإحسان.', 'أنَّ علم الساعة مِمَّا استأثر الله بعلمه.']);
    expect(h.references?.split('\n')[0]).toMatch(/^صحيح مسلم؛/);
    expect(h.relatedTopics).toEqual([{ id: '1792', name: 'العقيدة' }]);
    expect(h.title).toBe('شرح حديث بينما نحن جلوسٌ عند رسول الله -صلى الله عليه وسلم-');
    // unknown language names are reported, never guessed
    expect(h.translations).toEqual([
      { id: '88974', url: EN, name: 'الإنجليزية', language: 'en' },
      { id: '88977', url: 'https://islamic-content.com/t/88977', name: 'الأردية', language: 'ur' },
      { id: '99999', url: 'https://islamic-content.com/t/99999', name: 'لغة غير معروفة', language: null },
    ]);
  });

  it('extracts a translation page (text + explanation, no grade line)', () => {
    const h = parseHadithPage(fx('t-88974.html'), EN);
    expect(h.text.startsWith('‘Umar ibn al-Khattāb (may Allah be pleased with him) reported')).toBe(true);
    expect(h.gradeLine).toBeNull();
    expect(h.explanation).toBe('Jibrīl (peace be upon him) once appeared as an unknown man before the Companions …');
    expect(h.translations.map((t) => t.language)).toEqual(['ar', 'ur']);
  });

  it('maps published grades conservatively', () => {
    expect(parseGradeLine('[حسن.] - [رواه الترمذي وأبو داود.]')).toEqual({ grade: 'حسن', takhrij: 'رواه الترمذي وأبو داود' });
    expect(gradeEnum('صحيح')).toBe('sahih');
    expect(gradeEnum('صحيح لغيره')).toBe('sahih');
    expect(gradeEnum('حسن')).toBe('hasan');
    expect(gradeEnum('ضعيف')).toBe('daif');
    expect(gradeEnum(null)).toBe('unknown');
    expect(gradeEnum('غير ذلك')).toBe('unknown');
  });
});

describe('Sunnah dictionary → database', () => {
  it('stores the hadith, its translation edition and chunks linked to the hadith', async () => {
    const { store, state } = createMemoryIngestStore();
    const report = await loadHadith([rec('t-88974.html', EN, 'en'), rec('t-72602.html', AR, 'ar')], store);
    expect(report).toMatchObject({ hadiths: 1, translations: 1, documents: { inserted: 2 }, skipped: [] });
    const hadith = [...state.hadiths.values()][0];
    expect(hadith).toMatchObject({ hadith_number: '72602', grade: 'sahih', grade_text_ar: 'صحيح', takhrij_ar: 'رواه مسلم' });
    const edition = [...state.editions.values()][0];
    expect(edition).toMatchObject({ slug: 'jamharah-sunnah-en', kind: 'hadith', language: 'en', approval_status: 'pending_review' });
    expect([...state.hadithTranslations.values()][0].text.startsWith('‘Umar ibn al-Khattāb')).toBe(true);
    // every chunk (Arabic and English) points to the same hadith row
    expect(state.chunkRefs).toHaveLength(4);
    expect(new Set(state.chunkRefs.map((r) => r.hadith_id))).toEqual(new Set([hadith.id]));
    expect(state.languages.get('en')).toMatchObject({ native_name: 'en', direction: 'ltr' });
  });

  it('keeps the grade with the hadith text chunk', () => {
    const chunks = hadithChunks(rec('t-72602.html', AR, 'ar'));
    expect(chunks.map((c) => c.content_type)).toEqual(['hadith_text', 'hadith_explanation']);
    expect(chunks[0].content.endsWith('[صحيح.] - [رواه مسلم.]')).toBe(true);
  });

  it('re-running changes nothing', async () => {
    const { store, state } = createMemoryIngestStore();
    const rows = [rec('t-72602.html', AR, 'ar'), rec('t-88974.html', EN, 'en')];
    await loadHadith(rows, store);
    const again = await loadHadith(rows, store);
    expect(again.documents).toEqual({ unchanged: 2 });
    expect(state.hadiths.size).toBe(1);
    expect(state.chunkRefs).toHaveLength(4);
  });
});

describe('gradeEnum on grades published by the site', () => {
  it('accepts only clean sahih/hasan grades', async () => {
    const { gradeEnum } = await import('../../scripts/ingest/jamharah/hadith-parse.ts');
    const cases: Record<string, string> = {
      'صحيح': 'sahih', 'حسن': 'hasan', 'صحيح لغيره': 'sahih', 'حسن صحيح': 'hasan', 'إسناده حسن': 'hasan',
      'ضعيف جدا': 'daif', 'منكر': 'daif', 'ضعفه الحافظ ابن حجر في البلوغ عقب تخريجه': 'daif',
      'الحديث الأول: صحيح. الحديث الثاني: ضعيف': 'daif', 'صحيح، ولكن الزيادة ضعيفة': 'daif',
      'قال الهيثمي في مجمع الزوائد: رجاله رجال الصحيح': 'unknown', 'صحيح موقوفًا على أبي بكر الصديق رضي الله عنه': 'unknown',
      'الآثار صحيحة': 'unknown', 'نقل الألباني تصحيحه عن ابن تيمية ولم يتعقبه': 'unknown', 'صحيح دون ذكر السنين': 'unknown',
      'رجح البيهقي أنه موقوف': 'unknown', 'لم أجد له حكماً عند الألباني': 'unknown',
    };
    for (const [grade, expected] of Object.entries(cases)) expect([grade, gradeEnum(grade)]).toEqual([grade, expected]);
  });
});
