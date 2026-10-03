import type { SanadDbClient } from '../client.ts';
import { unwrap, unwrapMaybe } from '../errors.ts';
import { normalizeAlias } from '../normalize.ts';
import type { LanguageCode, TablesInsert, Term, TermTranslation, TranslationEdition } from '../types.ts';

export interface TermWithTranslations extends Term {
  term_translations: Pick<TermTranslation, 'language' | 'equivalent' | 'usage_note' | 'is_preferred' | 'approval_status'>[];
}

const WITH_TRANSLATIONS = '*, term_translations(language, equivalent, usage_note, is_preferred, approval_status)';

export function createTerminologyRepository(db: SanadDbClient) {
  return {
    async getBySlug(slug: string): Promise<TermWithTranslations | null> {
      return unwrapMaybe('terms.getBySlug', await db.from('terms').select(WITH_TRANSLATIONS).eq('slug', slug).maybeSingle());
    },

    /** Published terms with their approved/approximate equivalents in one language. */
    async listPublished(language?: LanguageCode): Promise<TermWithTranslations[]> {
      let query = db.from('terms').select(WITH_TRANSLATIONS).eq('publication_status', 'published').order('slug');
      if (language) query = query.eq('term_translations.language', language);
      return unwrap('terms.listPublished', await query);
    },

    /** Finds term ids whose alias (any language) matches the given text after normalisation. */
    async findTermIdsByAlias(alias: string): Promise<string[]> {
      const normalized = normalizeAlias(alias);
      if (!normalized) return [];
      const rows = unwrap(
        'terms.findTermIdsByAlias',
        await db.from('term_aliases').select('term_id').eq('alias_normalized', normalized)
      );
      return [...new Set(rows.map((r) => r.term_id))];
    },

    // ---- ingestion helpers (service client only) -------------------------------------------

    async upsertTerms(rows: TablesInsert<'terms'>[]): Promise<Term[]> {
      if (rows.length === 0) return [];
      return unwrap('terms.upsertTerms', await db.from('terms').upsert(rows, { onConflict: 'slug' }).select('*'));
    },

    async upsertTranslations(rows: TablesInsert<'term_translations'>[]): Promise<number> {
      if (rows.length === 0) return 0;
      const data = unwrap(
        'terms.upsertTranslations',
        await db.from('term_translations').upsert(rows, { onConflict: 'term_id,language,equivalent' }).select('id')
      );
      return data.length;
    },

    async upsertAliases(rows: TablesInsert<'term_aliases'>[]): Promise<number> {
      if (rows.length === 0) return 0;
      const data = unwrap(
        'terms.upsertAliases',
        await db.from('term_aliases').upsert(rows, { onConflict: 'term_id,language,alias' }).select('id')
      );
      return data.length;
    },
  };
}

export function createEditionsRepository(db: SanadDbClient) {
  return {
    async getBySlug(slug: string): Promise<TranslationEdition | null> {
      return unwrapMaybe(
        'editions.getBySlug',
        await db.from('translation_editions').select('*').eq('slug', slug).maybeSingle()
      );
    },

    async upsert(rows: TablesInsert<'translation_editions'>[]): Promise<TranslationEdition[]> {
      if (rows.length === 0) return [];
      return unwrap('editions.upsert', await db.from('translation_editions').upsert(rows, { onConflict: 'slug' }).select('*'));
    },
  };
}
