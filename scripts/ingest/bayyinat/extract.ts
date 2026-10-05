/**
 * «بينات: أسئلة وأجوبة عن الإسلام» — published by Osoul Center (2024) on the Dawah Digital Repository:
 * https://dawa.center/file/7937  (listed in the reference document, p.4: «الشبهات والأسئلة المتكررة»).
 *
 * Text extraction from the PDF, page by page. Segmentation into question/answer units lives in
 * segment.ts and is based on the book's own layout.
 */
export const BAYYINAT_PAGE = 'https://dawa.center/file/7937';

export interface PdfPage {
  page: number; // 1-based page number in the PDF
  text: string;
}

export interface BayyinatRecord {
  /** Stable id inside the book, e.g. "q12" */
  ref: string;
  number: number | null;
  language: string;
  question: string;
  answer: string;
  /** Section/chapter title the question appears under, as printed */
  section: string | null;
  pageStart: number;
  pageEnd: number;
  sourcePage: string;
  pdfUrl: string;
  pdfSha256: string;
}

/** Extracts the text of every page with pdf.js (lines rebuilt from text positions). */
export async function extractPdfPages(data: Uint8Array): Promise<PdfPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const pages: PdfPage[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group text items into lines by their baseline (y), keep reading order inside a line by x.
    const lines = new Map<number, Array<{ x: number; str: string }>>();
    for (const item of content.items as Array<{ str: string; transform: number[]; hasEOL?: boolean }>) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      const arr = lines.get(key) ?? [];
      arr.push({ x: item.transform[4], str: item.str });
      lines.set(key, arr);
    }
    const text = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.map((i) => i.str).join(''))
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
    pages.push({ page: p, text });
  }
  await doc.destroy();
  return pages;
}
