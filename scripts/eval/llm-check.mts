/** `npm run llm:check` — one tiny request to the configured model; prints the result, never the key. */
import 'dotenv/config';
import { z } from 'zod';
import { createLlm, readLlmSettings } from '../../server/answer/llm.ts';

const s = readLlmSettings();
if (!s) {
  console.log('✗ LLM_API_KEY is empty in .env');
  process.exit(1);
}
console.log(`endpoint: ${s.baseUrl}  model: ${s.model}`);
try {
  const r = await createLlm(s).json('Reply with JSON only.', 'Return {"ok": true}', z.object({ ok: z.boolean() }));
  console.log('✓ model works:', JSON.stringify(r));
} catch (e) {
  console.log('✗', (e as Error).message);
  if (s.baseUrl.includes('generativelanguage')) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(s.apiKey)}&pageSize=200`);
    const data = (await res.json().catch(() => ({}))) as { models?: Array<{ name: string }> };
    const names = (data.models ?? []).map((m) => m.name.replace('models/', '')).filter((n) => /flash|pro/.test(n));
    console.log('models available to this key:', names.join(', ') || `(HTTP ${res.status})`);
  }
}
