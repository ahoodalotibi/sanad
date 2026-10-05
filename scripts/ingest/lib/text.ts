/**
 * Turning published HTML into plain text WITHOUT changing the wording.
 * Only whitespace is normalised: runs of spaces collapse to one and block
 * elements (paragraphs, headings, list items) become separate lines.
 * Letters, diacritics, punctuation and numbers are kept exactly as published.
 */

const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'TABLE', 'TR', 'HR']);

/** Minimal DOM surface we rely on, so the same code runs on linkedom (Node) and in a browser. */
export interface NodeLike {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<NodeLike>;
}

export function collapse(s: string): string {
  return s.replace(/[\s ]+/g, ' ').trim();
}

/** Plain text of an element with one line per block element. */
export function blockText(root: NodeLike): string {
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    const t = collapse(current);
    if (t) lines.push(t);
    current = '';
  };
  const walk = (node: NodeLike) => {
    if (node.nodeType === 3) {
      current += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const name = node.nodeName.toUpperCase();
    if (name === 'SCRIPT' || name === 'STYLE') return;
    if (name === 'BR') {
      flush();
      return;
    }
    const isBlock = BLOCK.has(name);
    if (isBlock) flush();
    for (const child of Array.from(node.childNodes)) walk(child);
    if (isBlock) flush();
  };
  walk(root);
  flush();
  return lines.join('\n');
}
