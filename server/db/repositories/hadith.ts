import type { SanadDbClient } from '../client.ts';
import { unwrap, unwrapMaybe } from '../errors.ts';
import type { Hadith, HadithCollection, LanguageCode, TablesInsert, TranslationWithEdition } from '../types.ts';

export interface HadithWithCollection extends Hadith {
  hadith_collections: Pick<HadithCollection, 'slug' | 'name_ar' | 'name_en' | 'is_canonical_sahih'>;
}

export interface HadithTranslation extends TranslationWithEdition {
  hadithId: string;
}

const WITH_COLLECTION = '*, hadith_collections!inner(slug, name_ar, name_en, is_canonical_sahih)';

export function createHadithRepository(db: SanadDbClient) {
  return {
    async listCollections(): Promise<HadithCollection[]> {
      return unwrap('hadith.listCollections', await db.from('hadith_collections').select('*').order('sort_order'));
    },

    async getCollectionBySlug(slug: string): Promise<HadithCollection | null> {
      return unwrapMaybe(
        'hadith.getCollectionBySlug',
        await db.from('hadith_collections').select('*').eq('slug', slug).maybeSingle()
      );
    },

    /** Exact lookup by collection + number, e.g. ('bukhari', '1'). */
    async getByNumber(collectionSlug: string, hadithNumber: string): Promise<HadithWithCollection | null> {
      return unwrapMaybe(
        'hadith.getByNumber',
        await db
          .from('hadiths')
          .select(WITH_COLLECTION)
          .eq('hadith_collections.slug', collectionSlug)
          .eq('hadith_number', hadithNumber)
          .maybeSingle()
      );
    },

    async getByIds(ids: string[]): Promise<HadithWithCollection[]> {
      if (ids.length === 0) return [];
      return unwrap('hadith.getByIds', await db.from('hadiths').select(WITH_COLLECTION).in('id', ids));
    },

    /** Usable (approved/approximate) translations; prefers the default edition. */
    async getTranslations(hadithIds: string[], language: LanguageCode): Promise<HadithTranslation[]> {
      if (hadithIds.length === 0) return [];
      const rows = unwrap(
        'hadith.getTranslations',
        await db
          .from('hadith_translations')
          .select('hadith_id, text, translation_editions!inner(id, slug, name, translator, language, approval_status, is_default)')
          .in('hadith_id', hadithIds)
          .eq('translation_editions.language', language)
          .in('translation_editions.approval_status', ['approved', 'approximate'])
      );

      const best = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        const current = best.get(row.hadith_id);
        if (!current || (row.translation_editions.is_default && !current.translation_editions.is_default)) {
          best.set(row.hadith_id, row);
        }
      }
      return [...best.values()].map(({ hadith_id, text, translation_editions: { is_default: _d, ...edition } }) => ({
        hadithId: hadith_id,
        text,
        edition,
      }));
    },

    // ---- ingestion helpers (service client only) -------------------------------------------

    async upsertCollections(rows: TablesInsert<'hadith_collections'>[]): Promise<HadithCollection[]> {
      if (rows.length === 0) return [];
      return unwrap('hadith.upsertCollections', await db.from('hadith_collections').upsert(rows, { onConflict: 'slug' }).select('*'));
    },

    async upsertHadiths(rows: TablesInsert<'hadiths'>[]): Promise<Hadith[]> {
      if (rows.length === 0) return [];
      return unwrap(
        'hadith.upsertHadiths',
        await db.from('hadiths').upsert(rows, { onConflict: 'collection_id,hadith_number' }).select('*')
      );
    },

    async upsertTranslations(rows: TablesInsert<'hadith_translations'>[]): Promise<number> {
      if (rows.length === 0) return 0;
      const data = unwrap(
        'hadith.upsertTranslations',
        await db.from('hadith_translations').upsert(rows, { onConflict: 'hadith_id,edition_id' }).select('id')
      );
      return data.length;
    },
  };
}
