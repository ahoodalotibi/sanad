/**
 * Maps extracted «بينات» question/answer units onto the SANAD tables:
 *   one document per edition of the book (external_ref "file:7937", language of the edition)
 *   one knowledge chunk per question with its answer (content_type "qa"), never split apart.
 */
import { sha256 } from '../lib/fetcher.ts';
import { languageFromLabel, type IngestStore, type SourceRow } from '../lib/store.ts';
import type { BayyinatRecord } from './extract.ts';

export const BAYYINAT_SOURCE: SourceRow = {
  slug: 'dawa-center-bayyinat',
  name_ar: 'المستودع الدعوي الرقمي - بينات: أسئلة وأجوبة عن الإسلام',
  name_en: 'Dawah Digital Repository — Bayyinat: Questions and Answers about Islam',
  domain: 'shubuhat_faq',
  base_url: 'https://dawa.center/file/7937',
  usage_rule_ar: 'تعد مصدرًا أساسيًا للحلول الحوارية في الشبهات.',
  reference_section: 'المرجعية والحزمة العلمية والبيانات، ص4 — الشبهات والأسئلة المتكررة',
  is_primary_reference: true,
};

export interface BayyinatLoadReport {
  documents: Record<string, number>;
  chunks: number;
  languages: string[];
  skipped: Array<{ ref: string; reason: string }>;
}

export async function loadBayyinat(records: BayyinatRecord[], store: IngestStore): Promise<BayyinatLoadReport> {
  const report: BayyinatLoadReport = { documents: {}, chunks: 0, languages: [], skipped: [] };
  const byLanguage = new Map<string, BayyinatRecord[]>();
  for (const r of records) byLanguage.set(r.language, [...(byLanguage.get(r.language) ?? []), r]);
  report.languages = [...byLanguage.keys()].sort();
  await store.ensureLanguages(report.languages.map((code) => languageFromLabel(code, code === 'ar' ? 'العربية Arabic' : code)));
  const sourceId = await store.upsertSource(BAYYINAT_SOURCE);

  for (const [language, rows] of byLanguage) {
    const valid = rows.filter((r) => {
      const ok = r.question.trim() && r.answer.trim();
      if (!ok) report.skipped.push({ ref: r.ref, reason: 'question or answer is empty' });
      return ok;
    });
    if (!valid.length) continue;
    const first = valid[0];
    const { id, action } = await store.upsertDocument({
      source_id: sourceId,
      title: 'بينات: أسئلة وأجوبة عن الإسلام',
      language,
      canonical_url: first.sourcePage,
      external_ref: language === 'ar' ? 'file:7937' : `file:7937:${language}`,
      content_sha256: sha256(JSON.stringify(valid.map((r) => [r.ref, r.question, r.answer]))),
      license_note: 'المستودع الدعوي الرقمي (dawa.center) — مركز أصول، 2024م / 1445هـ',
      metadata: { kind: 'qa_book', author: 'مركز أصول', publisher: 'مركز أصول', year: '2024م / 1445هـ', pdf_url: first.pdfUrl, pdf_sha256: first.pdfSha256, questions: valid.length },
    });
    report.documents[action] = (report.documents[action] ?? 0) + 1;
    if (action === 'inserted' || action === 'updated') {
      await store.replaceChunks(
        id,
        valid.map((r, i) => ({
          chunk_index: i,
          language,
          content_type: 'qa' as const,
          heading: r.question,
          content: `${r.question}\n${r.answer}`,
          metadata: { ref: r.ref, number: r.number, section: r.section, page_start: r.pageStart, page_end: r.pageEnd, source_url: r.sourcePage },
        }))
      );
      report.chunks += valid.length;
    }
  }
  return report;
}
