/** Language names, direction and typeface — for any language code the sources contain. */
const RTL = new Set(['ar', 'ur', 'fa', 'he', 'ps', 'ku', 'ckb', 'sd', 'ug', 'dv', 'yi']);

export const dirOf = (code: string): 'rtl' | 'ltr' => (RTL.has(code.split('-')[0]) ? 'rtl' : 'ltr');

function displayName(code: string, inLocale: string): string {
  try {
    return new Intl.DisplayNames([inLocale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The language's name in its own script, e.g. "اردو", "বাংলা", "Français". */
export const nativeName = (code: string) => {
  const n = displayName(code, code);
  return n.charAt(0).toLocaleUpperCase(code) + n.slice(1);
};
/** The language's name in another language (e.g. the interface language). */
export const nameIn = (code: string, ui: string) => displayName(code, ui);

/** Font stack per language; Arabic-script text is never set in a Latin face. */
export function fontFor(code: string): string {
  const base = code.split('-')[0];
  if (base === 'ur') return "'Noto Nastaliq Urdu', 'Readex Pro', serif";
  if (base === 'bn') return "'Hind Siliguri', 'Readex Pro', sans-serif";
  return "'Readex Pro', system-ui, sans-serif";
}

/** Line height per language (Nastaliq needs much more room). */
export const leadingFor = (code: string) => (code.startsWith('ur') ? 2.1 : code.startsWith('ar') ? 1.8 : 1.6);

/** BCP-47 tags for the browser's speech recognition / synthesis. */
export const SPEECH_LOCALE: Record<string, string> = {
  ar: 'ar-SA', en: 'en-US', ur: 'ur-PK', bn: 'bn-BD', fr: 'fr-FR', id: 'id-ID', tr: 'tr-TR', es: 'es-ES',
  ru: 'ru-RU', zh: 'zh-CN', fa: 'fa-IR', bs: 'bs-BA', ms: 'ms-MY', hi: 'hi-IN', tl: 'fil-PH', sw: 'sw-KE', de: 'de-DE',
};
export const speechLocale = (code: string) => SPEECH_LOCALE[code] ?? code;

/** Every ISO 639-1 language (plus a few common 639-3 ones) — the picker lists them all. */
export const ALL_LANGUAGES = (
  'aa ab af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc om or os pa pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu ' +
  'ckb fil haw yue nqo'
).split(' ');

/** Searchable label for a language: native name, name in the interface language, and code. */
export const searchKey = (code: string, ui: string) => `${nativeName(code)} ${nameIn(code, ui)} ${nameIn(code, 'en')} ${code}`.toLocaleLowerCase();
