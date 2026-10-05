/**
 * Keyword rules used when no language model is configured (and as a safety net when it is):
 * a personal situation or a request for a person always goes to a daee.
 * These lists are deliberately conservative — when in doubt, refer.
 */
import { normalizeArabic } from './text.ts';

const PERSONAL = [
  // ar
  /(^|\s)(زوجي|زوجتي|طليقي|طليقتي|خطيبي|خطيبتي|ابني|ابنتي|والدي|والدتي|اخي|اختي)(\s|$|[،؟?.])/, /هل يجوز لي/, /(طلقت|طلقني|طلقها|حلفت|نذرت|ورثت|اقترضت)/, /ماذا افعل/,
  // en
  /\bmy (husband|wife|ex|fianc[eé]e?|son|daughter|father|mother|parents|brother|sister|boss|family)\b/i, /\b(can|may|should) i\b/i, /\bam i allowed\b/i, /\bis it (halal|haram|permissible|allowed) (for me|if i)\b/i, /\bi (divorced|married|swore|vowed|inherited|borrowed)\b/i, /\bwhat should i do\b/i,
  // ur
  /(میرے شوہر|میری بیوی|میرا بیٹا|میری بیٹی|کیا میں|مجھے کیا کرنا)/,
  // fr / id / tr
  /\b(mon mari|ma femme|puis-je|est-ce que je peux)\b/i, /\b(suami saya|istri saya|bolehkah saya|apakah saya boleh)\b/i, /\b(kocam|karım|yapabilir miyim)\b/i,
  // bn
  /(আমার স্বামী|আমার স্ত্রী|আমি কি)/,
];

const HUMAN = [/\b(talk|speak|chat) (to|with) (a |an )?(person|human|scholar|imam|sheikh|shaykh|daee|da'?i)\b/i, /(داعية|داعيه|شيخ|عالم|مفتي)/, /(مولانا|عالم سے بات)/, /\b(parler à|berbicara dengan) /i];

export const looksPersonal = (q: string) => {
  const n = normalizeArabic(q);
  return PERSONAL.some((r) => r.test(q) || r.test(n));
};
export const asksForHuman = (q: string) => HUMAN.some((r) => r.test(q) || r.test(normalizeArabic(q)));
export const isGreeting = (q: string) => /^\s*(salam|assalam\w*|السلام عليكم\S*|hi|hello|hey|thanks|thank you|شكرا|جزاك الله خيرا?)\s*[.!؟?]*\s*$/i.test(q);
