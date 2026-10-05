/**
 * «بينات: أسئلة وأجوبة عن الإسلام» — Osoul Center.
 *
 * The reference document lists the book at https://dawa.center/file/7937 (PDF). The PDF's text
 * layer is corrupted when extracted (e.g. «اإليمان», «اهلل», Quran verses missing because they use
 * a special font), so extracting it would not reproduce the published text. The book states in its
 * introduction (p.21) that its content is published on the publisher's platform bayenat.net; we
 * read the same questions from there — only items authored by Osoul Center (/ar/sources/11) —
 * and every record keeps a reference to the book on dawa.center.
 *
 * Page shapes observed on 2026-10-05:
 *   /ar/sources/11?page=N           10 items per page, links /ar/category/{cat}/{id}, pager up to 27
 *   /ar/category/{cat}/{id}         h1.page-title; .question-card (نص السؤال, المؤلف, المصدر);
 *                                   .question-card.second (عبارات مشابهة للسؤال);
 *                                   #shortAnswer / #detailedAnswer .article-typo; #translations links
 */
import { blockText, collapse } from '../lib/text.ts';

export const BAYENAT_ORIGIN = 'https://bayenat.net';
export const BAYENAT_OSOUL_SOURCE = `${BAYENAT_ORIGIN}/ar/sources/11`;
export const BAYYINAT_BOOK = 'https://dawa.center/file/7937';

/**
 * How bayenat.net relates to the book listed in the reference document. The book's introduction
 * (PDF p.21, «هذا الكتاب») says the project published its questions and answers on bayenat.net/ar
 * and then SELECTED the most important ones for the book. So the platform is the publisher's
 * larger collection: an item read here is not claimed to be in the book, nor to match a book page.
 */
export const RELATED_BOOK = {
  url: BAYYINAT_BOOK,
  title: 'بينات: أسئلة وأجوبة عن الإسلام',
  publisher: 'مركز أصول',
  relation: 'publisher_platform_referenced_in_book',
  evidence: 'مقدمة الكتاب، ص21 من ملف PDF («هذا الكتاب»): المشروع نشر الأسئلة والأجوبة على منصة bayenat.net/ar ثم انتقى أهمها في كتاب مفرد.',
  inBook: 'unverified',
} as const;

type El = any;
type Doc = { querySelector(s: string): El | null; querySelectorAll(s: string): ArrayLike<El>; getElementById?(id: string): El | null };

/** A highlighted quotation block (class "quran" on the site). It holds Quran verses and sometimes hadith. */
export interface Quotation {
  kind: 'quran' | 'other';
  text: string;
  reference: string | null;
}

/** Quran references look like "[البقرة: 30]" / "[فُصِّلت: 42]؟!"; anything else (e.g. "رواه …") is not a verse. */
export const isQuranReference = (ref: string | null) => !!ref && /^\[[^\]:]+:\s*[\d٠-٩]+(?:\s*[-–]\s*[\d٠-٩]+)?\s*\]/.test(ref);

export interface BayyinatQa {
  id: string;
  categoryId: string;
  language: string;
  url: string;
  title: string;
  category: string | null;
  question: string;
  author: string | null;
  publisher: string | null;
  similar: string[];
  shortAnswer: string;
  detailedAnswer: string;
  quotes: Quotation[];
  translations: Array<{ language: string; label: string; url: string }>;
  printUrl: string | null;
}

