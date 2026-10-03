/**
 * Maps a SanadResponse (from the existing engine) to the UI state that should render it.
 * Pure function so the mapping is unit-tested and the UI never re-implements the rules.
 */
import type { SanadResponse } from '../types';

export type AnswerState =
  | 'answer'        // evidence-backed answer (may still suggest a specialist)
  | 'no_answer'     // nothing reliable found — offer a specialist instead of guessing
  | 'handoff'       // Level D personal matter — no ruling, specialist referral
  | 'out_of_scope'; // not an Islamic-knowledge question

export function classifyResponse(response: SanadResponse): AnswerState {
  if (response.isOutOfScope) return 'out_of_scope';
  if (response.handoffReason === 'personal_fatwa' || response.contentLevel === 'D') return 'handoff';
  if (response.citations.length === 0 && !response.scriptureOriginal) return 'no_answer';
  return 'answer';
}

/** Whether an answer should end with a "talk to a specialist" prompt. */
export function suggestsSpecialist(response: SanadResponse): boolean {
  return response.isSpecialistHandoffNeeded && classifyResponse(response) === 'answer';
}
