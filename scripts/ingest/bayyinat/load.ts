/**
 * Maps extracted «بينات» items onto the SANAD tables:
 *   one document per question and language     external_ref "bayenat:{id}" / "bayenat:{id}:{lang}"
 *   chunk 0      the question, its similar phrasings and «مختصر الجواب»
 *   chunks 1..n  «الجواب التفصيلي», split only between lines when long, each chunk starting with
 *                the question — a question and its answer are never separated.
 * Text is copied verbatim from the extraction.
 */
import { sha256 } from '../lib/fetcher.ts';
import { languageFromLabel, type ChunkInput, type IngestStore, type SourceRow } from '../lib/store.ts';
import type { BayyinatRecord } from '../bayyinat.ts';

export const BAYYINAT_SOURCE: SourceRow = {
  slug: 'bayyinat',
  name_ar: 'بينات: أسئلة وأجوبة عن الإسلام — مركز أصول',
  name_en: 'Bayyinat: Questions and Answers about Islam — Osoul Center',
  domain: 'shubuhat_faq',
  base_url: 'https://dawa.center/file/7937',
  usage_rule_ar: 'تعد مصدرًا أساسيًا للحلول الحوارية في الشبهات.',
  reference_section: 'المرجعية والحزمة العلمية والبيانات، ص4 — الشبهات والأسئلة المتكررة (النص من منصة الناشر bayenat.net)',
  is_primary_reference: true,
};

export const MAX_CHUNK_CHARS = 3000;

export interface BayyinatLoadReport {
  documents: Record<string, number>;
  chunks: number;
  languages: string[];
  skipped: Array<{ ref: string; reason: string }>;
}

/** Splits text into pieces of at most `max` characters, only at line breaks (a single long line stays whole). */
export function splitLines(text: string, max = MAX_CHUNK_CHARS): string[] {
  const out: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (cur && cur.length + 1 + line.length > max) {
      out.push(cur);
      cur = line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
}

export function buildChunks(r: BayyinatRecord): ChunkInput[] {
  const meta = { item_id: r.sourceItemId, source_url: r.url, book_reference: r.bookReference, category: r.category };
  const chunks: ChunkInput[] = [];
  const head = [r.question, ...(r.similar.length ? ['عبارات مشابهة للسؤال:', ...r.similar] : [])].join('\n');
  if (r.shortAnswer) chunks.push({ chunk_index: 0, language: r.language, content_type: 'qa', heading: r.title || r.question, content: `${head}\nمختصر الجواب:\n${r.shortAnswer}`, metadata: { ...meta, part: 'short_answer' } });
  const parts = r.detailedAnswer ? splitLines(r.detailedAnswer, MAX_CHUNK_CHARS - r.question.length) : [];
  parts.forEach((p, i) =>
    chunks.push({ chunk_index: chunks.length, language: r.language, content_type: 'qa', heading: r.title || r.question, content: `${r.question}\nالجواب التفصيلي:\n${p}`, metadata: { ...meta, part: 'detailed_answer', piece: i + 1, pieces: parts.length } })
  );
  return chunks;
}

export async function loadBayyinat(records: BayyinatRecord[], store: IngestStore): Promise<BayyinatLoadReport> {
  const report: BayyinatLoadReport = { documents: {}, chunks: 0, languages: [], skipped: [] };
  const labels = new Map<string, string>([['ar', 'العربية Arabic']]);
  for (const r of records) for (const t of r.translations) if (!labels.has(t.language)) labels.set(t.language, t.label);
  for (const r of records) if (!labels.has(r.language)) labels.set(r.language, r.language);
  await store.ensureLanguages([...labels].map(([code, label]) => languageFromLabel(code, label)));
  report.languages = [...labels.keys()].sort();
  const sourceId = await store.upsertSource(BAYYINAT_SOURCE);

  for (const r of records) {
    const ref = r.language === 'ar' ? `bayenat:${r.sourceItemId}` : `bayenat:${r.sourceItemId}:${r.language}`;
    const chunks = buildChunks(r);
    if (!r.question || chunks.length === 0) {
      report.skipped.push({ ref, reason: 'question or answer is empty' });
      continue;
    }
    const { id, action } = await store.upsertDocument({
      source_id: sourceId,
      title: r.title || r.question,
      language: r.language,
      canonical_url: r.url,
      external_ref: ref,
      content_sha256: sha256(JSON.stringify([r.url, r.question, r.similar, r.shortAnswer, r.detailedAnswer])),
      license_note: 'مركز أصول — بينات (https://dawa.center/file/7937)، النص من منصة الناشر bayenat.net',
      metadata: {
        kind: 'qa',
        item_id: r.sourceItemId,
        translation_of: r.language === 'ar' ? null : `bayenat:${r.sourceItemId}`,
        book_reference: r.bookReference,
        category: r.category,
        author: r.author,
        publisher: r.publisher,
        similar_questions: r.similar,
        quotations: r.quotes,
        print_url: r.printUrl,
        raw_file: r.raw.file,
        raw_sha256: r.raw.sha256,
        fetched_at: r.fetchedAt,
      },
    });
    report.documents[action] = (report.documents[action] ?? 0) + 1;
    if (action === 'inserted' || action === 'updated') {
      await store.replaceChunks(id, chunks);
      report.chunks += chunks.length;
    }
  }
  return report;
}
