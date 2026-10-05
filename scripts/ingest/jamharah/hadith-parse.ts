/**
 * Parsers for «معجم السنة النبوية» on Al-Jamharah (islamic-content.com), listed in the reference
 * document (p.3–4) as one of the approved encyclopedias.
 *
 * Page shapes observed on 2026-10-05:
 *   /hadeeths                 → ~190 topic pages  /t/{topic}/hadeeths
 *   /t/{topic}/hadeeths       → links «شرح حديث …» to /t/{id}
 *   /t/{id}  (Arabic)         → <article>: .hadeeth p.font-large (text), .hadeeth p.font-small
 *                               "[صحيح.] - [رواه مسلم.]", then <h2> sections: شرح الحديث، معاني الكلمات
 *                               (table), فوائد من الحديث (ol), المراجع، مفردات ذات علاقة،
 *                               «ترجمة هذا الحديث متوفرة باللغات التالية» (links named in Arabic)
 *   /t/{id}  (translation)    → same layout: translated text + translated «شرح الحديث» (no grade line)
 * Honorific glyphs are icon fonts with the words in hidden spans («ﷺ», «رضي الله عنه»); textContent
 * keeps those words, so nothing is lost or invented.
 */
import { blockText, collapse } from '../lib/text.ts';

export const JAMHARAH = 'https://islamic-content.com';

type El = any;
type Doc = { querySelector(s: string): El | null; querySelectorAll(s: string): ArrayLike<El>; title?: string };

/** Arabic language names as the site writes them → language codes. Unknown names are reported, never guessed. */
export const LANGUAGE_NAMES_AR: Record<string, string> = {
  العربية: 'ar', الإنجليزية: 'en', الانجليزية: 'en', الفرنسية: 'fr', التركية: 'tr', الأردية: 'ur', الأوردية: 'ur',
  الأندونيسية: 'id', الإندونيسية: 'id', البوسنية: 'bs', الروسية: 'ru', الصينية: 'zh', الفارسية: 'fa', البنغالية: 'bn',
  الهندية: 'hi', الإسبانية: 'es', الاسبانية: 'es', البرتغالية: 'pt', الألمانية: 'de', الإيطالية: 'it', التاغالوغية: 'tl',
  الفلبينية: 'tl', التجالوج: 'tl', السواحلية: 'sw', الهوسا: 'ha', الأمهرية: 'am', الصومالية: 'so', البشتو: 'ps', البشتوية: 'ps',
  الكردية: 'ku', الأويغورية: 'ug', الملايالامية: 'ml', المليبارية: 'ml', التاميلية: 'ta', التلجوية: 'te', السنهالية: 'si',
  النيبالية: 'ne', التايلاندية: 'th', الفيتنامية: 'vi', اليابانية: 'ja', الكورية: 'ko', الأوزبكية: 'uz', الطاجيكية: 'tg',
  الأذرية: 'az', الألبانية: 'sq', الأوكرانية: 'uk', البلغارية: 'bg', المقدونية: 'mk', الرومانية: 'ro', المجرية: 'hu',
  التشيكية: 'cs', الهولندية: 'nl', السويدية: 'sv', اليوروبا: 'yo', الكينيارواندا: 'rw', الأسامية: 'as', الغوجاراتية: 'gu',
  الكانادا: 'kn', الماراثية: 'mr', البنجابية: 'pa', الخميرية: 'km', البورمية: 'my', الجورجية: 'ka', القرغيزية: 'ky',
  الليتوانية: 'lt', الصربية: 'sr', الأورومية: 'om', الملاغاشية: 'mg', الولوف: 'wo', الفولانية: 'ff',
};

export interface HadithTranslationLink {
  language: string | null; // null when the Arabic name is not in LANGUAGE_NAMES_AR
  name: string;
  url: string;
  id: string;
}

export interface HadithPage {
  id: string;
  url: string;
  title: string | null;
  /** The hadith text as published (Arabic matn with its narrator, or its translation) */
  text: string;
  /** e.g. "[صحيح.] - [رواه مسلم.]" — only on the Arabic page */
  gradeLine: string | null;
  grade: string | null; // "صحيح"
  takhrij: string | null; // "رواه مسلم"
  explanation: string | null; // «شرح الحديث»
  wordMeanings: Array<{ word: string; meaning: string }>;
  benefits: string[];
  references: string | null;
  relatedTopics: Array<{ id: string; name: string }>;
  translations: HadithTranslationLink[];
}

