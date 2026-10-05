/** Tiny argument parser and output helpers shared by the ingestion scripts. */
import fs from 'node:fs';
import path from 'node:path';

export function parseArgs(argv = process.argv.slice(2)): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, ...v] = a.slice(2).split('=');
    out[k] = v.length ? v.join('=') : 'true';
  }
  return out;
}

export const intArg = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export function writeJsonl(file: string, rows: unknown[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

export function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function progress(label: string) {
  let last = 0;
  return (done: number, total: number) => {
    const now = Date.now();
    if (done === total || now - last > 1500) {
      last = now;
      process.stdout.write(`\r  ${label}: ${done}/${total}   `);
      if (done === total) process.stdout.write('\n');
    }
  };
}

/**
 * Returns a deep copy with fresh strings. Text pulled out of a parsed page can keep the entire
 * page's HTML alive in memory (V8 sliced strings); copying lets each page be freed after parsing.
 */
export const detach = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
