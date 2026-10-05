/**
 * Parsers for the Al-Jamharah dictionary of Islamic terms (islamic-content.com/dictionary).
 *
 * Page shapes observed on the live site (2026-10-05):
 *   /dictionary                     → links to the 8 subject categories (/dictionary/term/{id})
 *   /dictionary/term/{id}           → every word of that category (/dictionary/word/{id})
 *   /dictionary/word/{id}           → Arabic entry: <article> with <h1> title, one or more
 *                                     sections "<h5>من …</h5><div>published text</div>",
 *                                     breadcrumb categories, and "ترجمة هذا المصطلح متوفرة
 *                                     باللغات التالية" (#related) linking to each translation
 *   /dictionary/word/{id}/{lang}    → the same entry in another language (title "Term<br>(المصطلح)")
 *
 * These functions only READ the published page. They never rewrite, translate or summarise text.
 */
import { blockText, collapse } from '../lib/text.ts';

export const JAMHARAH_ORIGIN = 'https://islamic-content.com';

// Loose DOM types: works with linkedom in Node and with the browser DOM.
type El = any;
type Doc = { querySelector(s: string): El | null; querySelectorAll(s: string): ArrayLike<El> };

export interface DictionaryCategory {
  id: string;
  name: string;
  url: string;
}

export interface EntrySection {
  /** The section label as published, e.g. "من معجم المصطلحات الشرعية" */
  label: string;
  /** Published text of the section (whitespace normalised only) */
  text: string;
  /** "انظر: …" bibliography lines published under the definition, if any */
  references: string | null;
}

export interface EntryTranslationLink {
  language: string; // language code taken from the URL, e.g. "en"
  label: string; // link text as published, e.g. "الإنجليزية English"
  url: string;
}

export interface DictionaryEntry {
  wordId: string;
  language: string; // "ar" for /dictionary/word/{id}, otherwise the {lang} URL segment
  url: string;
  /** Title in this language, e.g. "الاجـْتِهَاد" or "Ijtihad" */
  title: string;
  /** Arabic term shown in brackets on translated pages, e.g. "الاجـْتِهَاد" */
  originalTitle: string | null;
  categories: DictionaryCategory[];
  sections: EntrySection[];
  translations: EntryTranslationLink[];
}

const abs = (href: string) => (href.startsWith('http') ? href : `${JAMHARAH_ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`);

export function wordUrl(wordId: string, language = 'ar'): string {
  return language === 'ar' ? `${JAMHARAH_ORIGIN}/dictionary/word/${wordId}` : `${JAMHARAH_ORIGIN}/dictionary/word/${wordId}/${language}`;
}

/** Parses /dictionary/word/{id}[/{lang}] URLs. */
export function parseWordUrl(url: string): { wordId: string; language: string } | null {
  const m = /\/dictionary\/word\/(\d+)(?:\/([a-z]{2,3}(?:-[A-Za-z0-9]+)?))?\/?(?:[?#].*)?$/.exec(url);
  return m ? { wordId: m[1], language: m[2] ?? 'ar' } : null;
}

/** The subject categories listed on /dictionary. */
export function parseDictionaryIndex(doc: Doc): DictionaryCategory[] {
  const seen = new Map<string, DictionaryCategory>();
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const href = a.getAttribute('href') ?? '';
    const m = /\/dictionary\/term\/(\d+)\/?$/.exec(href);
    if (!m || seen.has(m[1])) continue;
    const name = collapse(a.textContent ?? '');
    if (name) seen.set(m[1], { id: m[1], name, url: abs(href) });
  }
  return [...seen.values()];
}

/**
 * Every word id listed on a category page (/dictionary/term/{id}).
 * Only the listing cards ("h2.post-title a") count: every page also carries a featured
 * "اخترنا لك" word that does not belong to the category.
 */
export function parseCategoryPage(doc: Doc): string[] {
  const ids = new Set<string>();
  for (const a of Array.from(doc.querySelectorAll('.post-title a'))) {
    const parsed = parseWordUrl(a.getAttribute('href') ?? '');
    if (parsed && parsed.language === 'ar') ids.add(parsed.wordId);
  }
  return [...ids];
}

/** One dictionary entry page, in Arabic or in a translation. */
export function parseWordPage(doc: Doc, url: string): DictionaryEntry {
  const parsedUrl = parseWordUrl(url);
  if (!parsedUrl) throw new Error(`Not a dictionary word URL: ${url}`);
  const article = doc.querySelector('article.entry-wraper') ?? doc.querySelector('article');
  if (!article) throw new Error(`No <article> on ${url}`);

  // Title: "الاجـْتِهَاد" or "Ijtihad<br>(الاجـْتِهَاد)"
  const h1 = article.querySelector('h1');
  if (!h1) throw new Error(`No title on ${url}`);
  const titleLines = blockText(h1).split('\n').map((l) => l.trim()).filter(Boolean);
  const title = titleLines[0] ?? '';
  const bracket = titleLines.slice(1).join(' ').match(/^[([](.+)[)\]]$/);
  const originalTitle = bracket ? bracket[1].trim() : null;

  // Sections: every <h5> label followed by the published text block
  const sections: EntrySection[] = [];
  for (const h5 of Array.from(article.querySelectorAll('h5')) as El[]) {
    const label = collapse(h5.textContent ?? '');
    const body = h5.nextElementSibling;
    if (!label || !body) continue;
    const footnotes = Array.from(body.querySelectorAll('.footnotes')) as El[];
    const references = footnotes.map((f) => collapse(f.textContent ?? '')).filter(Boolean).join('\n') || null;
    for (const f of footnotes) f.remove();
    const text = blockText(body);
    if (text) sections.push({ label, text, references });
  }

  // Categories from the breadcrumb (links to /dictionary/term/{id})
  const categories: DictionaryCategory[] = [];
  const crumbs = doc.querySelector('.breadcrumbs') ?? doc;
  for (const a of Array.from(crumbs.querySelectorAll('a')) as El[]) {
    const href = a.getAttribute('href') ?? '';
    const m = /\/dictionary\/term\/(\d+)\/?$/.exec(href);
    if (m && !categories.some((c) => c.id === m[1])) categories.push({ id: m[1], name: collapse(a.textContent ?? ''), url: abs(href) });
  }

  // Available translations (#related list)
  const translations: EntryTranslationLink[] = [];
  const related = article.querySelector('#related') ?? doc.querySelector('#related');
  if (related) {
    for (const a of Array.from(related.querySelectorAll('a')) as El[]) {
      const href = abs(a.getAttribute('href') ?? '');
      const p = parseWordUrl(href);
      if (!p || p.wordId !== parsedUrl.wordId || p.language === parsedUrl.language) continue;
      if (!translations.some((t) => t.language === p.language)) translations.push({ language: p.language, label: collapse(a.textContent ?? ''), url: href });
    }
  }

  return { wordId: parsedUrl.wordId, language: parsedUrl.language, url: wordUrl(parsedUrl.wordId, parsedUrl.language), title, originalTitle, categories, sections, translations };
}
