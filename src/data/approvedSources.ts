/**
 * Official Scientific References & Approved Sources for SANAD
 * Directly sourced from: "المرجعية والحزمة العلمية والبيانات"
 */
import { VerifiedSource, KnowledgeChunk } from '../types';

export const APPROVED_SOURCES: VerifiedSource[] = [
  {
    id: 'src-quran',
    name: 'The Noble Quran (King Fahd Complex)',
    nameAr: 'القرآن الكريم - مجمع الملك فهد لطباعة المصحف الشريف',
    category: 'quran',
    publisher: 'King Fahd Glorious Quran Printing Complex / Quranpedia',
    url: 'https://quranpedia.net',
    isVerified: true,
    notes: 'النص بالرسم العثماني المعتمد مع الترجمات المعتمدة (الإنجليزية، الأردية، البنغالية).'
  },
  {
    id: 'src-hadith-bukhari',
    name: 'Sahih al-Bukhari & Sahih Muslim (Dorar.net Hadith)',
    nameAr: 'صحيح البخاري وصحيح مسلم - موسوعة الأحاديث بموقع الدرر السنية',
    category: 'hadith',
    publisher: 'Dorar.net / Shamela.ws',
    url: 'https://dorar.net/hadith',
    isVerified: true,
    notes: 'الأحاديث الصحيحة مع بيان درجة الثبوت والحكم المعتمد.'
  },
  {
    id: 'src-tafseer-dorar',
    name: 'Dorar.net Quranic Tafseer Encyclopedia',
    nameAr: 'موسوعة التفسير - مؤسسة الدرر السنية وتفاسير القرون الثلاثة الأولى',
    category: 'tafseer',
    publisher: 'Dorar.net',
    url: 'https://dorar.net/tafseer',
    isVerified: true,
    notes: 'تمييز كالم المفسر عن النص القرآني.'
  },
  {
    id: 'src-aqeeda-dorar',
    name: 'Aqeeda Encyclopedia (Dorar.net)',
    nameAr: 'الموسوعة العقدية - الدرر السنية',
    category: 'aqeedah',
    publisher: 'Dorar.net',
    url: 'https://dorar.net/aqeeda',
    isVerified: true,
    notes: 'الالتزام بما عليه المسلمون خصوصاً الصحابة والتابعون ومن تبعهم.'
  },
  {
    id: 'src-feqh-dorar',
    name: 'Fiqh Encyclopedia (The Four Madhhabs)',
    nameAr: 'الموسوعة الفقهية - الدرر السنية وكتب المذاهب الأربعة المعتمدة',
    category: 'fiqh',
    publisher: 'Dorar.net / Four Sunnah Madhhabs',
    url: 'https://dorar.net/feqhia',
    isVerified: true,
    notes: 'عرض الأحكام العامة دون تحول لفتوى شخصية أو ترجيح آلي مستقل.'
  },
  {
    id: 'src-history-dorar',
    name: 'Prophetic Seerah & Islamic History (Dorar.net)',
    nameAr: 'موسوعة السيرة النبوية والتاريخ الإسلامي - الدرر السنية',
    category: 'seerah',
    publisher: 'Dorar.net',
    url: 'https://dorar.net/history',
    isVerified: true,
    notes: 'اعتماد الوقائع الثابتة وتمييز السياقات.'
  },
  {
    id: 'src-dawa-center',
    name: 'Digital Da\'wah Repository (dawa.center)',
    nameAr: 'المستودع الدعوي الرقمي - أسئلة وأجوبة عن الإسلام (7937)',
    category: 'dawa_center',
    publisher: 'Dawa.center',
    url: 'https://dawa.center',
    isVerified: true,
    notes: 'مرجع شامل في الدعوة ومخاطبة الثقافات والرد على الشبهات الحوارية.'
  },
  {
    id: 'src-jamharah-dict',
    name: 'Al-Jamharah Islamic Terms Encyclopedia',
    nameAr: 'موسوعة الجمهرة - مفردات المحتوى الإسلامي',
    category: 'dictionary',
    publisher: 'Islamic Content Community (islamic-content.com)',
    url: 'https://islamic-content.com/dictionary',
    isVerified: true,
    notes: 'معاجم المصطلحات الشرعية لترجمة معاني المفردات بضوابطها الشرعية.'
  }
];