export function parseQaUrl(url: string): { language: string; categoryId: string; id: string } | null {
  const m = /bayenat\.net\/([a-z]{2,3})\/category\/(\d+)\/(\d+)\/?(?:[?#].*)?$/.exec(url);
  return m ? { language: m[1], categoryId: m[2], id: m[3] } : null;
}

export function sourcePageUrl(page: number): string {
  return page <= 1 ? BAYENAT_OSOUL_SOURCE : `${BAYENAT_OSOUL_SOURCE}?page=${page}`;
}

/** Item URLs on one listing page and the highest page number in the pager. */
export function parseSourcePage(doc: Doc): { items: string[]; lastPage: number } {
  const items = new Set<string>();
  let lastPage = 1;
  for (const a of Array.from(doc.querySelectorAll('a')) as El[]) {
    const href = a.getAttribute('href') ?? '';
    const p = parseQaUrl(href);
    if (p) items.add(`${BAYENAT_ORIGIN}/${p.language}/category/${p.categoryId}/${p.id}`);
    const pg = /\/sources\/11\?page=(\d+)/.exec(href);
    if (pg) lastPage = Math.max(lastPage, Number(pg[1]));
  }
  return { items: [...items], lastPage };
}

const textOf = (el: El | null) => (el ? blockText(el) : '');
const labelValue = (el: El) => collapse(el.querySelector('span')?.textContent ?? '');

export function parseQaPage(doc: Doc, url: string): BayyinatQa {
  const ids = parseQaUrl(url);
  if (!ids) throw new Error(`Not a bayenat question URL: ${url}`);
  const byId = (id: string) => (doc.getElementById ? doc.getElementById(id) : doc.querySelector(`#${id}`));

  const cards = Array.from(doc.querySelectorAll('.question-card')) as El[];
  const questionCard = cards.find((c) => !String(c.getAttribute('class') ?? '').includes('second')) ?? null;
  const similarCard = cards.find((c) => String(c.getAttribute('class') ?? '').includes('second')) ?? null;
  if (!questionCard) throw new Error(`No question on ${url}`);

  let author: string | null = null;
  let publisher: string | null = null;
  for (const ref of Array.from(questionCard.querySelectorAll('.reference')) as El[]) {
    const label = collapse(ref.textContent ?? '');
    if (label.startsWith('المؤلف')) author = labelValue(ref) || null;
    else if (label.startsWith('المصدر')) publisher = labelValue(ref) || null;
  }
  const question = textOf(questionCard.querySelector('.card-body'));

  const similar = similarCard
    ? (Array.from(similarCard.querySelectorAll('.card-body p')) as El[]).map((p) => collapse(p.textContent ?? '')).filter(Boolean)
    : [];

  const shortEl = byId('shortAnswer')?.querySelector('.article-typo') ?? null;
  const detailedEl = byId('detailedAnswer')?.querySelector('.article-typo') ?? null;
  const shortAnswer = textOf(shortEl);
  const detailedAnswer = textOf(detailedEl);

  const quotes: Quotation[] = [];
  for (const root of [questionCard, shortEl, detailedEl].filter(Boolean) as El[]) {
    for (const q of Array.from(root.querySelectorAll('.quran')) as El[]) {
      const text = collapse(q.querySelector('.content')?.textContent ?? '');
      const reference = collapse(q.querySelector('.reference')?.textContent ?? '') || null;
      if (text && !quotes.some((x) => x.text === text && x.reference === reference)) quotes.push({ kind: isQuranReference(reference) ? 'quran' : 'other', text, reference });
    }
  }

  const translations: BayyinatQa['translations'] = [];
  for (const a of Array.from(byId('translations')?.querySelectorAll('a') ?? []) as El[]) {
    const href = a.getAttribute('href') ?? '';
    const p = parseQaUrl(href);
    if (!p || p.language === ids.language || translations.some((t) => t.language === p.language)) continue;
    translations.push({ language: p.language, label: collapse(a.textContent ?? ''), url: href });
  }

  const crumbs = (Array.from(doc.querySelectorAll('ol.breadcrumb li')) as El[]).map((li) => collapse(li.textContent ?? ''));
  const print = (Array.from(doc.querySelectorAll('a')) as El[]).map((a) => a.getAttribute('href') ?? '').find((h) => /\/print\/\d+\/\d+/.test(h)) ?? null;

  return {
    id: ids.id,
    categoryId: ids.categoryId,
    language: ids.language,
    url: `${BAYENAT_ORIGIN}/${ids.language}/category/${ids.categoryId}/${ids.id}`,
    title: collapse(doc.querySelector('h1.page-title')?.textContent ?? doc.querySelector('h1')?.textContent ?? ''),
    category: crumbs.length >= 3 ? crumbs[crumbs.length - 1] : null,
    question,
    author,
    publisher,
    similar,
    shortAnswer,
    detailedAnswer,
    quotes,
    translations,
    printUrl: print,
  };
}
