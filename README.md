<div align="center">

# سَنَد · SANAD

**اسأل عن الإسلام بلغتك — وخذ النص من مصدره**
**Ask about Islam in your language — and get the text from its source**

🌐 **[sanad-te1f.onrender.com](https://sanad-te1f.onrender.com)** · 🏛️ بوابة الجمعية / Association portal: [`/#/portal`](https://sanad-te1f.onrender.com/#/portal)

</div>

> مشروع مقدَّم لـ «تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي». يعتمد فقط على المصادر الواردة في «المرجعية والحزمة العلمية والبيانات».
> Built for the *AI Challenge Serving Islamic Content*, using only the sources listed in the challenge's reference guide.

---

## العربية

### الفكرة
سَنَد موقع يسأل فيه أي شخص عن الإسلام **بأي لغة، كتابةً أو بصوته**، فيعرض له **النص كما نشره المصدر المعتمد**: الحديث بدرجته وتخريجه وشرحه، أو السؤال والجواب المنشور، أو تعريف المصطلح، مع رابط صفحة المصدر — وبترجمته المنشورة بلغة السائل متى وُجدت.
وإذا لم يجد نصًا يجيب مباشرة، أو كان السؤال حالة شخصية تحتاج فتوى، **يحوّل السائل إلى داعية يتحدث لغته** عبر بوابة الجمعية، ويظهر الرد في «أسئلتي».

**سَنَد لا يكتب أي نص شرعي ولا يترجمه ولا يلخصه.** الذكاء الاصطناعي يفهم السؤال ويختار من النصوص المعتمدة فقط.

### رحلة السؤال
1. السائل يكتب أو يتحدث (التحويل من صوت إلى نص يتم في المتصفح، ويراجع النص قبل الإرسال).
2. تُعرف لغة السؤال تلقائيًا، أو يختارها السائل من قائمة كل لغات العالم.
3. حالة شخصية أو طلب داعية ← تحويل مباشر لداعية بلغته.
4. سؤال غامض ← سؤال توضيحي (مرتان كحد أقصى).
5. بحث في المدوّنة المعتمدة، ثم يختار النموذج ما **يجيب مباشرة** فقط.
6. يُعرض النص من المصدر كما هو، أو «لم نجد نصًا» مع خيار الداعية.

### المميزات
- **كل اللغات:** قائمة بأكثر من 180 لغة مع بحث؛ الواجهة تتبع لغة السؤال تلقائيًا (كلمات الواجهة مكتوبة لـ 12 لغة، والبقية بالإنجليزية)، والنصوص تظهر بالترجمة المنشورة للغة السائل، وإلا الإنجليزية من المصدر نفسه مع تنبيه، وإلا العربية مع عرض الداعية.
- **صوت:** إدخال السؤال بالصوت، واستماع للنص المعروض (من المتصفح، دون تسجيل أو رفع).
- **بطاقات واضحة:** حديث (الدرجة، التخريج، النص العربي، الشرح، معاني الكلمات)، سؤال وجواب (المختصر والمفصّل)، مصطلح (التعريفات) — ومع كل بطاقة رابط المصدر.
- **التحويل لداعية:** نموذج بموافقة صريحة، دخول بالبريد ورمز تحقق (بلا كلمة مرور)، رقم مرجعي، و«أسئلتي» لمتابعة الرد.
- **بوابة الجمعية (`/#/portal`):** الداعية يرى الأسئلة الواردة **بلغاته فقط** ودون أي بيانات عن السائل، يستلم السؤال ويرد كتابةً أو بصوته؛ والمشرف يضيف الدعاة ولغاتهم.
- **سهولة الوصول:** تكبير النص، تباين عالٍ، دعم كامل لليمين واليسار، وخط مناسب لكل لغة (النستعليق للأردية).

### المصادر (من دليل المرجعية فقط)
| المصدر | ما نأخذه | في المدوّنة |
|---|---|---|
| الجمهرة — معجم السنة النبوية | الحديث، الدرجة، التخريج، الشرح، معاني الكلمات، وترجماته المنشورة (11 لغة) | 944 حديثًا صحيحًا أو حسنًا (رُفض 90 لدرجتها) |
| الجمهرة — معجم المصطلحات الشرعية | التعريفات وترجماتها المنشورة (7 لغات) | 12,099 مصطلحًا |
| منصة بينات (مرتبطة بكتاب «بينات» في الدليل) | السؤال، مختصر الجواب، الجواب المفصّل | 259 سؤالًا |

المجموع **13,302 نصًا في 12 لغة منشورة**. تفاصيل السحب والقرارات في [`docs/sources.md`](docs/sources.md).

### قواعد السلامة
- مصادر الدليل فقط، ولا نص من النموذج.
- لا ترجمة آلية للنصوص الشرعية.
- الحديث يُعرض فقط إذا كانت درجته المنشورة «صحيح» أو «حسن» صراحةً ومعه تخريج؛ ويُستبعد الموقوف والأثر والحكم على الرجال فقط والتصحيح الجزئي.
- لا نص مطابق ← تحويل لداعية. حالة شخصية ← داعية دائمًا.
- إذا تعطل النموذج: لا يُعرض حديث أبدًا، ويُعرض فقط سؤال منشور أو مصطلح يطابق السؤال نفسه، وغير ذلك يُحال.

### النتائج على حالات الدليل
30 سؤالًا (حالات الدليل بالإنجليزية والأردية والبنغالية): 22 عرضت نصًا من المصادر، و8 حُوّلت لداعية، **ولم يُؤلَّف أي نص** — بما فيها رفض طلب «حديث» مختلق. التفاصيل: [`docs/evaluation`](docs/evaluation/README.md).

### التقنيات
React 19 + Vite + Tailwind (الواجهة) · Express + TypeScript (الخادم) · Supabase: PostgreSQL + Auth + RLS (الحسابات والتحويلات والمحتوى) · Gemini عبر واجهة متوافقة مع OpenAI (فهم السؤال واختيار النص فقط) · Web Speech API (الصوت) · Render (الاستضافة).

---

## English

### What it is
Sanad lets anyone ask about Islam **in any language, typed or spoken**, and shows **the text exactly as an approved source published it** — a hadith with its grade, takhrij and explanation, a published Q&A, or a glossary definition — with a link to the source page, in the asker's language whenever the source published a human translation.
When no text answers directly, or the question is a personal case needing a fatwa, Sanad **refers the asker to a dāʿī who speaks their language** through the association portal; the reply appears in *My questions*.

**Sanad never writes, translates or summarises religious text.** The model only understands the question and picks from approved texts.

### How a question flows
1. Type or speak (speech-to-text runs in the browser; the asker reviews the text before sending).
2. Language detected automatically, or chosen from a searchable list of every world language.
3. Personal case or request for a person → straight to a dāʿī in that language.
4. Unclear → a clarifying question (at most twice).
5. Search the approved corpus; the model selects only texts that **directly** answer.
6. Show the source's text as published — or "no text found" with the dāʿī option.

### Features
- **Every language:** a 180+ language picker with search; the interface follows the question's language (interface words written for 12 languages, English otherwise); texts appear in the asker's published translation, else the same source's English with a notice, else Arabic with the dāʿī option.
- **Voice:** dictate the question and listen to the text (browser speech; nothing recorded or uploaded).
- **Answer cards:** hadith (grade, takhrij, Arabic, explanation, word meanings), Q&A (short and detailed), glossary term — each linked to its source.
- **Referral:** explicit consent, email one-time-code sign-in (no password), reference number, *My questions* for replies.
- **Association portal (`/#/portal`):** dāʿīs see incoming questions **in their languages only**, never the asker's identity; they take a question and reply by text or voice; supervisors add dāʿīs and their languages.
- **Accessibility:** text size, high contrast, full RTL/LTR, per-language fonts (Nastaliq for Urdu).

### Sources (reference guide only)
Al-Jamharah Sunnah dictionary (944 sahih/hasan hadith, 11 published translation languages), Al-Jamharah glossary of Islamic terms (12,099 terms, 7 languages), and the Bayyinat platform (259 Q&A, linked to the guide's *Bayyinat* book) — **13,302 texts in 12 published languages**. See [`docs/sources.md`](docs/sources.md).

### Safety rules
Guide sources only; no model-written or machine-translated religious text; hadith shown only with an explicit published *sahih*/*hasan* grade and takhrij; no match → dāʿī; personal case → dāʿī, always; if the model is unavailable, no hadith is ever shown and only an exact published question or term matches.

### Results on the guide's test cases
30 questions (guide cases × English/Urdu/Bengali): 22 answered from the sources, 8 referred, **nothing invented** — including refusing a request for a fabricated hadith. See [`docs/evaluation`](docs/evaluation/README.md).

---

## التشغيل · Running it

### المتطلبات · Requirements
Node.js 20+ · a Supabase project · a Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)).

### 1. التثبيت والإعداد · Install and configure
```bash
git clone https://github.com/ahoodalotibi/sanad.git && cd sanad
npm install
cp .env.example .env      # ثم املأ القيم في .env — fill in the values (never commit .env)
```

| المتغير · Variable | الغرض · Purpose |
|---|---|
| `SUPABASE_URL` | رابط مشروع Supabase · project URL |
| `SUPABASE_SECRET_KEY` | مفتاح الخادم السري · server-only secret key |
| `SUPABASE_PUBLISHABLE_KEY` | المفتاح العام (لتسجيل الدخول في المتصفح) · public key for browser sign-in |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | لأوامر قاعدة البيانات فقط · for `db:*` commands only |
| `LLM_API_KEY` | مفتاح Gemini · Gemini key (optional: without it Sanad is stricter and refers more) |
| `LLM_MODEL`, `LLM_BASE_URL` | اختياري · optional (default `gemini-3.5-flash-lite`) |

### 2. قاعدة البيانات · Database
```bash
npx supabase login        # مرة واحدة · once
npm run db:link && npm run db:push
npm run admin:grant -- --email=you@example.com   # أول مشرف · first supervisor
```
في Supabase ← Authentication: أضف رابط الموقع في *URL Configuration*، وفي قالب البريد ضع `{{ .Token }}` ليصل رمز الدخول (يتطلب SMTP مخصصًا).
In Supabase → Authentication: add the site URL under *URL Configuration*, and put `{{ .Token }}` in the email template so the sign-in code is sent (needs custom SMTP).

### 3. التشغيل · Run
```bash
npm run dev               # http://localhost:3000   (البوابة · portal: /#/portal)
```
المدوّنة الجاهزة `data/corpus/corpus.json.gz` موجودة في المستودع، فالموقع يجيب مباشرة.
The prebuilt corpus `data/corpus/corpus.json.gz` is in the repo, so the site answers right away.

### 4. إعادة بناء المحتوى (اختياري) · Rebuilding the content (optional)
```bash
npm run ingest:hadith -- --all       # الجمهرة — الأحاديث وترجماتها
npm run ingest:dictionary -- --all   # الجمهرة — المصطلحات وترجماتها
npm run ingest:bayyinat -- --all     # بينات
npm run corpus:build                 # التحقق وبناء المدوّنة · validate and build the corpus
npm run ingest:load -- --source=hadith|dictionary|bayyinat   # إلى Supabase كمسودات · into Supabase as drafts
```
السحب مهذب: يحترم `robots.txt`، وطلبات محدودة، ويحفظ الصفحات الأصلية محليًا ليُستأنف دون إعادة تنزيل.
Polite crawling: respects `robots.txt`, limited concurrency, keeps originals locally so reruns don't re-download.

### 5. الاختبار · Tests
```bash
npm test                  # الاختبارات · unit tests
npm run llm:check         # هل يعمل النموذج؟ · is the model reachable?
npm run eval:guide        # حالات الدليل · the guide's test cases
```

### 6. النشر · Deploy (Render)
`render.yaml` جاهز: *New → Blueprint* ثم أضف المتغيرات الأربعة في *Environment*. يعمل على الخطة المجانية (حوالي 300 ميجا ذاكرة).
`render.yaml` is included: *New → Blueprint*, then add the four variables under *Environment*. Fits the free plan (~300 MB).
فحص الحالة · status: `/api/health`, `/api/meta`.

---

## البنية · Architecture
```
المتصفح (React)  ── /api/ask ──►  Express
  صوت ↔ نص (Web Speech)            ├─ فهم السؤال: اللغة، النوع، كلمات البحث   (Gemini — لا يكتب نصًا)
  بطاقات الحديث/الجواب/المصطلح      ├─ بحث BM25 في المدوّنة المعتمدة (13,302 نصًا × 12 لغة)
  «أسئلتي» وبوابة الجمعية          ├─ اختيار ما يجيب مباشرة                     (Gemini — يختار معرّفات فقط)
                                    └─ العرض من المصدر كما هو، أو التحويل لداعية
  /api/referrals, /api/daee/*, /api/admin/*  ──►  Supabase (Auth + PostgreSQL + RLS)
```

## هيكلية المشروع · Project structure
```
server.ts                 الخادم · Express entry
server/answer/            مسار الإجابة · answer path (pipeline, search, llm, rules)
server/accounts/          الحسابات والتحويلات والبوابة · accounts, referrals, portal API
server/db/                طبقة قاعدة البيانات · Supabase data layer
src/site/                 موقع السائل · public site (ask, answer, refer, My questions)
src/portal/               بوابة الجمعية · association portal
src/i18n/                 اللغات وكلمات الواجهة · languages and interface strings
scripts/ingest/           سحب المصادر · source ingestion
scripts/corpus/           التحقق وبناء المدوّنة · validation and corpus build
scripts/eval/             اختبار حالات الدليل · guide test runner
supabase/migrations/      مخطط قاعدة البيانات وسياسات RLS · schema and RLS
data/corpus/              المدوّنة المعتمدة المعروضة · the served corpus
docs/                     التوثيق: المصادر، الحسابات، نتائج الاختبار · documentation
```

## ملاحظات · Notes
- أجوبة «بينات» منشورة بالعربية فقط؛ تظهر لغير العربي مع تنبيه وعرض الداعية. · Bayyinat answers are published in Arabic only; non-Arabic askers see a notice and the dāʿī option.
- النصوص ملك ناشريها؛ سَنَد يعرضها مع رابط المصدر ولا يعدّلها. · Texts belong to their publishers; Sanad shows them with a link and never alters them.
- سَنَد أداة تستعين بالذكاء الاصطناعي ولا تُصدر فتاوى. · Sanad is AI-assisted and does not issue fatwas.
