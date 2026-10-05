/**
 * Accounts & referrals (stage 7 of the plan):
 *   - an asker signs in (email one-time code) and sends a question to a daee who speaks their language;
 *   - «أسئلتي» lists the asker's referrals and the daee's reply;
 *   - the association portal shows each daee only the open questions in their languages;
 *   - an admin adds daees and sets their languages.
 *
 * The server does every database write with the server-side key after verifying the user's session,
 * so a browser can never act outside these rules. RLS stays on as a second line of defence.
 * Requesters' identities are never shown to daees.
 */
import type { ReferReason } from '../answer/contract.ts';

export type Role = 'admin' | 'reviewer';
export type ReferralStatus = 'pending' | 'assigned' | 'in_review' | 'answered' | 'closed' | 'cancelled';
export type DbHandoffReason = 'personal_fatwa' | 'sensitive_dispute' | 'low_confidence' | 'unverified_hadith' | 'out_of_scope' | 'user_request';

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface Specialist {
  id: string;
  userId: string;
  email: string | null;
  displayName: string;
  languages: string[];
  isActive: boolean;
}

export interface Profile {
  roles: Role[];
  specialist: Specialist | null;
}

/** What the asker sees in «أسئلتي». */
export interface MyReferral {
  id: string;
  reference: string;
  question: string;
  language: string;
  status: ReferralStatus;
  response: string | null;
  daeeName: string | null;
  createdAt: string;
  answeredAt: string | null;
}

/** What a daee sees: the question only — never who asked it. */
export interface QueueItem {
  id: string;
  reference: string;
  question: string;
  language: string;
  reason: DbHandoffReason;
  status: ReferralStatus;
  response: string | null;
  createdAt: string;
  assignedToMe: boolean;
}

export interface NewReferral {
  userId: string;
  question: string;
  language: string;
  reason: DbHandoffReason;
  /** Earlier turns of the same question (the asker's own words), shown to the daee as context. */
  context: string | null;
}

export interface SpecialistInput {
  email: string;
  displayName: string;
  languages: string[];
  isActive?: boolean;
}

export interface AccountsStore {
  verifyToken(token: string): Promise<AuthUser | null>;
  getProfile(userId: string): Promise<Profile>;
  ensureLanguage(code: string): Promise<void>;

  createReferral(input: NewReferral): Promise<MyReferral>;
  listMyReferrals(userId: string): Promise<MyReferral[]>;
  cancelReferral(userId: string, id: string): Promise<MyReferral | null>;

  listQueue(specialist: Specialist): Promise<QueueItem[]>;
  claim(specialist: Specialist, id: string): Promise<QueueItem | null>;
  release(specialist: Specialist, id: string): Promise<QueueItem | null>;
  answer(specialist: Specialist, id: string, response: string): Promise<QueueItem | null>;

  listSpecialists(): Promise<Specialist[]>;
  upsertSpecialist(input: SpecialistInput): Promise<Specialist>;
  updateSpecialist(id: string, patch: { displayName?: string; languages?: string[]; isActive?: boolean }): Promise<Specialist | null>;
  grantRole(email: string, role: Role): Promise<AuthUser>;
}

/** The answer path's reasons → the database's handoff reasons. */
export function toHandoffReason(reason: ReferReason | undefined): DbHandoffReason {
  switch (reason) {
    case 'personal_case':
      return 'personal_fatwa';
    case 'out_of_scope':
      return 'out_of_scope';
    case 'user_request':
      return 'user_request';
    default:
      return 'low_confidence'; // not_found / unclear
  }
}

const RTL = new Set(['ar', 'ur', 'fa', 'he', 'ps', 'ku', 'ckb', 'sd', 'ug', 'dv', 'yi']);
export const directionOf = (code: string) => (RTL.has(code.split('-')[0]) ? 'rtl' : 'ltr');

/** English and native names for a language code (used when a new language first appears). */
export function languageNames(code: string): { nameEn: string; native: string } {
  const safe = (locale: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  return { nameEn: safe('en'), native: safe(code) };
}

export const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/;
