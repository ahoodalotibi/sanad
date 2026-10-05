/**
 * Where extracted material is written: the existing SANAD tables
 * (languages, sources, documents, knowledge_chunks, terms, term_translations).
 * Everything is inserted as `draft` / `pending_review` — nothing becomes visible to users
 * until a reviewer publishes it.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface LanguageRow {
  code: string;
  name_en: string;
  native_name: string;
  direction: 'ltr' | 'rtl';
}

export interface SourceRow {
  slug: string;
  name_ar: string;
  name_en: string | null;
  domain: 'dawah_content' | 'quran' | 'tafseer' | 'hadith' | 'aqeedah' | 'fiqh' | 'seerah_history' | 'shubuhat_faq' | 'terminology';
  base_url: string;
  usage_rule_ar: string | null;
  reference_section: string | null;
  is_primary_reference: boolean;
}

export interface DocumentInput {
  source_id: string;
  title: string;
  language: string;
  canonical_url: string;
  external_ref: string;
  content_sha256: string;
  license_note: string | null;
  metadata: Record<string, unknown>;
}

export interface ChunkInput {
  chunk_index: number;
  language: string;
  content_type: 'qa' | 'terminology' | 'dawah' | 'aqeedah' | 'fiqh' | 'hadith_text' | 'hadith_explanation';
  heading: string | null;
  content: string;
  metadata: Record<string, unknown>;
}

export type DocumentAction = 'inserted' | 'updated' | 'unchanged' | 'kept_reviewed';

export interface IngestStore {
  ensureLanguages(rows: LanguageRow[]): Promise<number>;
  upsertSource(row: SourceRow): Promise<string>;
  /** Inserts or refreshes a draft document. Reviewed/published documents are never overwritten. */
  upsertDocument(doc: DocumentInput): Promise<{ id: string; action: DocumentAction }>;
  /** Replaces a document's chunks; returns the new chunk ids in chunk order. */
  replaceChunks(documentId: string, chunks: ChunkInput[]): Promise<string[]>;
  upsertTerm(t: { slug: string; term_ar: string; definition_ar: string | null; source_id: string }): Promise<{ id: string } | { conflict: string }>;
  upsertTermTranslation(t: { term_id: string; language: string; equivalent: string; usage_note: string | null; source_id: string }): Promise<'ok' | 'exists' | { conflict: string }>;
  upsertHadithCollection(c: HadithCollectionInput): Promise<string>;
  /** Matched on (collection, hadith_number). */
  upsertHadith(h: HadithInput): Promise<string>;
  /** Matched on slug. New editions start as pending_review and are never set as default here. */
  upsertTranslationEdition(e: EditionInput): Promise<string>;
  upsertHadithTranslation(t: { hadith_id: string; edition_id: string; text: string }): Promise<void>;
  /** Links a chunk to the hadith it is about, so answers render the hadith from the hadith tables. */
  linkChunkToHadith(chunkId: string, hadithId: string): Promise<void>;
}

export interface HadithCollectionInput {
  slug: string;
  name_ar: string;
  name_en: string | null;
  source_id: string;
  is_canonical_sahih: boolean;
}

export interface HadithInput {
  collection_id: string;
  hadith_number: string;
  sort_key: number | null;
  text_ar: string;
  grade: 'sahih' | 'hasan' | 'daif' | 'mawdu' | 'no_basis' | 'unknown';
  grade_text_ar: string | null;
  graded_by: string | null;
  takhrij_ar: string | null;
  external_ref: string;
  source_document_id: string;
}

export interface EditionInput {
  slug: string;
  kind: 'hadith' | 'quran';
  language: string;
  name: string;
  translator: string | null;
  publisher: string | null;
  source_id: string;
  notes: string | null;
}

const RTL = new Set(['ar', 'ur', 'fa', 'ps', 'ug', 'ckb', 'ku', 'dv', 'he', 'sd', 'yi', 'prs']);
export const directionOf = (code: string): 'ltr' | 'rtl' => (RTL.has(code.split('-')[0]) ? 'rtl' : 'ltr');

/**
 * Builds a languages row from a link label published by the source, e.g. "الإنجليزية English",
 * "الأردية اردو": the first word is the Arabic name, the rest the native name.
 */
