/**
 * SANAD client-side query entry point.
 *
 * processQuery() asks the server RAG pipeline (POST /api/ask). The legacy keyword engine below
 * (original demo data, NOT reviewed content) is used only when the server reports that RAG is
 * not configured or the API is not running (e.g. `vite` without the Express server).
 * Its answers are tagged engine: 'legacy'.
 */
import { 
  SupportedLanguage, 
  ContentLevel, 
  SanadResponse, 
  KnowledgeChunk,
  Citation
} from '../types';
import { KNOWLEDGE_CHUNKS, APPROVED_SOURCES } from '../data/approvedSources';
import { TERMINOLOGY_DICTIONARY } from '../data/terminology';

// Fallback messages when no verified source is found (as mandated by user brief)
export const NO_ANSWER_MESSAGES: Record<SupportedLanguage, { title: string; body: string; button: string }> = {
  en: {
    title: "No Verified Source Found",
    body: "I couldn't find a reliable answer to your question in the verified knowledge base. I can connect you with a qualified specialist who can help you.",
    button: "Talk to a Specialist"
  },
  ur: {
    title: "معتبر ماخذ دستیاب نہیں",
    body: "مجھے آپ کے سوال کا کوئی معتبر اور مستند جواب دستیاب مصادر میں نہیں مل سکا۔ میں آپ کو ایک مستند اور اہل دینی ماہر سے جوڑ سکتا ہوں جو آپ کی بہتر رہنمائی کر سکتے ہیں۔",
    button: "ماہر سے رابطہ کریں"
  },
  bn: {
    title: "যাচাইকৃত উৎস পাওয়া যায়নি",
    body: "আমি যাচাইকৃত তথ্যের মধ্যে আপনার প্রশ্নের কোনো নির্ভরযোগ্য উত্তর খুঁজে পাইনি। আমি আপনাকে একজন যোগ্য বিশেষজ্ঞ আলেমের সাথে সংযুক্ত করতে পারি যিনি আপনাকে সাহায্য করতে পারবেন।",
    button: "বিশেষজ্ঞের সাথে কথা বলুন"
  }
};

// Level D messages for personal cases / fatwas
export const PERSONAL_FATWA_MESSAGES: Record<SupportedLanguage, { title: string; body: string; button: string }> = {
  en: {
    title: "Personal Matter / Fatwa Required (Level D)",
    body: "This inquiry involves an individual personal situation, marriage/divorce contract, or legal/medical reality requiring a formal Fatwa. In accordance with SANAD's core integrity principles, AI systems must never issue independent personal fatwas. We invite you to consult a qualified scholar directly.",
    button: "Request Specialist Consultation"
  },
  ur: {
    title: "شخصی مسئلہ / فتویٰ کی ضرورت (لیول ڈی)",
    body: "یہ سوال ایک مخصوص ذاتی واقعے، نکاح و طلاق، یا شرعی و قانونی صورتحال سے متعلق ہے جس کے لیے باقاعدہ فتوے اور تفصیلی تحقیق کی ضرورت ہے۔ سَنَد کے بنیادی قواعد کے مطابق خودکار نظام کبھی آزادانہ فتویٰ جاری نہیں کرتا۔ آپ اہل مفتی یا ماہر سے براہ راست رابطہ فرما سکتے ہیں۔",
    button: "ماہر شرعی سے رجوع کریں"
  },
  bn: {
    title: "ব্যক্তিগত বিষয় / ফতোয়া প্রয়োজন (লেভেল ডি)",
    body: "এই প্রশ্নটি একটি নির্দিষ্ট ব্যক্তিগত ঘটনা, বিবাহ বা পারিবারিক বিষয় অথবা আইনি পরিস্থিতির সাথে সম্পর্কিত যার জন্য আনুষ্ঠানিক ফতোয়া ও অভিজ্ঞ আলেমের পরামর্শ প্রয়োজন। 'সনদ'-এর মূল নীতি অনুসারে কোনো এআই ব্যবস্থা স্বাধীনভাবে ফতোয়া প্রদান করতে পারে না। আপনি একজন বিজ্ঞ আলেমের সাথে সরাসরি যোগাযোগ করতে পারেন।",
    button: "বিশেষজ্ঞের সাথে যোগাযোগ করুন"
  }
};