const idOf = (url: string) => /\/t\/(\d+)\/?(?:[?#].*)?$/.exec(url)?.[1] ?? null;
const abs = (href: string) => (href.startsWith('http') ? href : `${JAMHARAH}${href.startsWith('/') ? '' : '/'}${href}`);

/** Topic pages listed on /hadeeths. */
export function parseHadithIndex(doc: Doc): string[] {
  const out = new Set<string>();
  for (const a of Array.from(doc.querySelectorAll('a')) as El[]) {
    const href = a.getAttribute('href') ?? '';
    if (/^(https:\/\/islamic-content\.com)?\/t\/\d+\/hadeeths\/?$/.test(href)) out.add(abs(href).replace(/\/$/, ''));
  }
  return [...out];
}

/** Hadith pages («شرح حديث …») linked from a topic page. */
export function parseTopicPage(doc: Doc): Array<{ id: string; url: string; title: string }> {
  const out = new Map<string, { id: string; url: string; title: string }>();
  for (const a of Array.from(doc.querySelectorAll('a')) as El[]) {
    const href = a.getAttribute('href') ?? '';
    const title = collapse(a.textContent ?? '');
    const id = idOf(href);
    if (id && title.startsWith('شرح حديث') && !out.has(id)) out.set(id, { id, url: abs(href), title });
  }
  return [...out.values()];
}

/** Splits "[صحيح.] - [رواه مسلم.]" into its two published parts. */
export function parseGradeLine(line: string | null): { grade: string | null; takhrij: string | null } {
  if (!line) return { grade: null, takhrij: null };
  const parts = [...line.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim().replace(/[.。]+$/, '').trim());
  return { grade: parts[0] || null, takhrij: parts[1] || null };
}

/** Groups the nodes after each <h2> until the next <h2>/<hr>. */
function sectionsOf(container: El): Map<string, El[]> {
  const out = new Map<string, El[]>();
  let current: string | null = null;
  for (const node of Array.from(container.childNodes) as El[]) {
    if (node.nodeType === 1 && node.nodeName.toUpperCase() === 'H2') {
      current = collapse(node.textContent ?? '').replace(/\s*:\s*$/, '');
      out.set(current, []);
      continue;
    }
    if (node.nodeType === 1 && node.nodeName.toUpperCase() === 'HR') {
      current = null;
      continue;
    }
    if (current) out.get(current)!.push(node);
  }
  return out;
}

const textOfNodes = (nodes: El[]) =>
  nodes
    .map((n) => (n.nodeType === 3 ? collapse(n.textContent ?? '') : n.nodeType === 1 ? blockText(n) : ''))
    .filter(Boolean)
    .join('\n')
    .trim() || null;

export function parseHadithPage(doc: Doc, url: string): HadithPage {
  const id = idOf(url);
  if (!id) throw new Error(`Not a /t/{id} URL: ${url}`);
  const article = doc.querySelector('article');
  const hadeeth = article?.querySelector('.hadeeth');
  if (!article || !hadeeth) throw new Error(`No hadith on ${url}`);

  const text = blockText(hadeeth.querySelector('.font-large') ?? hadeeth);
  const gradeLine = collapse(hadeeth.querySelector('.font-small')?.textContent ?? '') || null;
  const { grade, takhrij } = parseGradeLine(gradeLine);

  const sections = sectionsOf(hadeeth.parentElement);
  const find = (prefix: string) => [...sections.entries()].find(([k]) => k.startsWith(prefix))?.[1] ?? [];

  const wordMeanings: HadithPage['wordMeanings'] = [];
  for (const node of find('معاني الكلمات'))
    if (node.nodeType === 1)
      for (const tr of Array.from(node.querySelectorAll('tr')) as El[]) {
        const tds = Array.from(tr.querySelectorAll('td')) as El[];
        if (tds.length >= 2) wordMeanings.push({ word: collapse(tds[0].textContent ?? ''), meaning: collapse(tds[1].textContent ?? '') });
      }

  const benefits = find('فوائد من الحديث')
    .filter((n) => n.nodeType === 1)
    .flatMap((n) => Array.from(n.querySelectorAll('li')) as El[])
    .map((li) => collapse(li.textContent ?? ''))
    .filter(Boolean);

  const relatedTopics = find('مفردات ذات علاقة')
    .filter((n) => n.nodeType === 1)
    .flatMap((n) => Array.from(n.querySelectorAll('a')) as El[])
    .map((a) => ({ id: idOf(a.getAttribute('href') ?? '') ?? '', name: collapse(a.textContent ?? '') }))
    .filter((t) => t.id);

  const translations: HadithTranslationLink[] = [];
  for (const n of find('ترجمة هذا الحديث'))
    if (n.nodeType === 1)
      for (const a of Array.from(n.querySelectorAll('a')) as El[]) {
        const href = abs(a.getAttribute('href') ?? '');
        const tid = idOf(href);
        const name = collapse(a.textContent ?? '');
        if (tid && tid !== id && !translations.some((t) => t.id === tid)) translations.push({ id: tid, url: href, name, language: LANGUAGE_NAMES_AR[name] ?? null });
      }

  const rawTitle = collapse(doc.querySelector('title')?.textContent ?? '');
  return {
    id,
    url: `${JAMHARAH}/t/${id}`,
    title: rawTitle.replace(/\s*-\s*الجمهرة\s*$/, '') || null,
    text,
    gradeLine,
    grade,
    takhrij,
    explanation: textOfNodes(find('شرح الحديث')),
    wordMeanings,
    benefits,
    references: textOfNodes(find('المراجع')),
    relatedTopics,
    translations,
  };
}

/** Maps the published grade wording onto the database enum; anything unclear stays "unknown". */
export function gradeEnum(grade: string | null): 'sahih' | 'hasan' | 'daif' | 'mawdu' | 'no_basis' | 'unknown' {
  if (!grade) return 'unknown';
  const g = grade.replace(/[ً-ْ]/g, '');
  if (/موضوع/.test(g)) return 'mawdu';
  if (/لا أصل له/.test(g)) return 'no_basis';
  if (/ضعيف/.test(g)) return 'daif';
  if (/حسن/.test(g)) return 'hasan';
  if (/صحيح/.test(g)) return 'sahih';
  return 'unknown';
}
