/**
 * Frontend tests that need no browser: translation completeness, answer-state rules,
 * routing, and a server-side render of every page and chat state in every language.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { ChatPage } from '../../src/components/chat/ChatPage';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { directionOf, LANGUAGES } from '../../src/i18n/languages';
import { STRINGS } from '../../src/i18n/strings';
import { classifyResponse, suggestsSpecialist } from '../../src/lib/answerState';
import { parseRoute } from '../../src/lib/useHashRoute';
import type { ChatMessage, SanadResponse, SupportedLanguage } from '../../src/types';

const LANGS: SupportedLanguage[] = ['en', 'ur', 'bn'];

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (Array.isArray(value)) return value.flatMap((v, i) => leafPaths(v, `${prefix}[${i}]`));
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}

function valueAt(obj: unknown, path: string): unknown {
  return path.split(/\.|\[|\]/).filter(Boolean).reduce<any>((o, k) => o?.[k], obj);
}

describe('translations', () => {
  const english = leafPaths(STRINGS.en).sort();

  it.each(['ur', 'bn'] as const)('%s defines every English key with non-empty text', (lang) => {
    expect(leafPaths(STRINGS[lang]).sort()).toEqual(english);
    for (const path of english) {
      const text = valueAt(STRINGS[lang], path);
      expect(typeof text === 'string' && text.trim().length > 0, `${lang}.${path}`).toBe(true);
    }
  });

  it('actually translates interface text (not copied English)', () => {
    const same = english.filter((p) => valueAt(STRINGS.ur, p) === valueAt(STRINGS.en, p) && p !== 'brand.sloganAr');
    expect(same).toEqual([]);
  });

  it('uses RTL for Urdu and LTR for English and Bengali', () => {
    expect(directionOf('ur')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('bn')).toBe('ltr');
    expect(LANGUAGES.map((l) => l.code)).toEqual(LANGS);
  });
});

const base: SanadResponse = {
  answerText: 'answer',
  contentLevel: 'A',
  contentLevelTitle: '',
  citations: [{ sourceName: 'Test source', sourceCategory: 'quran', reference: 'ref 1' }],
  isOutOfScope: false,
  isSpecialistHandoffNeeded: false,
  confidenceScore: 0.9,
};

describe('classifyResponse', () => {
  it('maps engine responses to UI states', () => {
    expect(classifyResponse(base)).toBe('answer');
    expect(classifyResponse({ ...base, isOutOfScope: true })).toBe('out_of_scope');
    expect(classifyResponse({ ...base, contentLevel: 'D', handoffReason: 'personal_fatwa', isSpecialistHandoffNeeded: true })).toBe('handoff');
    expect(classifyResponse({ ...base, citations: [], isSpecialistHandoffNeeded: true, handoffReason: 'low_confidence_unverified' })).toBe('no_answer');
  });

  it('never shows an answer without evidence', () => {
    // e.g. a generated reply with no citations and no scripture must become "no reliable answer"
    expect(classifyResponse({ ...base, citations: [], answerText: 'unsupported text' })).toBe('no_answer');
  });

  it('offers a specialist after an evidence-backed answer only when the engine asks for it', () => {
    expect(suggestsSpecialist(base)).toBe(false);
    expect(suggestsSpecialist({ ...base, isSpecialistHandoffNeeded: true, handoffReason: 'low_confidence_unverified' })).toBe(true);
  });
});

describe('routing', () => {
  it('parses hash routes', () => {
    expect(parseRoute('')).toBe('home');
    expect(parseRoute('#/')).toBe('home');
    expect(parseRoute('#/ask')).toBe('ask');
    expect(parseRoute('#ask?x=1')).toBe('ask');
    expect(parseRoute('#/unknown')).toBe('home');
  });
});

const noop = () => {};

function renderChat(lang: SupportedLanguage, messages: ChatMessage[], isLoading = false) {
  return renderToString(
    <I18nProvider initialLang={lang}>
      <ChatPage messages={messages} isLoading={isLoading} onSend={noop} onRetry={noop} onRequestSpecialist={noop} autoSpeak={false} onToggleAutoSpeak={noop} />
    </I18nProvider>
  );
}

const q = (text: string): ChatMessage => ({ id: `u-${text}`, sender: 'user', text, timestamp: new Date(0) });
const a = (response: SanadResponse, id: string): ChatMessage => ({ id, sender: 'sanad', text: response.answerText, timestamp: new Date(0), responseDetails: response });

describe.each(LANGS)('rendering (%s)', (lang) => {
  const t = STRINGS[lang];

  it('renders the home page', () => {
    const html = renderToString(
      <I18nProvider initialLang={lang}>
        <App />
      </I18nProvider>
    );
    expect(html).toContain(t.home.heroTitle.replace(/'/g, '&#x27;'));
    expect(html).toContain('/brand/sanad-logo');
  });

  it('renders the empty, loading and every answer state', () => {
    expect(renderChat(lang, [])).toContain(t.chat.emptyTitle.replace(/'/g, '&#x27;'));
    expect(renderChat(lang, [q('x')], true)).toContain(t.chat.loading);

    const html = renderChat(lang, [
      q('one'),
      a({ ...base, scriptureOriginal: 'نص تجريبي', translationApproved: 'test translation' }, 'a1'),
      q('two'),
      a({ ...base, citations: [], isSpecialistHandoffNeeded: true, handoffReason: 'low_confidence_unverified' }, 'a2'),
      q('three'),
      a({ ...base, contentLevel: 'D', handoffReason: 'personal_fatwa', isSpecialistHandoffNeeded: true }, 'a3'),
      q('four'),
      a({ ...base, isOutOfScope: true }, 'a4'),
      q('five'),
      { id: 'err', sender: 'sanad', text: '', timestamp: new Date(0), status: 'error', retryQuery: 'five' },
    ]);
    const escape = (s: string) => s.replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
    for (const expected of [t.chat.original, t.chat.translation, t.chat.sources, t.chat.states.noAnswerTitle, t.chat.states.handoffTitle, t.chat.states.outOfScopeTitle, t.chat.states.errorTitle]) {
      expect(html, expected).toContain(escape(expected));
    }
    expect(html).toContain('lang="ar"'); // scripture is always marked as Arabic
  });
});
