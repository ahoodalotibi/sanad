/**
 * Convenience aliases over the generated Database types.
 * Regenerate database.types.ts with `npm run db:types` after every migration.
 */
import type { Database, Enums, Json, Tables, TablesInsert } from './database.types.ts';

export type { Database, Enums, Json, Tables, TablesInsert };

export type LanguageCode = string; // FK to languages.code — extensible without migrations
export type ContentLevel = Enums<'content_level'>;
export type SourceDomain = Enums<'source_domain'>;
export type ApprovalStatus = Enums<'approval_status'>;
export type PublicationStatus = Enums<'publication_status'>;
export type HadithGrade = Enums<'hadith_grade'>;
export type ChunkContentType = Enums<'chunk_content_type'>;
export type HandoffReason = Enums<'handoff_reason'>;
export type HandoffStatus = Enums<'handoff_status'>;

export type Language = Tables<'languages'>;
export type Source = Tables<'sources'>;
export type DocumentRow = Tables<'documents'>;
export type QuranSurah = Tables<'quran_surahs'>;
export type QuranAyah = Tables<'quran_ayahs'>;
export type TranslationEdition = Tables<'translation_editions'>;
export type HadithCollection = Tables<'hadith_collections'>;
export type Hadith = Tables<'hadiths'>;
export type Term = Tables<'terms'>;
export type TermTranslation = Tables<'term_translations'>;
export type KnowledgeChunk = Tables<'knowledge_chunks'>;
export type ChunkReference = Tables<'chunk_references'>;
export type Conversation = Tables<'conversations'>;
export type Message = Tables<'messages'>;
export type MessageSource = Tables<'message_sources'>;
export type HandoffRequest = Tables<'handoff_requests'>;
export type EvalTestCase = Tables<'eval_test_cases'>;
export type EvalCasePrompt = Tables<'eval_case_prompts'>;
export type EvalRun = Tables<'eval_runs'>;
export type EvalResult = Tables<'eval_results'>;

/** A translation together with its edition's approval status, so the UI can label approximate renderings. */
export interface TranslationWithEdition {
  text: string;
  edition: Pick<TranslationEdition, 'id' | 'slug' | 'name' | 'translator' | 'language' | 'approval_status'>;
}

export const EMBEDDING_DIMENSIONS = 1536;