// Out of scope messages
export const OUT_OF_SCOPE_MESSAGES: Record<SupportedLanguage, { title: string; body: string }> = {
  en: {
    title: "Out of Scope for SANAD",
    body: "This question falls outside the defined scope of SANAD. SANAD is exclusively dedicated to verified Islamic knowledge, authentic scriptural citations, and connecting seekers with qualified religious specialists."
  },
  ur: {
    title: "سَنَد کے دائرہ کار سے باہر",
    body: "یہ سوال سَنَد کے مخصوص دائرہ کار سے باہر ہے۔ سَنَد کا مقصد خالصتاً مستند اسلامی مواد، مصدقہ متون، اور صارفین کو اہل دینی ماہرین سے جوڑنا ہے۔"
  },
  bn: {
    title: "সনদের আওতাভুক্ত নয়",
    body: "এই প্রশ্নটি 'সনদ'-এর নির্ধারিত বিষয়ের বাইরে। সনদ কেবলমাত্র নির্ভরযোগ্য ইসলামী জ্ঞান, বিশুদ্ধ প্রমাণাদি এবং যোগ্য ইসলামী বিশেষজ্ঞদের সাথে সংযোগ স্থাপনের জন্য নিবেদিত।"
  }
};

// Fabricated hadith refusal messages
export const UNVERIFIED_HADITH_MESSAGES: Record<SupportedLanguage, { title: string; body: string }> = {
  en: {
    title: "No Authentic Hadith Found (Refusal to Fabricate)",
    body: "No matching authentic Hadith could be found in the verified canonical collections (Sahih al-Bukhari, Sahih Muslim, or Dorar.net Hadith Encyclopedia). In compliance with the Islamic scientific standard, SANAD strictly refrains from inventing or attributing unverified narrations to the Prophet ﷺ."
  },
  ur: {
    title: "کوئی صحیح حدیث نہیں ملی (عدم اختلاق)",
    body: "مستند کتبِ حدیث (صحیح بخاری، صحیح مسلم، اور موسوعہ درر سنیہ) میں اس مفہوم کی کوئی صحیح حدیث موجود نہیں ہے۔ سَنَد کے شرعی و علمی ضوابط کے تحت نبی کریم ﷺ کی طرف بغیر ثبوت کے کوئی بات منسوب کرنا یا اختراع کرنا قطعی ممنوع ہے۔"
  },
  bn: {
    title: "কোনো বিশুদ্ধ হাদিস পাওয়া যায়নি (মনগড়া বর্ণনা বর্জন)",
    body: "নির্ভরযোগ্য হাদিস সংকলনসমূহ (সহীহ বুখারী, সহীহ মুসলিম বা দুরার এন্টারপ্রাইজে) এই বিষয়ক কোনো বিশুদ্ধ হাদিসের সন্ধান পাওয়া যায়নি। ইসলামী বৈজ্ঞানিক নীতিমালার আলোকে 'সনদ' কোনো অপ্রমাণিত বা মনগড়া কথা রাসুলুল্লাহ ﷺ-এর নামে প্রচার করা থেকে কঠোরভাবে বিরত থাকে।"
  }
};

/**
 * Detects if the query is a personal fatwa / Level D
 */
function isPersonalFatwa(query: string): boolean {
  const lower = query.toLowerCase();
  const personalKeywords = [
    // English
    'in my marriage', 'divorce my wife', 'is it permissible for me', 'can i divorce', 
    'my husband said', 'in my case', 'verbal divorce', 'my inheritance', 
    'validity of my prayer', 'did my fast break', 'legal contract between me',
    // Urdu
    'میری شادی', 'میری بیوی', 'طلاق', 'زبانی طلاق', 'کیا میرے لیے جائز ہے', 
    'میری نماز باطل', 'میرا روزہ ٹوٹا', 'میرے والد کی وراثت', 'میرے ذاتی معاملے',
    // Bengali
    'আমার বিবাহ', 'আমার স্ত্রী', 'তালাক', 'মৌখিক তালাক', 'আমার জন্য কি বৈধ', 
    'আমার নামাজ হবে কি', 'আমার রোজা ভেঙেছে', 'আমার উত্তরাধিকার'
  ];
  return personalKeywords.some(kw => lower.includes(kw));
}