export function languageFromLabel(code: string, label: string): LanguageRow {
  const clean = label.replace(/\s+/g, ' ').trim();
  const space = clean.indexOf(' ');
  const native = space > 0 ? clean.slice(space + 1).trim() : clean;
  const english = /^[\p{Script=Latin} ()'-]+$/u.test(native) ? native : code;
  return { code, name_en: english || code, native_name: native || code, direction: directionOf(code) };
}

// ---------------------------------------------------------------------------
// Supabase implementation (service role; server-side scripts only)
// ---------------------------------------------------------------------------
export function createSupabaseIngestStore(url: string, secretKey: string): IngestStore {
  const db: SupabaseClient = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const fail = (op: string, error: { message: string } | null) => {
    if (error) throw new Error(`${op}: ${error.message}`);
  };

  return {
    async ensureLanguages(rows) {
      if (!rows.length) return 0;
      // ignoreDuplicates: existing languages (and their UI flags) are left exactly as they are
      const { error } = await db.from('languages').upsert(rows, { onConflict: 'code', ignoreDuplicates: true });
      fail('languages', error);
      return rows.length;
    },

    async upsertSource(row) {
      const { data, error } = await db.from('sources').upsert(row, { onConflict: 'slug' }).select('id').single();
      fail('sources', error);
      return (data as { id: string }).id;
    },

    async upsertDocument(doc) {
      const { data: existing, error: e1 } = await db
        .from('documents')
        .select('id, content_sha256, publication_status')
        .eq('source_id', doc.source_id)
        .eq('external_ref', doc.external_ref)
        .maybeSingle();
      fail('documents.select', e1);
      if (existing) {
        const ex = existing as { id: string; content_sha256: string | null; publication_status: string };
        if (ex.content_sha256 === doc.content_sha256) return { id: ex.id, action: 'unchanged' };
        if (ex.publication_status !== 'draft') return { id: ex.id, action: 'kept_reviewed' };
        const { error } = await db.from('documents').update({ ...doc }).eq('id', ex.id);
        fail('documents.update', error);
        return { id: ex.id, action: 'updated' };
      }
      const { data, error } = await db.from('documents').insert({ ...doc, publication_status: 'draft' }).select('id').single();
      fail('documents.insert', error);
      return { id: (data as { id: string }).id, action: 'inserted' };
    },

    async replaceChunks(documentId, chunks) {
      const { error: e1 } = await db.from('knowledge_chunks').delete().eq('document_id', documentId);
      fail('knowledge_chunks.delete', e1);
      if (!chunks.length) return [];
      const { data, error } = await db.from('knowledge_chunks').insert(chunks.map((c) => ({ ...c, document_id: documentId }))).select('id, chunk_index');
      fail('knowledge_chunks.insert', error);
      return ((data ?? []) as Array<{ id: string; chunk_index: number }>).sort((a, b) => a.chunk_index - b.chunk_index).map((r) => r.id);
    },

    async upsertHadithCollection(c) {
      const { data, error } = await db.from('hadith_collections').upsert(c, { onConflict: 'slug' }).select('id').single();
      fail('hadith_collections', error);
      return (data as { id: string }).id;
    },

    async upsertHadith(h) {
      const { data, error } = await db.from('hadiths').upsert(h, { onConflict: 'collection_id,hadith_number' }).select('id').single();
      fail('hadiths', error);
      return (data as { id: string }).id;
    },

    async upsertTranslationEdition(e) {
      const { data: existing, error: e1 } = await db.from('translation_editions').select('id').eq('slug', e.slug).maybeSingle();
      fail('translation_editions.select', e1);
      if (existing) return (existing as { id: string }).id;
      const { data, error } = await db.from('translation_editions').insert({ ...e, approval_status: 'pending_review', is_default: false }).select('id').single();
      fail('translation_editions.insert', error);
      return (data as { id: string }).id;
    },

    async upsertHadithTranslation(t) {
      const { error } = await db.from('hadith_translations').upsert({ ...t, edition_kind: 'hadith' }, { onConflict: 'hadith_id,edition_id' });
      fail('hadith_translations', error);
    },

    async linkChunkToHadith(chunkId, hadithId) {
      const { error } = await db.from('chunk_references').insert({ chunk_id: chunkId, hadith_id: hadithId });
      if (error && !/duplicate key/.test(error.message)) fail('chunk_references', error);
    },

    async upsertTerm(t) {
      const { data: bySlug, error: e1 } = await db.from('terms').select('id').eq('slug', t.slug).maybeSingle();
      fail('terms.select', e1);
      if (bySlug) {
        const { error } = await db.from('terms').update({ term_ar: t.term_ar, definition_ar: t.definition_ar }).eq('id', (bySlug as { id: string }).id).eq('publication_status', 'draft');
        if (error && /duplicate key/.test(error.message)) return { conflict: `Arabic term already imported under another entry: ${t.term_ar}` };
        fail('terms.update', error);
        return { id: (bySlug as { id: string }).id };
      }
      const { data, error } = await db.from('terms').insert({ ...t, publication_status: 'draft' }).select('id').single();
      if (error && /duplicate key/.test(error.message)) return { conflict: `Arabic term already imported under another entry: ${t.term_ar}` };
      fail('terms.insert', error);
      return { id: (data as { id: string }).id };
    },

    async upsertTermTranslation(t) {
      const { data: same, error: e1 } = await db.from('term_translations').select('id').eq('term_id', t.term_id).eq('language', t.language).eq('equivalent', t.equivalent).maybeSingle();
      fail('term_translations.select', e1);
      if (same) return 'exists';
      const { data: preferred } = await db.from('term_translations').select('id').eq('term_id', t.term_id).eq('language', t.language).eq('is_preferred', true).maybeSingle();
      const { error } = await db.from('term_translations').insert({ ...t, is_preferred: !preferred, approval_status: 'pending_review' });
      if (error && /duplicate key/.test(error.message)) return { conflict: `translation already present: ${t.language} ${t.equivalent}` };
      fail('term_translations.insert', error);
      return 'ok';
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory implementation (tests and --dry runs)
// ---------------------------------------------------------------------------
export function createMemoryIngestStore() {
  let n = 0;
  const id = () => `id-${++n}`;
  const state = {
    languages: new Map<string, LanguageRow>(),
    sources: new Map<string, SourceRow & { id: string }>(),
    documents: new Map<string, DocumentInput & { id: string; publication_status: string }>(),
    chunks: new Map<string, ChunkInput[]>(),
    terms: new Map<string, { id: string; slug: string; term_ar: string; definition_ar: string | null; source_id: string }>(),
    termTranslations: [] as Array<{ term_id: string; language: string; equivalent: string; is_preferred: boolean }>,
    collections: new Map<string, HadithCollectionInput & { id: string }>(),
    hadiths: new Map<string, HadithInput & { id: string }>(),
    editions: new Map<string, EditionInput & { id: string; approval_status: string }>(),
    hadithTranslations: new Map<string, { hadith_id: string; edition_id: string; text: string }>(),
    chunkRefs: [] as Array<{ chunk_id: string; hadith_id: string }>,
  };
  const store: IngestStore = {
    async ensureLanguages(rows) {
      for (const r of rows) if (!state.languages.has(r.code)) state.languages.set(r.code, r);
      return rows.length;
    },
    async upsertSource(row) {
      const ex = state.sources.get(row.slug);
      const rec = { ...row, id: ex?.id ?? id() };
      state.sources.set(row.slug, rec);
      return rec.id;
    },
    async upsertDocument(doc) {
      const key = `${doc.source_id}|${doc.external_ref}`;
      const ex = state.documents.get(key);
      if (ex) {
        if (ex.content_sha256 === doc.content_sha256) return { id: ex.id, action: 'unchanged' };
        if (ex.publication_status !== 'draft') return { id: ex.id, action: 'kept_reviewed' };
        state.documents.set(key, { ...ex, ...doc });
        return { id: ex.id, action: 'updated' };
      }
      if ([...state.documents.values()].some((d) => d.content_sha256 === doc.content_sha256)) throw new Error('documents.insert: duplicate content_sha256');
      const rec = { ...doc, id: id(), publication_status: 'draft' };
      state.documents.set(key, rec);
      return { id: rec.id, action: 'inserted' };
    },
    async replaceChunks(documentId, chunks) {
      state.chunks.set(documentId, chunks);
      return chunks.map((c) => `${documentId}#${c.chunk_index}`);
    },
    async upsertHadithCollection(c) {
      const rec = { ...c, id: state.collections.get(c.slug)?.id ?? id() };
      state.collections.set(c.slug, rec);
      return rec.id;
    },
    async upsertHadith(h) {
      const key = `${h.collection_id}|${h.hadith_number}`;
      const rec = { ...h, id: state.hadiths.get(key)?.id ?? id() };
      state.hadiths.set(key, rec);
      return rec.id;
    },
    async upsertTranslationEdition(e) {
      const ex = state.editions.get(e.slug);
      if (ex) return ex.id;
      const rec = { ...e, id: id(), approval_status: 'pending_review' };
      state.editions.set(e.slug, rec);
      return rec.id;
    },
    async upsertHadithTranslation(t) {
      state.hadithTranslations.set(`${t.hadith_id}|${t.edition_id}`, t);
    },
    async linkChunkToHadith(chunkId, hadithId) {
      if (!state.chunkRefs.some((r) => r.chunk_id === chunkId && r.hadith_id === hadithId)) state.chunkRefs.push({ chunk_id: chunkId, hadith_id: hadithId });
    },
    async upsertTerm(t) {
      const bySlug = state.terms.get(t.slug);
      const clash = [...state.terms.values()].find((x) => x.term_ar === t.term_ar && x.slug !== t.slug);
      if (clash) return { conflict: `Arabic term already imported under another entry: ${t.term_ar}` };
      const rec = { ...t, id: bySlug?.id ?? id() };
      state.terms.set(t.slug, rec);
      return { id: rec.id };
    },
    async upsertTermTranslation(t) {
      if (state.termTranslations.some((x) => x.term_id === t.term_id && x.language === t.language && x.equivalent === t.equivalent)) return 'exists';
      const preferred = state.termTranslations.some((x) => x.term_id === t.term_id && x.language === t.language && x.is_preferred);
      state.termTranslations.push({ ...t, is_preferred: !preferred });
      return 'ok';
    },
  };
  return { store, state };
}
