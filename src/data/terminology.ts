/**
 * Approved Islamic Terminology Dictionary
 * Sourced directly from Page 7 of "المرجعية والحزمة العلمية والبيانات"
 * (نماذج لقاموس المصطلحات الأساسية وضوابط الاستخدام)
 */
import { TerminologyItem } from '../types';

export const TERMINOLOGY_DICTIONARY: TerminologyItem[] = [
  {
    id: 'term-islam',
    termAr: 'الإسلام',
    termEn: 'Islam',
    termUr: 'اسلام',
    termBn: 'ইসলাম',
    guidelineAr: 'دين الاستسلام لله بالتوحيد والانقياد له بالطاعة، ويشرح بحسب السياق ولا يختزل في معنى ثقافي عام.',
    guidelineEn: 'Defined as the religion of submission to Allah through Tawhid (Monotheism) and obedience to Him. It must be explained contextually and never reduced to a mere generic cultural phenomenon.',
    contextNote: 'Never equate with generic culture; emphasize faith, submission to the Creator, and moral jurisprudence.'
  },
  {
    id: 'term-tawhid',
    termAr: 'التوحيد',
    termEn: 'Tawhid / Oneness of God',
    termUr: 'توحید',
    termBn: 'তাওহীদ',
    guidelineAr: 'يفضل إبقاء المصطلح مع شرح معناه: إفراد الله بالربوبية والألوهية ووصفه بما جاء الوحي به من أسمائه الحسنى؛ ولا يختزل في ترجمة قد توحي بمجرد الوحدانية العددية.',
    guidelineEn: 'Keep the original transliterated term "Tawhid" accompanied by the definition: Singling out Allah in His Lordship, Worship, and Beautiful Names and Attributes. Do not reduce it to mere numerical oneness ("monotheism" alone).',
    contextNote: 'Transliterate as "Tawhid" and elaborate on Rububiyyah, Uluhiyyah, and Asma wa Sifat.'
  },
  {
    id: 'term-worship',
    termAr: 'العبادة',
    termEn: 'Worship / Ibadah',
    termUr: 'عبادت',
    termBn: 'ইবাদত',
    guidelineAr: 'تشمل أعمال القلب والقول والعمل التي يتقرب بها العبد إلى الله، ولا تحصر في الشعائر فقط.',
    guidelineEn: 'Includes all actions of the heart, speech, and physical deeds by which the servant draws nearer to Allah; it must not be restricted strictly to ritual ceremonies.',
    contextNote: 'Encompasses moral character, justice, inner devotion, and formal rites.'
  },
  {
    id: 'term-prophethood',
    termAr: 'النبوة',
    termEn: 'Prophethood / Nubuwwah',
    termUr: 'نبوت',
    termBn: 'নবুওয়াত',
    guidelineAr: 'تستخدم للدلالة على اصطفاء الأنبياء بالوحي، مع التمييز بينها وبين القيادة الدينية البشرية.',
    guidelineEn: 'Used to designate divine election of Prophets through divine revelation, clearly distinguishing them from ordinary human religious leadership or philosophers.',
    contextNote: 'Divinely chosen via Revelation, not acquired through secular politics or philosophy.'
  },
  {
    id: 'term-revelation',
    termAr: 'الوحي',
    termEn: 'Revelation / Wahy',
    termUr: 'وحی',
    termBn: 'ওহী',
    guidelineAr: 'يشرح بوصفه ما أوحاه الله إلى أنبيائه، مع تجنب استعمالات فضفاضة قد توهم الإلهام الشخصي.',
    guidelineEn: 'Explained strictly as that which Allah revealed directly to His Messengers through Gabriel, strictly avoiding ambiguous phrasing that could imply personal subjective mystical inspiration.',
    contextNote: 'Objective divine descent, not personal feelings or poetic inspiration.'
  },
  {
    id: 'term-sharia',
    termAr: 'الشريعة',
    termEn: 'Sharia / Islamic law and guidance',
    termUr: 'شریعت',
    termBn: 'শরীয়াহ',
    guidelineAr: 'يشرح بحسب السياق، ولا يختزل في العقوبات أو القانون الجنائي.',
    guidelineEn: 'Explained according to context as comprehensive divine guidance for life, ethics, faith, and transactions; never reduced solely to penal punishments or criminal statutes.',
    contextNote: 'Emphasize higher objectives (Maqasid), preservation of life, intellect, wealth, and faith.'
  },
  {
    id: 'term-hadith',
    termAr: 'الحديث',
    termEn: 'Hadith',
    termUr: 'حدیث',
    termBn: 'হাদিস',
    guidelineAr: 'ما نُقل عن النبي ﷺ من قول أو فعل أو تقرير ونحو ذلك، مع بيان درجة الثبوت عند الاستدلال.',
    guidelineEn: 'What has been transmitted from the Prophet ﷺ of sayings, actions, or tacit approvals, with explicit declaration of its degree of authenticity (Sahih, Hasan, etc.) when cited.',
    contextNote: 'Always provide authentication grade and canonical source book.'
  },
  {
    id: 'term-sunnah',
    termAr: 'السنة',
    termEn: 'Sunnah',
    termUr: 'سنت',
    termBn: 'সুন্নাহ',
    guidelineAr: 'هدي النبي ﷺ وطريقته، ويحدد المقصود بحسب السياق العلمي.',
    guidelineEn: 'The path, methodology, and exemplary way of the Prophet ﷺ; the exact technical definition is determined by whether the context is theological, juristic (recommended action), or biographical.',
    contextNote: 'Distinguish between obligatory Sunnah, recommended act (Fiqh), and overall way of life.'
  },
  {
    id: 'term-fatwa',
    termAr: 'الفتوى',
    termEn: 'Fatwa',
    termUr: 'فتویٰ',
    termBn: 'ফতোয়া',
    guidelineAr: 'جواب شرعي يصدره مؤهل في واقعة أو سؤال؛ ولا يساوى بالمعلومة العامة.',
    guidelineEn: 'A qualified legal ruling issued by a certified jurist tailored to a specific reality or personal situation; it must never be equated with general religious educational facts.',
    contextNote: 'SANAD NEVER issues independent personal fatwas; inquiries requiring individual assessment are redirected to qualified human specialists.'
  },
  {
    id: 'term-dawah',
    termAr: 'الدعوة',
    termEn: 'Da‘wah / Invitation to Islam',
    termUr: 'دعوت',
    termBn: 'দাওয়াত',
    guidelineAr: 'التعريف بالإسلام والدعوة إليه بالحكمة، ويختار المقابل بحسب السياق والجمهور.',
    guidelineEn: 'Educating others about Islam and inviting toward it with wisdom, choosing appropriate terms according to audience context and cultural sensitivities.',
    contextNote: 'Promote wisdom, gentle discourse, and factual clarity without arrogance.'
  }
];
