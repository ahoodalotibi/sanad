/** Server-side refusal texts, taken from the same interface copy the UI uses (one source of truth). */
import type { SupportedLanguage } from '../../src/types/index.ts';
import { STRINGS } from '../../src/i18n/strings.ts';

export function refusalMessage(lang: SupportedLanguage, kind: 'no_reliable_answer' | 'handoff' | 'out_of_scope'): string {
  const s = STRINGS[lang].chat.states;
  switch (kind) {
    case 'no_reliable_answer':
      return `${s.noAnswerTitle}. ${s.noAnswerBody}`;
    case 'handoff':
      return s.handoffBody;
    case 'out_of_scope':
      return s.outOfScopeBody;
  }
}