/**
 * Detects if the query is explicitly asking for a fabricated or non-existent hadith
 */
function isFabricatedHadithInquiry(query: string): boolean {
  const lower = query.toLowerCase();
  const markers = [
    'eating apples while standing', 'apple while standing', 'eating apples causes poverty',
    'کھڑے ہو کر سیب', 'سیب کھانے سے غربت',
    'দাঁড়িয়ে আপেল', 'আপেল খেলে দরিদ্রতা'
  ];
  return markers.some(m => lower.includes(m));
}

/**
 * Detects out of scope questions (stocks, coding, football, weather, unrelated politics)
 */
function isOutOfScope(query: string): boolean {
  const lower = query.toLowerCase();
  const outOfScopeKeywords = [
    'crypto', 'bitcoin', 'buy stocks', 'weather in tokyo', 'football match', 
    'write python code', 'react hook', 'who won the champions league',
    'پائی تھن کوڈ', 'کرپٹو کرنسی', 'فٹ بال میچ',
    'পাইথন কোড', 'বিটকয়েন', 'ফুটবল ম্যাচ'
  ];
  return outOfScopeKeywords.some(kw => lower.includes(kw));
}

/**
 * Semantic keyword score matching
 */
function scoreChunk(chunk: KnowledgeChunk, query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;
  for (const kw of chunk.keywords) {
    if (lowerQuery.includes(kw.toLowerCase())) {
      score += 10;
    }
  }
  // Title/source match
  if (lowerQuery.includes(chunk.sourceName.toLowerCase())) score += 5;
  return score;
}

/**
 * Main RAG Processing Function
 */
