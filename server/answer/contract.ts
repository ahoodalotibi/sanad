/**
 * The contract between the answer path and the interface (POST /api/ask).
 *
 * Every piece of religious text in a response comes from the corpus (the approved sources),
 * never from a model. The server returns codes for fixed messages; the interface renders them in
 * the asker's language. The only model-written text is a clarification question that restates the
 * user's own question — never a religious statement.
 */

export interface AskTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AskRequest {
  question: string;
  /** Interface language, used when the question's language cannot be detected */
  uiLanguage?: string;
  /** Previous turns of this conversation (for clarifications) */
  history?: AskTurn[];
  /** How many clarifications were already asked for this question */
  clarifications?: number;
}

export type ReferReason =
  | 'personal_case' // personal situation / needs a fatwa → a daee, by policy
  | 'not_found' // no approved material answers it
  | 'out_of_scope' // outside the platform's scope
  | 'unclear' // still unclear after clarifications
  | 'user_request'; // the asker asked for a person

export interface SourceRef {
  name: string;
  url: string;
}

export interface HadithAnswer {
  type: 'hadith';
  id: string;
  /** Hadith text in the asker's language when the source publishes it, otherwise Arabic */
  text: string;
  textLanguage: string;
  arabic: string;
  grade: string; // as published, e.g. "صحيح"
  takhrij: string | null; // e.g. "رواه مسلم"
  explanation: string | null;
  explanationLanguage: string | null;
  wordMeanings: Array<{ word: string; meaning: string }>;
  /** 'source' = published translation in the asker's language; 'alternative' = another published translation; 'none' = Arabic only */
  translation: 'source' | 'alternative' | 'none';
  source: SourceRef;
}

export interface QaAnswer {
  type: 'qa';
  id: string;
  language: string;
  question: string;
  shortAnswer: string;
  detailedAnswer: string;
  translation: 'source' | 'alternative' | 'none';
  source: SourceRef;
  relatedBook?: SourceRef;
}

export interface TermAnswer {
  type: 'term';
  id: string;
  language: string;
  term: string;
  arabicTerm: string;
  definitions: Array<{ label: string; text: string }>;
  translation: 'source' | 'alternative' | 'none';
  source: SourceRef;
}

export type AnswerItem = HadithAnswer | QaAnswer | TermAnswer;

export type AskResponse =
  | { kind: 'answer'; language: string; items: AnswerItem[]; offerReferral: boolean }
  | { kind: 'clarify'; language: string; question: string; options: string[] }
  | { kind: 'refer'; language: string; reason: ReferReason }
  | { kind: 'greeting'; language: string };
