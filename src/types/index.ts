/**
 * Core Data Models for SANAD | سَنَد Platform
 * Compliant with the Scientific Reference Document & Brand Identity
 */

export type SupportedLanguage = 'en' | 'ur' | 'bn';

export type ContentLevel = 'A' | 'B' | 'C' | 'D';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  flag: string;
}

export type SourceCategory = 
  | 'quran'
  | 'hadith'
  | 'tafseer'
  | 'aqeedah'
  | 'fiqh'
  | 'seerah'
  | 'dawa_center'
  | 'dictionary';

export interface VerifiedSource {
  id: string;
  name: string;
  nameAr: string;
  category: SourceCategory;
  publisher: string;
  url: string;
  isVerified: boolean;
  notes?: string;
}

export interface Citation {
  sourceName: string;
  sourceCategory: SourceCategory;
  reference: string; // e.g. "Surah Al-Baqarah 2:256", "Sahih al-Bukhari #1"
  hadithGrade?: 'صحيح (Sahih)' | 'حسن (Hasan)' | 'متفق عليه (Muttafaq Alayh)' | 'موقوف' | string;
  hadithScholar?: string;
  url?: string;
}

export interface TerminologyItem {
  id: string;
  termAr: string;
  termEn: string;
  termUr: string;
  termBn: string;
  guidelineAr: string;
  guidelineEn: string;
  contextNote: string;
}

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  sourceName: string;
  category: SourceCategory;
  contentLevel: ContentLevel;
  keywords: string[];
  arabicScripture?: string;
  englishTranslation?: string;
  urduTranslation?: string;
  bengaliTranslation?: string;
  explanationEn: string;
  explanationUr: string;
  explanationBn: string;
  reference: string;
  hadithGrade?: string;
  hadithScholar?: string;
  url?: string;
}

export interface SanadResponse {
  answerText: string;
  scriptureOriginal?: string;
  translationApproved?: string;
  aiExplanation?: string;
  contentLevel: ContentLevel;
  contentLevelTitle: string;
  citations: Citation[];
  isOutOfScope: boolean;
  isSpecialistHandoffNeeded: boolean;
  handoffReason?: 'personal_fatwa' | 'sensitive_dispute' | 'low_confidence_unverified' | 'out_of_scope';
  confidenceScore: number;
  /** Whether `translationApproved` comes from an approved edition or is an approximate rendering of meaning. */
  translationStatus?: 'approved' | 'approximate';
  /** Which engine produced the answer: the server RAG pipeline or the legacy local demo engine. */
  engine?: 'rag' | 'legacy';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'sanad';
  text: string;
  inputType?: 'text' | 'voice';
  audioBlobUrl?: string;
  timestamp: Date;
  responseDetails?: SanadResponse;
  /** UI-only: set when the answer could not be retrieved, so the question can be retried. */
  status?: 'error';
  retryQuery?: string;
}

export interface SpecialistTicket {
  id: string;
  userQuery: string;
  language: SupportedLanguage;
  handoffReason: 'personal_fatwa' | 'sensitive_dispute' | 'low_confidence_unverified' | 'out_of_scope';
  summary: string;
  consultedSources: string[];
  status: 'pending' | 'assigned' | 'resolved';
  createdAt: string;
  specialistNotes?: string;
}

export interface BenchmarkTestCase {
  id: string;
  title: string;
  questionEn: string;
  questionUr: string;
  questionBn: string;
  expectedBehaviorAr: string;
  expectedBehaviorEn: string;
  targetTier: ContentLevel;
  category: string;
}
