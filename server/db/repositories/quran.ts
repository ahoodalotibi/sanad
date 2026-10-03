import type { SanadDbClient } from '../client.ts';
import { unwrap, unwrapMaybe } from '../errors.ts';
import type { LanguageCode, QuranAyah, QuranSurah, TablesInsert, TranslationWithEdition } from '../types.ts';

const EDITION_FIELDS = 'id, slug, name, translator, language, approval_status';

export interface AyahTranslation extends TranslationWithEdition {
  ayahId: number;
}

export function createQuranRepository(db: SanadDbClient) {
  return {
    async listSurahs(): Promise<QuranSurah[]> {
      return unwrap('quran.listSurahs', await db.from('quran_surahs').select('*').order('number'));
    },

    async getSurah(number: number): Promise<QuranSurah | null> {
      return unwrapMaybe('quran.getSurah', await db.from('quran_surahs').select('*').eq('number', number).maybeSingle());
    },

    async getAyah(surah: number, ayah: number): Promise<QuranAyah | null> {
      return unwrapMaybe(
        'quran.getAyah',
        await db.from('quran_ayahs').select('*').eq('surah_number', surah).eq('ayah_number', ayah).maybeSingle()
      );
    },

    async getAyahRange(surah: number, fromAyah: number, toAyah: number): Promise<QuranAyah[]> {
      if (toAyah < fromAyah) throw new RangeError('toAyah must be >= fromAyah');
      return unwrap(
        'quran.getAyahRange',
        await db
          .from('quran_ayahs')
          .select('*')
          .eq('surah_number', surah)
          .gte('ayah_number', fromAyah)
          .lte('ayah_number', toAyah)
          .order('ayah_number')
      );
    },

    async getAyahsByIds(ids: number[]): Promise<QuranAyah[]> {
      if (ids.length === 0) return [];
      return unwrap('quran.getAyahsByIds', await db.from('quran_ayahs').select('*').in('id', ids).order('global_number'));
    },

    /**
     * Translations for the given ayahs in one language, from usable editions only
     * (approved or approximate). Callers must label `approximate` ones in the UI.
     * Prefers the default edition when several exist.
     */
    async getTranslations(ayahIds: number[], language: LanguageCode): Promise<AyahTranslation[]> {
      if (ayahIds.length === 0) return [];
      const rows = unwrap(
        'quran.getTranslations',
        await db
          .from('quran_translations')
          .select(`ayah_id, text, translation_editions!inner(${EDITION_FIELDS}, is_default)`)
          .in('ayah_id', ayahIds)
          .eq('translation_editions.language', language)
          .in('translation_editions.approval_status', ['approved', 'approximate'])
      );

      const best = new Map<number, (typeof rows)[number]>();
      for (const row of rows) {
        const current = best.get(row.ayah_id);
        if (!current || (row.translation_editions.is_default && !current.translation_editions.is_default)) {
          best.set(row.ayah_id, row);
        }
      }
      return [...best.values()].map(({ ayah_id, text, translation_editions: { is_default: _d, ...edition } }) => ({
        ayahId: ayah_id,
        text,
        edition,
      }));
    },

    // ---- ingestion helpers (service client only) -------------------------------------------

    async upsertSurahs(rows: TablesInsert<'quran_surahs'>[]): Promise<void> {
      if (rows.length === 0) return;
      unwrap('quran.upsertSurahs', await db.from('quran_surahs').upsert(rows, { onConflict: 'number' }).select('number'));
    },

    async upsertAyahs(rows: TablesInsert<'quran_ayahs'>[]): Promise<number> {
      if (rows.length === 0) return 0;
      const data = unwrap(
        'quran.upsertAyahs',
        await db.from('quran_ayahs').upsert(rows, { onConflict: 'surah_number,ayah_number' }).select('id')
      );
      return data.length;
    },

    async upsertTranslations(rows: TablesInsert<'quran_translations'>[]): Promise<number> {
      if (rows.length === 0) return 0;
      const data = unwrap(
        'quran.upsertTranslations',
        await db.from('quran_translations').upsert(rows, { onConflict: 'ayah_id,edition_id' }).select('id')
      );
      return data.length;
    },
  };
}
