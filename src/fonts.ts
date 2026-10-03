/**
 * Self-hosted web fonts (bundled by Vite from @fontsource; no third-party requests).
 * Each weight file declares every script subset with unicode-range, so a browser only
 * downloads the subsets a page actually uses (e.g. Bengali glyphs only on Bengali pages).
 *
 *  Cairo ............... brand body face (Latin + Arabic) — per the SAND identity
 *  Cormorant Garamond .. English display — echoes the serif used in the identity
 *  Noto Nastaliq Urdu .. Urdu text and headings (Nastaliq is the expected Urdu style)
 *  Hind Siliguri ....... Bengali body / UI
 *  Noto Serif Bengali .. Bengali display
 *  Amiri Quran ......... Quranic and hadith Arabic
 */
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/noto-nastaliq-urdu/400.css';
import '@fontsource/noto-nastaliq-urdu/600.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/500.css';
import '@fontsource/hind-siliguri/600.css';
import '@fontsource/noto-serif-bengali/500.css';
import '@fontsource/noto-serif-bengali/600.css';
import '@fontsource/amiri-quran/400.css';