function legacyProcessQuery(
  rawQuery: string,
  lang: SupportedLanguage
): SanadResponse {
  const query = rawQuery.trim();

  // 1. Scope Check
  if (isOutOfScope(query)) {
    const oos = OUT_OF_SCOPE_MESSAGES[lang];
    return {
      answerText: oos.body,
      contentLevel: 'C',
      contentLevelTitle: 'Level C - Out of Scope',
      citations: [],
      isOutOfScope: true,
      isSpecialistHandoffNeeded: false,
      confidenceScore: 0.95
    };
  }

  // 2. Level D: Personal Fatwa Check
  if (isPersonalFatwa(query)) {
    const pfm = PERSONAL_FATWA_MESSAGES[lang];
    return {
      answerText: pfm.body,
      contentLevel: 'D',
      contentLevelTitle: lang === 'ur' ? 'المستوى (د): فتوى أو حالة شخصية' : (lang === 'bn' ? 'লেভেল ডি: ফতোয়া বা ব্যক্তিগত বিষয়' : 'Level D - Personal Case / Fatwa'),
      citations: [
        {
          sourceName: 'Scientific Standard of SANAD (المعيار العلمي الملزم - عدم الاستقلال بالفتوى)',
          sourceCategory: 'fiqh',
          reference: 'Scientific Standard Rule #3 (عدم الاستقلال بالفتوى)',
          url: 'https://dorar.net/feqhia'
        }
      ],
      isOutOfScope: false,
      isSpecialistHandoffNeeded: true,
      handoffReason: 'personal_fatwa',
      confidenceScore: 0.99
    };
  }

  // 3. Fake Hadith & Anti-Hallucination Check
  if (isFabricatedHadithInquiry(query)) {
    const msg = UNVERIFIED_HADITH_MESSAGES[lang];
    return {
      answerText: msg.body,
      contentLevel: 'B',
      contentLevelTitle: lang === 'ur' ? 'المستوى (ب): فحص الأحاديث ومقاومة الهلوسة' : (lang === 'bn' ? 'লেভেল বি: হাদিস যাচাই ও প্রতিরোধ' : 'Level B - Hadith Verification Guardrail'),
      citations: [
        {
          sourceName: 'Dorar.net Hadith Encyclopedia & Sahihayn Database',
          sourceCategory: 'hadith',
          reference: 'Dorar.net Hadith Verification Engine',
          hadithGrade: 'لا أصل له بهذا اللفظ في الكتب المعتمدة (Unverified / No Basis)',
          url: 'https://dorar.net/hadith'
        }
      ],
      isOutOfScope: false,
      isSpecialistHandoffNeeded: true,
      handoffReason: 'low_confidence_unverified',
      confidenceScore: 0.98
    };
  }

  // 4. Terminology Dictionary Special Handling
  const lowerQuery = query.toLowerCase();
  if (
    (lowerQuery.includes('translate') && lowerQuery.includes('tawhid')) ||
    (lowerQuery.includes('ترجم') && lowerQuery.includes('توحيد')) ||
    (lowerQuery.includes('ترجمہ') && lowerQuery.includes('توحید')) ||
    (lowerQuery.includes('অনুবাদ') && lowerQuery.includes('তাওহীদ'))
  ) {
    const termItem = TERMINOLOGY_DICTIONARY.find(t => t.id === 'term-tawhid')!;
    const termAnswers: Record<SupportedLanguage, string> = {
      en: `According to the official SANAD Terminology Standard (Page 7 of Approved References):
The approved English representation of "التوحيد" is:
👉 **"Tawhid / Oneness of God"**

**Usage Guideline:**
It is preferred to preserve the authentic transliteration "Tawhid" accompanied by the definition: singling out Allah in His Lordship (Rububiyyah), His exclusive right to Worship (Uluhiyyah), and His Beautiful Names and Attributes. It must not be reduced to a mere numerical oneness or generic "monotheism".`,
      ur: `سَنَد کی معتمد مصطلحات کی گائیڈ لائن (صفحہ ۷) کے مطابق:
لفظ "التوحید" کا معتمد انگریزی متبادل ہے:
👉 **"Tawhid / Oneness of God"**

**ضابطہ استعمال:**
اصطلاح کو "توحید" کے اصل لفظ کے ساتھ باقی رکھنا مستحب ہے اور اس کا مفہوم واضح کیا جائے: یعنی اللہ تعالیٰ کو اس کی ربوبیت، الوہیت، اور اسمائے حسنیٰ میں یکتا و یگانہ ماننا، اور اسے محض ایک عددی اکائی کے لفظ میں محدود نہ کیا جائے۔`,
      bn: `'সনদ'-এর অনুমোদিত পরিভাষা গাইডলাইন (পৃষ্ঠা ৭) অনুযায়ী:
"التوحيد" (তাওহীদ)-এর অনুমোদিত ইংরেজি রূপ হলো:
👉 **"Tawhid / Oneness of God"**

**ব্যবহারের নিয়মাবলী:**
আসল শব্দ 'তাওহীদ' (Tawhid) বজায় রেখে এর সঠিক অর্থ ব্যাখ্যা করাই উত্তম: মহান আল্লাহকে তাঁর রুবূবিয়াত (প্রতিপালকত্ব), উলূহিয়াত (ইবাদত) এবং সুন্দর নাম ও গুণাবলীতে একক ও অদ্বিতীয় বিশ্বাস করা। এটিকে কেবল সংখ্যাগত একত্বের মধ্যে সীমাবদ্ধ করা যাবে না।`
    };

    return {
      answerText: termAnswers[lang],
      scriptureOriginal: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
      translationApproved: 'Say: He is Allah, [who is] One. Allah, the Eternal Refuge... (Surah Al-Ikhlas 112:1-4)',
      aiExplanation: termItem.contextNote,
      contentLevel: 'A',
      contentLevelTitle: lang === 'ur' ? 'المستوى (أ): قاموس المصطلحات المعتمد' : (lang === 'bn' ? 'লেভেল এ: অনুমোদিত পরিভাষা' : 'Level A - Approved Terminology Standards'),
      citations: [
        {
          sourceName: 'Al-Jamharah Islamic Terms Encyclopedia (موسوعة الجمهرة)',
          sourceCategory: 'dictionary',
          reference: 'Al-Jamharah Terminology Guideline #2',
          url: 'https://islamic-content.com/dictionary'
        }
      ],
      isOutOfScope: false,
      isSpecialistHandoffNeeded: false,
      confidenceScore: 0.99
    };
  }

  // 5. Match with Knowledge Base Chunks
  let bestChunk: KnowledgeChunk | null = null;
  let bestScore = 0;

  for (const chunk of KNOWLEDGE_CHUNKS) {
    const s = scoreChunk(chunk, query);
    if (s > bestScore) {
      bestScore = s;
      bestChunk = chunk;
    }
  }

  // If match score is high enough (>= 10)
  if (bestChunk && bestScore >= 10) {
    const explanation = lang === 'ur' 
      ? bestChunk.explanationUr 
      : (lang === 'bn' ? bestChunk.explanationBn : bestChunk.explanationEn);
    
    const translation = lang === 'ur'
      ? bestChunk.urduTranslation
      : (lang === 'bn' ? bestChunk.bengaliTranslation : bestChunk.englishTranslation);

    const citations: Citation[] = [
      {
        sourceName: bestChunk.sourceName,
        sourceCategory: bestChunk.category,
        reference: bestChunk.reference,
        hadithGrade: bestChunk.hadithGrade,
        hadithScholar: bestChunk.hadithScholar,
        url: bestChunk.url
      }
    ];

    const levelTitles: Record<ContentLevel, Record<SupportedLanguage, string>> = {
      'A': {
        en: 'Level A - Original Settled Truth (معلومات أصلية مستقرة)',
        ur: 'المستوى (أ): معلومات أصلية مستقرة',
        bn: 'লেভেল এ: মূল প্রমাণিত সত্য (স্থির জ্ঞান)'
      },
      'B': {
        en: 'Level B - Explanation & Intellectual Clarification (شرح وتعريف واستدلال)',
        ur: 'المستوى (ب): شرح وتعريف واستدلال',
        bn: 'লেভেল বি: ব্যাখ্যা ও যৌক্তিক উপস্থাপন'
      },
      'C': {
        en: 'Level C - Legitimate Scholarly Differences (مسائل خلافية مقيدة)',
        ur: 'المستوى (ج): مسائل خلافية مقيدة',
        bn: 'লেভেল সি: বৈধ মতপার্থক্যমূলক বিষয়'
      },
      'D': {
        en: 'Level D - Personal Fatwa / Individual Reality',
        ur: 'المستوى (د): فتوى أو حالة شخصية',
        bn: 'লেভেল ডি: ব্যক্তিগত ফতোয়া'
      }
    };

    return {
      answerText: explanation,
      scriptureOriginal: bestChunk.arabicScripture,
      translationApproved: translation,
      aiExplanation: explanation,
      contentLevel: bestChunk.contentLevel,
      contentLevelTitle: levelTitles[bestChunk.contentLevel][lang],
      citations: citations,
      isOutOfScope: false,
      isSpecialistHandoffNeeded: false,
      confidenceScore: 0.94
    };
  }

  // 7. No verified source found -> Anti-Hallucination Safe Fallback
  const fallback = NO_ANSWER_MESSAGES[lang];
  return {
    answerText: fallback.body,
    contentLevel: 'C',
    contentLevelTitle: lang === 'ur' ? 'المستوى (ج): إحالة لعدم كفاية التوثيق' : (lang === 'bn' ? 'লেভেল সি: পর্যাপ্ত প্রমাণের অভাব' : 'Level C - Low Confidence Fallback'),
    citations: [],
    isOutOfScope: false,
    isSpecialistHandoffNeeded: true,
    handoffReason: 'low_confidence_unverified',
    confidenceScore: 0.25
  };
}

type ServerOutcome =
  | { kind: 'answer'; response: SanadResponse }
  | { kind: 'unavailable' }
  | { kind: 'error'; code: string };

async function askServer(question: string, lang: SupportedLanguage): Promise<ServerOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, language: lang }),
    });
  } catch {
    return { kind: 'unavailable' }; // API server not running
  }
  if (res.ok) return { kind: 'answer', response: (await res.json()) as SanadResponse };
  const body = await res.json().catch(() => ({} as { code?: string }));
  if (res.status === 404 || (res.status === 503 && body.code === 'RAG_NOT_CONFIGURED')) return { kind: 'unavailable' };
  return { kind: 'error', code: body.code ?? `HTTP_${res.status}` };
}

export async function processQuery(rawQuery: string, lang: SupportedLanguage): Promise<SanadResponse> {
  const query = rawQuery.trim();
  const server = await askServer(query, lang);
  if (server.kind === 'answer') return server.response;
  if (server.kind === 'error') throw new Error(`Answer engine error: ${server.code}`);
  return { ...legacyProcessQuery(query, lang), engine: 'legacy' };
}