/**
 * Preloaded verified Knowledge Chunks strictly aligned with the PDF benchmarks and guidelines.
 * Each chunk belongs to a verified source and has an exact Content Level (A, B, C, D).
 */
export const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
  // 1. Benchmark: Kaaba & Worship (Level A)
  {
    id: 'chk-kaaba-worship',
    sourceId: 'src-quran',
    sourceName: 'The Noble Quran (Surah Al-Baqarah 2:144)',
    category: 'quran',
    contentLevel: 'A',
    keywords: ['kaaba', 'worship', 'direction', 'qibla', 'pray', 'كعبة', 'قبلة', 'عبادة', 'کعبہ', 'کعبے', 'ক্বাবা', 'পূজা', 'নামাজ'],
    arabicScripture: 'فَوَلِّ وَجْهَكَ شَطْرَ الْمَسْجِدِ الْحَرَامِ وَحَيْثُ مَا كُنتُمْ فَوَلُّوا وُجُوهَكُمْ شَطْرَهُ',
    englishTranslation: 'So turn your face toward al-Masjid al-Haram. And wherever you [believers] are, turn your faces toward it [in prayer]. (Surah Al-Baqarah 2:144 - Saheeh International / King Fahd Complex)',
    urduTranslation: 'پس اپنا چہرہ مسجد حرام کی طرف پھیر لیں، اور آپ جہاں کہیں بھی ہوں، اپنے چہرے اسی کی طرف پھیریں۔ (سورۃ البقرۃ ۲:۱۴۴)',
    bengaliTranslation: 'অতএব আপনি মসজিদুল হারামের দিকে মুখ ফিরান এবং তোমরা যেখানেই থাক না কেন, সেদিকেই নিজেদের মুখ ফিরাও। (সূরা আল-বাকারা ২:১৪৪)',
    explanationEn: 'Muslims do not worship the Kaaba. Worship (Ibadah) in Islam is devoted strictly and exclusively to Allah (God Alone). The Kaaba is solely the unified direction of prayer (Qiblah) that unifies believers across the globe facing one focal point. Worshipping the structure or any physical stone is strictly forbidden (Shirk) in Islamic doctrine.',
    explanationUr: 'مسلمان خانہ کعبہ کی پوجا نہیں کرتے۔ اسلام میں عبادت خالصتاً صرف اللہ وحدہ لا شریک کے لیے مخصوص ہے۔ کعبہ صرف قبلہ (نماز کی سمت) ہے جو دنیا بھر کے مسلمانوں کو ایک رخ پر متحد کرتا ہے۔ کعبہ یا کسی بھی پتھر کی عبادت کرنا شرک اور قطعی حرام ہے۔',
    explanationBn: 'মুসলমানরা ক্বাবার পূজা করে না। ইসলামে ইবাদত একমাত্র আল্লাহর জন্য নির্ধারিত। ক্বাবা কেবল নামাজের দিক বা কেবলা (Qiblah), যা বিশ্বব্যাপী বিশ্বাসীদের নামাজের সময় একমুখী ঐক্য বজায় রাখতে সাহায্য করে। কোনো পাথর বা ভবনের পূজা করা ইসলামে সম্পূর্ণ নিষিদ্ধ (শিরক)।',
    reference: 'Surah Al-Baqarah 2:144 & Dorar.net Aqeeda Encyclopedia',
    url: 'https://dorar.net/aqeeda'
  },

  // 2. Benchmark: Authorship of Quran (Level A)
  {
    id: 'chk-quran-authorship',
    sourceId: 'src-quran',
    sourceName: 'The Noble Quran (Surah An-Najm 53:3-4)',
    category: 'quran',
    contentLevel: 'A',
    keywords: ['author', 'muhammad', 'quran', 'write', 'who wrote', 'تأليف', 'محمد', 'وحي', 'قرآن', 'کیا قران محمد', 'কুরআন কে লিখেছেন'],
    arabicScripture: 'وَمَا يَنطِقُ عَنِ الْهَوَىٰ ۝ إِنْ هُوَ إِلَّا وَحْيٌ يُوحَىٰ',
    englishTranslation: 'Nor does he speak from [his own] inclination. It is not but a revelation revealed. (Surah An-Najm 53:3-4)',
    urduTranslation: 'اور وہ اپنی خواہش نفس سے نہیں بولتے، یہ تو بس ایک وحی ہے جو ان پر نازل کی جاتی ہے۔ (سورۃ النجم ۵۳:۳-۴)',
    bengaliTranslation: 'এবং তিনি নিজের প্রবৃত্তি থেকে কথা বলেন না। এ তো কেবল ওহী, যা তাঁর প্রতি প্রত্যাদেশ করা হয়। (সূরা আন-নাজম ৫৩:৩-৪)',
    explanationEn: 'The Quran was not authored by the Prophet Muhammad ﷺ. In Islamic creed, the Quran is the literal and uncreated Word of Allah, revealed via the Angel Gabriel (Jibril) over 23 years. The Prophet Muhammad ﷺ was unlettered (Ummi) and served as the faithful Messenger who conveyed what was revealed to him without alterations.',
    explanationUr: 'قرآن مجید حضرت محمد ﷺ کا تالیف کردہ نہیں ہے۔ اسلامی عقیدے کے مطابق قرآن مجید اللہ کا کلام ہے جو حضرت جبریل علیہ السلام کے ذریعے ۲۳ سال کے عرصے میں نازل کیا گیا۔ نبی کریم ﷺ امی (غیر تحریری) تھے اور وہ اللہ کا امانت دار پیغام بغیر کسی تبدیلی کے پہنچانے والے تھے۔',
    explanationBn: 'পবিত্র কুরআন হযরত মুহাম্মদ ﷺ কর্তৃক রচিত কোনো গ্রন্থ নয়। ইসলামী বিশ্বাস মতে, কুরআন হলো মহান আল্লাহর সরাসরি বাণী, যা জিব্রাইল (আ.)-এর মাধ্যমে দীর্ঘ ২৩ বছর ধরে নাযিল হয়েছিল। নবী মুহাম্মদ ﷺ ছিলেন নিরক্ষর (উম্মী), যিনি কোনো পরিবর্তন ছাড়াই আল্লাহর ওহী যথাযথভাবে পৌঁছে দিয়েছেন।',
    reference: 'Surah An-Najm 53:3-4, Surah Al-Baqarah 2:23 & Dorar.net Aqeeda',
    url: 'https://dorar.net/aqeeda'
  },

  // 3. Benchmark: Did Islam spread by the sword? (Level B)
  {
    id: 'chk-spread-sword',
    sourceId: 'src-history-dorar',
    sourceName: 'The Noble Quran (Surah Al-Baqarah 2:256) & Dorar History',
    category: 'seerah',
    contentLevel: 'B',
    keywords: ['sword', 'spread', 'force', 'violence', 'سيف', 'انتشر', 'إكراه', 'تلوار', 'اسلام تلوار سے پھیلا', 'তরবারি দিয়ে ইসলাম প্রচার'],
    arabicScripture: 'لَا إِكْرَاهَ فِي الدِّينِ ۖ قَد تَّبَيَّنَ الرُّشْدُ مِنَ الْغَيِّ',
    englishTranslation: 'There shall be no compulsion in religion. The right course has become clear from the wrong. (Surah Al-Baqarah 2:256)',
    urduTranslation: 'دین میں کوئی زبردستی نہیں ہے، بے شک ہدایت گمراہی سے واضح ہو چکی ہے۔ (سورۃ البقرۃ ۲:۲۵۶)',
    bengaliTranslation: 'দ্বীনের ব্যাপারে কোন জবরদস্তি নেই। নিশ্চয় হিদায়াত স্পষ্ট হয়েছে ভ্রষ্টতা থেকে। (সূরা আল-বাকারা ২:২৫৬)',
    explanationEn: 'Historical facts and Islamic texts establish that faith cannot be coerced into human hearts. The vast majority of Muslim populations worldwide—such as in Indonesia (the largest Muslim nation), Malaysia, and Sub-Saharan Africa—embraced Islam through peaceful trade, ethical conduct, and dawah, without military encounters. Battles in Islamic history were fought for defensive purposes, political sovereignty, and safeguarding freedom of belief, not forced conversion.',
    explanationUr: 'تاریخی حقائق اور اسلامی نصوص یہ ثابت کرتے ہیں کہ ایمان کبھی زبردستی دلوں میں داخل نہیں کیا جا سکتا۔ دنیا کے سب سے بڑے مسلم اکثریتی خطے جیسے انڈونیشیا، ملائیشیا اور مغربی افریقہ میں اسلام تاجروں کے عمدہ اخلاق اور دعوت کے ذریعے پھیلا۔ تاریخ میں دفاعی جنگیں لڑی گئیں لیکن زبردستی مذہب تبدیل کروانا شرعاً ممنوع ہے۔',
    explanationBn: 'ঐতিহাসিক সত্য ও ইসলামী মূলনীতি প্রমাণ করে যে বিশ্বাসের ক্ষেত্রে কোনো জোর-জবরদস্তি গ্রহণযোগ্য নয়। বিশ্বের সর্ববৃহৎ মুসলিম দেশ যেমন ইন্দোনেশিয়া, মালয়েশিয়া এবং আফ্রিকার বহু অঞ্চলে কোনো সামরিক অভিযান ছাড়াই সৎ মুসলিম ব্যবসায়ীদের চারিত্রিক সততা ও দাওয়াতি প্রচেষ্টার মাধ্যমে মানুষ ইসলাম গ্রহণ করেছিল। যুদ্ধসমূহ কেবল আত্মরক্ষা ও ন্যায়বিচার প্রতিষ্ঠার জন্য ছিল।',
    reference: 'Surah Al-Baqarah 2:256 & Dorar.net Prophetic Seerah & History',
    url: 'https://dorar.net/history'
  },

  // 4. Benchmark: Scholarly differences / Ijtihad (Level B / Level C)
  {
    id: 'chk-scholarly-differences',
    sourceId: 'src-feqh-dorar',
    sourceName: 'Sahih al-Bukhari #7352 & Dorar Fiqh Encyclopedia',
    category: 'fiqh',
    contentLevel: 'B',
    keywords: ['scholars', 'differ', 'schools', 'madhhab', 'ijtihad', 'خلاف', 'علماء', 'مذاهب', 'اجتهاد', 'اختلاف علماء', 'আলেমদের মতভেদ'],
    arabicScripture: 'إِذَا حَكَمَ الحَاكِمُ فَاجْتَهَدَ ثُمَّ أَصَابَ فَلَهُ أَجْرَانِ، وَإِذَا حَكَمَ فَاجْتَهَدَ ثُمَّ أَخْطَأَ فَلَهُ أَجْرٌ',
    englishTranslation: 'If a judge gives a judgment through his ijtihad (independent juristic reasoning) and is correct, he receives two rewards; and if he gives a judgment and errs, he receives one reward.',
    urduTranslation: 'جب کوئی حاکم یا فقیہ اجتہاد کر کے فیصلہ کرے اور درست رائے تک پہنچے تو اس کے لیے دو اجر ہیں، اور اگر اجتہاد کرے اور خطا ہو جائے تو اس کے لیے ایک اجر ہے۔',
    bengaliTranslation: 'বিচারক যখন বিচার করেন এবং ইজতিহাদ (গবেষণা) করে সঠিক সিদ্ধান্তে পৌঁছান, তবে তার জন্য দুটি প্রতিদান রয়েছে; আর যদি ইজতিহাদ করে ভুল করেন, তবে তার জন্য একটি প্রতিদান রয়েছে।',
    explanationEn: 'Differences among reputable Islamic jurists occur in subsidiary legal rulings (furu\') where texts allow multiple linguistic interpretations, not in core doctrinal foundations (Usul). Ijtihad represents scholarly dedication to discern the divine intent using structured legal methodologies. Such differences reflect legal flexibility and mercy, not theological contradiction.',
    explanationUr: 'اہل علم کے درمیان فقہی اختلاف جزئی اور فروعی مسائل میں ہوتا ہے جن میں متون کی تشریح کے کئی معتبر پہلو ہوتے ہیں، نہ کہ بنیادی عقائد میں۔ اجتہاد ایک سنجیدہ علمی کوشش ہے جس پر خطا کے باوجود مجتہد کو اجر ملتا ہے، اور یہ اسلام کے فہم کی گہرائی اور وسعت کی علامت ہے نہ کہ تضاد کی۔',
    explanationBn: 'বিজ্ঞ আলেমদের মতপার্থক্য মূলত শাখাগত (ফিকহি) বিষয়ে হয়ে থাকে, মূল আকিদা বা স্তম্ভের বিষয়ে নয়। যেখানে দলিলের ব্যাখ্যার সুযোগ রয়েছে, সেখানে নিষ্ঠাবান গবেষণাকে ইজতিহাদ বলা হয়। এটি ইসলামী আইনের সমৃদ্ধি ও সহজতার প্রমাণ, কোনো বৈপরীত্য নয়।',
    reference: 'Sahih al-Bukhari (7352), Sahih Muslim (1716) & Dorar.net Fiqh',
    hadithGrade: 'صحيح (Sahih) - متفق عليه',
    hadithScholar: 'Al-Bukhari & Muslim',
    url: 'https://dorar.net/feqhia'
  },

  // 5. Benchmark: Terminology - Tawhid (Level A)
  {
    id: 'chk-tawhid-meaning',
    sourceId: 'src-jamharah-dict',
    sourceName: 'Al-Jamharah Islamic Terms Encyclopedia & Dorar Aqeeda',
    category: 'dictionary',
    contentLevel: 'A',
    keywords: ['tawhid', 'meaning', 'oneness', 'monotheism', 'define', 'توحید', 'معنى التوحيد', 'توحید کا مطلب', 'তাওহীদ কি'],
    arabicScripture: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
    englishTranslation: 'Say: He is Allah, [who is] One. Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent. (Surah Al-Ikhlas 112:1-4)',
    urduTranslation: 'کہہ دیجیے کہ وہ اللہ ایک ہے۔ اللہ بے نیاز ہے۔ نہ اس کی کوئی اولاد ہے اور نہ وہ کسی کی اولاد ہے۔ اور کوئی اس کے برابر نہیں ہے۔ (سورۃ الاخلاص)',
    bengaliTranslation: 'বলুন: তিনিই আল্লাহ, একক। আল্লাহ কারো মুখাপেক্ষী নন। তিনি কাউকে জন্ম দেননি এবং তাঁকেও জন্ম দেয়া হয়নি। আর তাঁর সমকক্ষ কেউই নেই। (সূরা আল-ইখলাস)',
    explanationEn: 'In Islamic guidance, "Tawhid" (Oneness of God) means singling out Allah Alone in His Lordship (as Creator and Sustainer), in His exclusive right to Worship (no partners or intermediaries), and in His sublime Names and Attributes as revealed in Scripture. It is not merely numerical oneness, but total dedication of all devotion to the Creator.',
    explanationUr: 'اسلامی اصطلاح میں "توحید" کا مفہوم ہے اللہ تعالیٰ کو اس کی ربوبیت (پیدا کرنے اور نظام چلانے)، الوہیت (خالص عبادت کا واحد حق دار ہونے) اور اس کے خوبصورت اسماء و صفات میں یکتا و یگانہ ماننا۔ یہ صرف ریاضیاتی اکائی نہیں بلکہ ہر قسم کے شرک سے پاک قلبی و عملی اطاعت ہے۔',
    explanationBn: 'ইসলামী পরিভাষায় "তাওহীদ" (Tawhid) অর্থ হলো আল্লাহ তাআলাকে তাঁর রুবূবিয়াত (সৃষ্টিকর্তা ও প্রতিপালক হিসেবে), উলূহিয়াত (একমাত্র ইবাদতের যোগ্য হিসেবে) এবং তাঁর সুন্দরতম নাম ও গুণাবলীতে একক ও অনন্য বিশ্বাস করা। এটি কেবল একটি সংখ্যাগত একত্ব নয়, বরং জীবনের সকল ক্ষেত্রে একমাত্র আল্লাহর আনুগত্য স্বীকার করা।',
    reference: 'Surah Al-Ikhlas (112), Al-Jamharah Dictionary & Dorar.net Aqeeda',
    url: 'https://islamic-content.com/dictionary'
  },

  // 6. Foundation: Hadith on Intentions (Level A)
  {
    id: 'chk-hadith-intentions',
    sourceId: 'src-hadith-bukhari',
    sourceName: 'Sahih al-Bukhari #1 & Sahih Muslim #1907',
    category: 'hadith',
    contentLevel: 'A',
    keywords: ['intention', 'niyyah', 'actions', 'hadith', 'deeds', 'نية', 'حديث', 'إنما الأعمال بالنيات', 'اعمال کا دارومدار نیتوں پر ہے', 'কাজের ফলাফল নিয়তের উপর'],
    arabicScripture: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    englishTranslation: 'Actions are judged by intentions, and every person will get the reward according to what he intended.',
    urduTranslation: 'اعمال کا دارومدار نیتوں پر ہے، اور ہر شخص کے لیے وہی ہے جس کی اس نے نیت کی۔',
    bengaliTranslation: 'কাজের ফলাফল নিয়তের ওপর নির্ভরশীল, এবং প্রত্যেক ব্যক্তি যা নিয়ত করবে তাই পাবে।',
    explanationEn: 'This premier hadith is the cornerstone of Islamic ethics and devotion. Every speech and action must be grounded in sincere devotion to Allah to be accepted spiritually.',
    explanationUr: 'یہ حدیث مبارکہ اسلامی اخلاقیات اور عبادات کی عظیم بنیاد ہے۔ ہر قول و فعل کی روحانی قبولیت خلوصِ نیت پر منحصر ہے۔',
    explanationBn: 'এই মহান হাদিসটি ইসলামী নীতিশাস্ত্র ও আমলের প্রধান ভিত্তি। অন্তরের খাঁটি নিয়ত ছাড়া কোনো সৎ কাজ আল্লাহর নিকট গ্রহণযোগ্য হয় না।',
    reference: 'Sahih al-Bukhari #1, Sahih Muslim #1907',
    hadithGrade: 'صحيح (Sahih) - متفق عليه',
    hadithScholar: 'Imam al-Bukhari & Imam Muslim',
    url: 'https://dorar.net/hadith'
  },

  // 7. Foundation: Pillars of Islam & Iman (Level A)
  {
    id: 'chk-pillars-islam',
    sourceId: 'src-hadith-bukhari',
    sourceName: 'Sahih al-Bukhari #8 (Hadith of Jibreel)',
    category: 'hadith',
    contentLevel: 'A',
    keywords: ['pillars of islam', 'five pillars', 'islam basics', 'shahada', 'salah', 'zakat', 'اركان الاسلام', 'أركان الإسلام', 'اسلام کے پانچ ارکان', 'ইসলামের স্তম্ভ'],
    arabicScripture: 'بُنِيَ الإِسْلاَمُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لاَ إِلَهَ إِلاَّ اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَإِقَامِ الصَّلاَةِ، وَإِيتَاءِ الزَّكَاةِ، وَالْحَجِّ، وَصَوْمِ رَمَضَانَ',
    englishTranslation: 'Islam is built upon five [pillars]: The testimony that there is no deity worthy of worship except Allah and that Muhammad is the Messenger of Allah, establishing prayer, paying zakah, Hajj (pilgrimage), and fasting Ramadan.',
    urduTranslation: 'اسلام کی بنیاد پانچ ستونوں پر رکھی گئی ہے: اس بات کی گواہی دینا کہ اللہ کے سوا کوئی معبود نہیں اور محمد ﷺ اللہ کے رسول ہیں، نماز قائم کرنا، زکوٰۃ ادا کرنا، حج کرنا، اور رمضان کے روزے رکھنا۔',
    bengaliTranslation: 'ইসলামের ভিত্তি পাঁচটি বিষয়ের উপর স্থাপিত: এই সাক্ষ্য দেওয়া যে আল্লাহ ছাড়া কোনো সত্য উপাস্য নেই এবং মুহাম্মদ ﷺ আল্লাহর রাসুল, সালাত কায়েম করা, যাকাত দেওয়া, হজ করা এবং রমজানের রোজা রাখা।',
    explanationEn: 'These five pillars represent the non-negotiable practical obligations of every practicing Muslim, verified in all authentic scripture.',
    explanationUr: 'یہ پانچ ارکان اسلام کے قطعی عملی فرائض ہیں جن پر ہر مسلمان کا عمل ضروری ہے۔',
    explanationBn: 'এই পাঁচটি স্তম্ভ প্রতিটি মুসলিমের জন্য আবশ্যক ব্যবহারিক দায়িত্ব, যা সর্বসম্মত বিশুদ্ধ সনদে প্রমাণিত।',
    reference: 'Sahih al-Bukhari (Book 2, Hadith 8)',
    hadithGrade: 'صحيح (Sahih) - متفق عليه',
    hadithScholar: 'Al-Bukhari & Muslim',
    url: 'https://dorar.net/hadith'
  }
];
