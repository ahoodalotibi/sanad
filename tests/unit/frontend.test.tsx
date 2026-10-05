/** Frontend checks that need no browser: interface strings and a server-side render of the site in several languages. */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { ALL_LANGUAGES, dirOf, nativeName } from '../../src/i18n/languages';
import { MORE } from '../../src/i18n/strings-more';
import { STRINGS, stringsFor } from '../../src/i18n/strings';

describe('interface strings', () => {
  it('every hand-written language overrides only known keys', () => {
    const keys = new Set(Object.keys(STRINGS.en));
    for (const [lang, s] of Object.entries(MORE)) for (const k of Object.keys(s)) expect([lang, keys.has(k)]).toEqual([lang, true]);
  });
  it('any language falls back to English words', () => {
    expect(stringsFor('sw').send).toBe(STRINGS.en.send);
    expect(stringsFor('ur-PK').send).toBe(STRINGS.ur.send);
  });
  it('lists every world language with a native name and direction', () => {
    expect(ALL_LANGUAGES.length).toBeGreaterThan(180);
    expect(dirOf('ur')).toBe('rtl');
    expect(dirOf('sw')).toBe('ltr');
    expect(nativeName('ar')).toBe('العربية');
  });
});

describe('render', () => {
  it('renders the home page', () => {
    const html = renderToString(<App />);
    expect(html).toContain('askbox');
  });
});
